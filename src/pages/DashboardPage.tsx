import { getRegion, hasAwarenessAndAssociations, hasFilters } from "@/lib/region";
import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import { TopNav } from "@/components/TopNav";
import { AssociationMatrix } from "@/components/dashboard/AssociationMatrix";
import { AwarenessTable } from "@/components/dashboard/AwarenessTable";
import { BenefitRanking } from "@/components/dashboard/BenefitRanking";
import { BwTable } from "@/components/dashboard/BwTable";
import { FilterSidebar } from "@/components/dashboard/FilterSidebar";
import { IndividualReach } from "@/components/dashboard/IndividualReach";
import { MarketHeatmap } from "@/components/dashboard/MarketHeatmap";
import { Masthead } from "@/components/dashboard/Masthead";
import { NotFittedBanner } from "@/components/dashboard/NotFittedBanner";
import { PartBar } from "@/components/dashboard/PartBar";
import { ReachCurve } from "@/components/dashboard/ReachCurve";
import { SegmentProfiles } from "@/components/dashboard/SegmentProfiles";
import { TurfControls } from "@/components/dashboard/TurfControls";
import { TurfOverlap } from "@/components/dashboard/TurfOverlap";
import { TurfPortfolio } from "@/components/dashboard/TurfPortfolio";
import { UtilityTable } from "@/components/dashboard/UtilityTable";
import { useDashboardFilters } from "@/hooks/useDashboardFilters";
import { hasExtendedPanels, hasNeedStates } from "@/lib/auth";
import {
  getAssociation,
  getAwareness,
  getBw,
  getUtilities,
  getMarkets,
  getMeta,
  getRanking,
  getSegments,
  getTurf,
  getTurfMeta,
} from "@/services/api";


/**
 * The MaxDiff dashboard.
 *
 * The panels the client asked to see, which is a SUBSET of what the API
 * implements:
 *
 *   B  benefit ranking (HB utilities)    /maxdiff/ranking
 *   D  demographic profiling             the shared filter on every endpoint
 *   E  prompted awareness (B2, M2)       /maxdiff/awareness/{benefits,ingredients}
 *   F  benefit → ingredient (M2)         /maxdiff/association/ingredients
 *   G  benefit → category (M3)           /maxdiff/association/categories
 *   H  TURF portfolio + reach curve      /maxdiff/turf
 *
 * Three further panels — the HB utility/CI table, best-minus-worst (A) and the
 * Latent Class need-states (C) — came off the standard view at the client's
 * request and now render only for accounts hasExtendedPanels() admits. Their endpoints were
 * never touched, so this is a rendering decision, not an analysis one. See that
 * constant for why it is not a security boundary.
 *
 * Block H is the only interactive analysis on the page: pinning a benefit in
 * the ranking re-solves the portfolio around it. That is why the TURF query
 * carries its own key rather than sharing the filter key — its answer changes
 * without the respondent base changing at all.
 *
 * The numbered parts read 01 awareness, 02 MaxDiff, 03 TURF, 04 associations
 * (with need-states inserted at 03 for extended accounts, shifting the rest) —
 * so TURF (H) comes before the association matrices (F/G) rather than in block
 * order. That is the argument, not the requirements list: awareness opens
 * because it is what consumers already know before being asked to trade
 * anything off; MaxDiff then answers which benefits actually win, and TURF is
 * where that line lands on a portfolio decision. The association matrices then
 * change the question to what consumers link those benefits to, which reads
 * better as the follow-on than as the interruption.
 *
 * Awareness (E) and the association matrices (F/G) both read M2, and the split
 * is deliberate: awareness counts a person once over the whole base, the matrix
 * counts them per benefit against that benefit's own top-5 base. Same rows,
 * different denominators, different question.
 */
const SIDEBAR_KEY = "coke-africa:sidebar-collapsed";

/**
 * ASP splits the page in two: "benefits" shows benefit rows with no platforms,
 * "platform" rolls awareness up to benefit platforms and drops ingredients.
 * Unset (every other region) is the page as it was.
 */
export type DashboardView = "benefits" | "platform";

export function DashboardPage({ view }: { view?: DashboardView } = {}) {
  const queryClient = useQueryClient();
  // Rail collapsed or not is a per-device layout preference, not account data,
  // so it is stored unkeyed and survives a sign-out.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== "undefined" &&
      window.localStorage.getItem(SIDEBAR_KEY) === "1"
  );
  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? "1" : "0");
    } catch {
      /* storage disabled — the preference just will not stick */
    }
  }, [sidebarCollapsed]);

  const {
    filters,
    draft,
    isDirty,
    apply,
    discard,
    params: filterParams,
    activeCount,
    toggleDemo,
    toggleSubcategory,
    setDemo,
    setSegment,
    setSegmentK,
    clearAll,
    toggleLock,
    clearLocks,
    setTurfSize,
    setTurfRule,
  } = useDashboardFilters();

  // No filter rail means no Apply button, so TURF size and lock changes commit as they are made.
  useEffect(() => {
    if (!hasFilters() && isDirty) apply();
  }, [isDirty, apply]);

  // The Benefits Platform Dashboard asks every endpoint to roll benefits up to platforms; on the
  // Benefits Dashboard the platform filter narrows the benefits shown.
  const params = useMemo(
    () => (view === "platform" ? { ...filterParams, group: "platform" } : filterParams),
    [view, filterParams],
  );
  const platformView = view === "platform";

  // Panels share one filter, so the serialised query string is the cache key.
  const key = useMemo(() => JSON.stringify(params), [params]);
  const common = { placeholderData: keepPreviousData };

  // Read once per render rather than held in state: the account cannot change
  // without a re-login, which reloads the app anyway.
  // Utilities and best-worst counts are per benefit; platforms have no utility of their own.
  const showExtendedPanels = hasExtendedPanels() && view !== "platform";
  // Need-state segments are per benefit too.
  const showNeedStates = hasNeedStates() && view !== "platform";
  const showAssoc = hasAwarenessAndAssociations();

  const meta = useQuery({
    queryKey: ["meta", key],
    queryFn: () => getMeta(params),
    ...common,
  });

  const ranking = useQuery({
    queryKey: ["ranking", key],
    queryFn: () => getRanking(params),
    ...common,
  });

  const markets = useQuery({
    queryKey: ["markets", key],
    queryFn: () => getMarkets(params),
    ...common,
  });

  /**
   * The three restored panels. `enabled` keeps every other account from paying
   * for three requests whose results nothing renders — the segments one is the
   * expensive read of the set.
   */
  const utilities = useQuery({
    queryKey: ["utilities", key],
    queryFn: () => getUtilities(params),
    enabled: showExtendedPanels,
    ...common,
  });

  const bw = useQuery({
    queryKey: ["bw", key],
    queryFn: () => getBw(params),
    enabled: showExtendedPanels,
    ...common,
  });

  // The class count the segments panel is reading, defaulting to the BIC-best
  // fit meta reports so the panel and its own chips agree on one K.
  const bestK = meta.data?.segments?.find((g) => g.is_best_k)?.k ?? null;
  const activeK = filters.segmentK ?? bestK;

  const segments = useQuery({
    queryKey: ["segments", key, activeK],
    queryFn: () => getSegments(params, { k: activeK }),
    enabled: showNeedStates,
    ...common,
  });

  /**
   * TURF. Keyed on the portfolio controls as well as the filter, because
   * unlike every other panel this one's answer changes without the respondent
   * base changing at all — pinning a benefit re-solves the same people.
   *
   * The server caches the reach matrix per filter, so exploring locks and
   * sizes within one cut costs a search, not another 150k-row read.
   */
  const turfLockKey = filters.turf.locked.join(",");
  const turf = useQuery({
    queryKey: [
      "turf", key, turfLockKey, filters.turf.size,
      filters.turf.rule, filters.turf.topN, filters.turf.threshold,
    ],
    queryFn: () =>
      getTurf(params, {
        size: filters.turf.size,
        locked: filters.turf.locked,
        rule: filters.turf.rule,
        topN: filters.turf.topN,
        threshold: filters.turf.threshold,
      }),
    ...common,
  });

  // The reach rules are static server-side constants, so this never refetches.
  const turfMeta = useQuery({
    queryKey: ["turf-meta"],
    queryFn: getTurfMeta,
    staleTime: Infinity,
  });

  const ingredients = useQuery({
    queryKey: ["assoc", "ingredients", key],
    queryFn: () => getAssociation("ingredients", params),
    ...common,
    enabled: showAssoc,
  });

  const categories = useQuery({
    queryKey: ["assoc", "categories", key],
    queryFn: () => getAssociation("categories", params),
    ...common,
    enabled: showAssoc,
  });

  const benefitAwareness = useQuery({
    queryKey: ["aware", platformView ? "platforms" : "benefits", key],
    queryFn: () => getAwareness(platformView ? "platforms" : "benefits", params),
    ...common,
    enabled: showAssoc,
  });

  const ingredientAwareness = useQuery({
    queryKey: ["aware", "ingredients", key],
    queryFn: () => getAwareness("ingredients", params),
    ...common,
    enabled: showAssoc && !platformView,
  });

  /** Preference share by benefit — joined into the BW and segment tables,
   *  neither of which returns it from its own endpoint. */
  const shareByItem = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of ranking.data?.rows ?? []) out[r.item] = r.preference_share;
    return out;
  }, [ranking.data]);

  const itemOrder = useMemo(
    () => (ranking.data?.rows ?? []).map((r) => r.item),
    [ranking.data]
  );

  /**
   * Section numerals, computed rather than written in, because the need-state
   * part exists only for extended accounts. Hard-coding them would show every
   * other reader a dashboard that jumps 02 -> 04, which reads as a section
   * that failed to load rather than one they were never meant to see.
   */
  const partNo = !showAssoc
    ? { maxdiff: "01", needStates: null, turf: "02", assoc: "" }
    : showNeedStates
      ? { maxdiff: "02", needStates: "03", turf: "04", assoc: "05" }
      : { maxdiff: "02", needStates: null, turf: "03", assoc: "04" };

  /**
   * The ranking panel renders statements; TURF addresses benefits by index
   * into the canonical survey order. That translation lives here rather than
   * in either component, so neither has to know about the other's identifiers.
   */
  // Meta lists benefits; on the platform tab TURF pins index platforms, so only TURF's own list fits.
  const canonicalItems = turf.data?.items ?? (platformView ? [] : meta.data?.items) ?? [];
  const indexOfItem = useMemo(() => {
    const m = new Map<string, number>();
    canonicalItems.forEach((s, i) => m.set(s, i));
    return m;
  }, [canonicalItems]);

  const namesOf = useCallback(
    (indices: number[] | undefined) =>
      new Set((indices ?? []).map((i) => canonicalItems[i]).filter(Boolean)),
    [canonicalItems]
  );

  // Locks highlight from the DRAFT so a click is acknowledged immediately;
  // portfolio membership comes from applied data. The two differing is the
  // point — "you have staged this" versus "this is in the current answer".
  const lockedItems = useMemo(
    () => namesOf(draft.turf.locked),
    [namesOf, draft.turf.locked]
  );
  const lockedLabels = useMemo(() => [...lockedItems], [lockedItems]);
  const portfolioItems = useMemo(
    () => namesOf(turf.data?.portfolio?.items),
    [namesOf, turf.data]
  );
  // Pins the DISPLAYED portfolio was solved with, as opposed to pins the user
  // has staged. The ranking shows the difference so a pending pin does not
  // look like a rejected one.
  const appliedLockedItems = useMemo(
    () => namesOf(turf.data?.locked),
    [namesOf, turf.data]
  );

  const handleToggleLock = useCallback(
    (item: string) => {
      const idx = indexOfItem.get(item);
      if (idx !== undefined) toggleLock(idx);
    },
    [indexOfItem, toggleLock]
  );

  const anyFetching = [meta, ranking, markets, turf, ingredients, categories,
                       utilities, bw, segments,
                       benefitAwareness, ingredientAwareness]
    .some((q) => q.isFetching);

  return (
    <div className="min-h-screen bg-background">
      <TopNav
        title="MaxDiff — Functional Benefits"
        refreshing={anyFetching}
        onRefresh={() => queryClient.invalidateQueries()}
      />

      <div className="flex items-start">
        {hasFilters() && <FilterSidebar
          meta={meta.data}
          draft={draft}
          activeCount={activeCount}
          filteredN={meta.data?.filtered_n}
          isDirty={isDirty}
          isFetching={anyFetching}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          onToggle={toggleDemo}
          onToggleSubcategory={toggleSubcategory}
          onSetDemo={setDemo}
          onSegment={setSegment}
          showSegmentFilter={showNeedStates}
          onClear={clearAll}
          onApply={apply}
          onDiscard={discard}
          onClearLocks={clearLocks}
          lockedLabels={lockedLabels}
        />}

        <main className="min-w-0 flex-1 px-7 pb-24 pt-7">
        <Masthead meta={meta.data} selectedMarkets={filters.demo.market} />

        <NotFittedBanner meta={meta.data} />

        {showAssoc && (<>
        {/* ── 01 Awareness ───────────────────────────────────────────── */}
        <PartBar index="01" name="Awareness" method={platformView ? "Prompted, B2" : "Prompted, B2 & M2"} tone="assoc">
          What consumers say they already know about, before any trade-off is asked of them.
          {platformView ? " It is a prompted multi-select" : " Both are prompted multi-selects"} read
          straight off the questionnaire — no model — so
          the rows are simple incidence and do <em>not</em> sum to 100. Awareness is a
          different question from relevance: a benefit can be widely known and still lose
          every trade-off below, and that gap is usually the interesting part.
        </PartBar>

        {/* Non-EU stacks the two awareness blocks; EU keeps them side by side. */}
        <div className={getRegion() !== "EU" ? "mt-5 grid gap-5" : "mt-5 grid gap-5 lg:grid-cols-2"}>
          {platformView ? (
          <AwarenessTable
            tagLabel="Platforms"
            title="Awareness of benefit platforms"
            description="Share of the base aware of at least one benefit in each platform, prompted (B2), counted once per person."
            info={
              <>
                Rolled up from B2 — "Which of these benefits, if any, are you aware of?" — a
                respondent counts toward a platform if they are aware of any of its benefits,
                once however many they picked. Every row shares the same filtered base.
                Multi-select, so rows do not sum to 100.
              </>
            }
            itemLabel="Benefits Platform"
            data={benefitAwareness.data}
            isLoading={benefitAwareness.isPending}
            error={benefitAwareness.error}
            onRetry={() => benefitAwareness.refetch()}
          />
          ) : (
          <AwarenessTable
            tagLabel="Benefits"
            title="Awareness of benefits"
            description="Share of the base aware of each benefit, prompted (B2). Every benefit shares the same base."
            hideSubcategory={view === "benefits"}
            info={
              <>
                B2 — "Which of these benefits, if any, are you aware of?" — asked of everyone
                about every benefit, so every row is a share of the same filtered base and
                the column is directly comparable top to bottom. Multi-select, so rows do not
                sum to 100 and a respondent counts in as many rows as they picked. Compare
                with the benefit ranking below: high awareness with low relevance is a benefit
                people know and do not want.
              </>
            }
            data={benefitAwareness.data}
            isLoading={benefitAwareness.isPending}
            error={benefitAwareness.error}
            onRetry={() => benefitAwareness.refetch()}
          />
          )}
          {!platformView && (
          <AwarenessTable
            tagLabel="Ingredients"
            title="Awareness of ingredients"
            description="Share of the base who linked each ingredient to at least one benefit (M2), counted once per person."
            info={
              <>
                Read off M2 against the <b>whole</b> filtered base, counting a respondent once
                however many benefits they linked the ingredient to. Because M2 is only asked
                about each respondent's own top-5 benefits, someone who knows an ingredient but
                never saw the benefit it belongs to cannot register here — so treat this as a
                floor on awareness rather than a measurement of it. The benefit-by-benefit view
                is the association matrix further down, which uses each benefit's own top-5
                base instead.
              </>
            }
            data={ingredientAwareness.data}
            isLoading={ingredientAwareness.isPending}
            error={ingredientAwareness.error}
            onRetry={() => ingredientAwareness.refetch()}
          />
          )}
        </div>
        </>)}

        {/* ── 02 MaxDiff ─────────────────────────────────────────────── */}
        <PartBar index={partNo.maxdiff} name="MaxDiff" method="Maximum Difference Scaling" tone="maxdiff">
          Each person saw {meta.data?.design.screens ?? 15} screens of{" "}
          {meta.data?.design.items_per_screen ?? 5} benefits and picked the most and least relevant
          on each. Those forced trade-offs are converted into a preference score per benefit —
          measuring how strongly each one appeals <em>on its own</em>.
        </PartBar>

        <div className="mt-5 grid gap-5">
          {showExtendedPanels && (
            <UtilityTable
              data={utilities.data}
              runMeta={meta.data?.run_meta}
              isLoading={utilities.isPending}
              error={utilities.error}
              onRetry={() => utilities.refetch()}
            />
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <BenefitRanking
              data={ranking.data}
              isLoading={ranking.isPending}
              error={ranking.error}
              onRetry={() => ranking.refetch()}
              lockedItems={lockedItems}
              appliedLockedItems={appliedLockedItems}
              portfolioItems={portfolioItems}
              onToggleLock={handleToggleLock}
            />
            <MarketHeatmap
              data={markets.data}
              isLoading={markets.isPending}
              error={markets.error}
              onRetry={() => markets.refetch()}
            />
          </div>

          {showExtendedPanels && (
            <BwTable
              data={bw.data}
              shareByItem={shareByItem}
              isLoading={bw.isPending}
              error={bw.error}
              onRetry={() => bw.refetch()}
            />
          )}
        </div>

        {showNeedStates && partNo.needStates && (
          <>
            <PartBar
              index={partNo.needStates}
              name="Need-state segments"
              method="Latent Class MNL"
              tone="latent"
            >
              Segments found from respondent-level preferences rather than the questionnaire's
              predefined benefit nets — a finite mixture of MNL models fitted by EM, so each class
              has its own full preference vector and every respondent carries a membership
              probability. Class count chosen by BIC.
            </PartBar>

            <div className="mt-5">
              <SegmentProfiles
                data={segments.data}
                shareByItem={shareByItem}
                itemOrder={itemOrder}
                isLoading={segments.isPending}
                error={segments.error}
                onRetry={() => segments.refetch()}
                activeK={draft.segmentK ?? bestK}
                appliedK={activeK}
                onSelectK={setSegmentK}
              />
            </div>
          </>
        )}

        {/* ── TURF ───────────────────────────────────────────────────── */}
        <PartBar index={partNo.turf} name="TURF" method="Total Unduplicated Reach & Frequency" tone="turf">
          MaxDiff ranks benefits one at a time; TURF asks which <em>combination</em> appeals to
          the most different people. Because reach is a union rather than a sum, the
          highest-scoring benefits are often not the widest-reaching set — two that appeal to
          the same crowd add little. Click a benefit in the ranking above to pin it and see what
          the optimiser builds around it.
        </PartBar>

        <TurfControls
          data={turf.data}
          meta={turfMeta.data}
          rule={draft.turf.rule}
          topN={draft.turf.topN}
          threshold={draft.turf.threshold}
          onChange={setTurfRule}
        />

        <div className="mt-5 grid gap-5">
          {/* Individual reach first: what each benefit does alone is the
              baseline the portfolio's incremental bars are read against, so
              it belongs before the combination, not after it. */}
          <IndividualReach
            data={turf.data}
            isLoading={turf.isPending}
            error={turf.error}
            onRetry={() => turf.refetch()}
          />
          <TurfPortfolio
            data={turf.data}
            isLoading={turf.isPending}
            error={turf.error}
            onRetry={() => turf.refetch()}
            pendingSize={draft.turf.size}
            pendingLocked={draft.turf.locked}
            onSelectSize={setTurfSize}
            onToggleLock={toggleLock}
            onClearLocks={clearLocks}
          />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
            <ReachCurve
              data={turf.data}
              isLoading={turf.isPending}
              error={turf.error}
              onRetry={() => turf.refetch()}
              pendingSize={draft.turf.size}
              onSelectSize={setTurfSize}
            />
            <TurfOverlap
              data={turf.data}
              isLoading={turf.isPending}
              error={turf.error}
              onRetry={() => turf.refetch()}
            />
          </div>
        </div>

        {showAssoc && (<>
        {/* ── Associations ───────────────────────────────────────────── */}
        <PartBar index={partNo.assoc} name="Benefit associations" method="Ingredients & Categories" tone="assoc">
          For each benefit, which ingredients (M2) and which beverage categories (M3) consumers
          link to it. Asked only of people who ranked that benefit in their personal top five, so
          bases vary by benefit. Low association on a high-importance benefit is the white space.
        </PartBar>

        <div className="mt-5 grid gap-5">
          <AssociationMatrix
            tagLabel="Ingredients"
            title={platformView ? "Benefits Platform → ingredient association" : "Benefit → ingredient association"}
            description="Share of people who linked each ingredient to the benefit. Rows ordered by benefit importance."
            data={ingredients.data}
            isLoading={ingredients.isPending}
            error={ingredients.error}
            onRetry={() => ingredients.refetch()}
          />
          <AssociationMatrix
            tagLabel="Categories"
            title={platformView ? "Benefits Platform → beverage category association" : "Benefit → beverage category association"}
            description="Share of people who named each category as delivering the benefit. Strong ownership shows as a dark cell; an important benefit with no dark cell is unclaimed territory."
            data={categories.data}
            isLoading={categories.isPending}
            error={categories.error}
            onRetry={() => categories.refetch()}
          />
        </div>
        </>)}
        </main>
      </div>
    </div>
  );
}
