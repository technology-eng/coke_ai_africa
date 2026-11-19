import { useState } from "react";
import { ChevronLeft, ChevronRight, Filter, Info, Lock, Play, RotateCcw, X } from "lucide-react";
import { Chip } from "@/components/dashboard/Chip";
import { CountryPicker } from "@/components/dashboard/CountryPicker";
import {
  AGE_LABELS,
  AREA_LABELS,
  GENDER_BANNER_LABELS,
  GENERATION_LABELS,
  INCOME_BAND_LABELS,
  labelFor,
} from "@/lib/codeLabels";
import { cn, formatCount, formatPeople } from "@/lib/utils";
import type { DashboardFilters, DemoKey } from "@/hooks/useDashboardFilters";
import type { MetaResponse } from "@/types/maxdiff";
import type { ReactNode } from "react";

/**
 * Left-hand control rail.
 *
 * Every panel on the page is driven from here, which is the point of block D:
 * because HB utilities are estimated per respondent, a demographic cut is a
 * subset-and-average, never a refit. Filtering re-queries; it does not
 * re-estimate.
 *
 * Nothing here takes effect until Save & Run. The rail is sticky and full
 * height so that button stays reachable while the reader is far down the page
 * pinning benefits into the TURF portfolio — those stage here too.
 */
export function FilterSidebar({
  meta,
  draft,
  activeCount,
  filteredN,
  isDirty,
  isFetching,
  collapsed,
  onCollapsedChange,
  onToggle,
  onToggleSubcategory,
  onSetDemo,
  onSegment,
  showSegmentFilter,
  showSubcategoryFilter = true,
  onClear,
  onApply,
  onDiscard,
  onClearLocks,
  lockedLabels,
}: {
  meta?: MetaResponse;
  draft: DashboardFilters;
  activeCount: number;
  filteredN?: number;
  isDirty: boolean;
  isFetching: boolean;
  collapsed: boolean;
  onCollapsedChange: (next: boolean) => void;
  onToggle: (key: DemoKey, value: number) => void;
  onToggleSubcategory: (value: string) => void;
  onSetDemo: (key: DemoKey, values: number[]) => void;
  onSegment: (k: number | null, index: number | null) => void;
  /** Need-state chips render only for the accounts that also see the segments
   *  panel — the classes are meaningless without the profiles that name them. */
  showSegmentFilter: boolean;
  /** False on the ASP Benefits Dashboard, which shows no platforms. */
  showSubcategoryFilter?: boolean;
  onClear: () => void;
  onApply: () => void;
  onDiscard: () => void;
  onClearLocks: () => void;
  lockedLabels: string[];
}) {
  const [showInfo, setShowInfo] = useState(false);
  const values = meta?.filter_values;
  const activeK =
    draft.segmentK ?? meta?.segments.find((g) => g.is_best_k)?.k ?? meta?.segments[0]?.k ?? null;
  const segmentGroup = meta?.segments.find((g) => g.k === activeK);
  const shown = filteredN ?? meta?.filtered_n;
  const thin = shown !== undefined && shown < 100;
  const population = meta?.population;

  if (collapsed) {
    return (
      <aside className="sticky top-16 flex h-[calc(100vh-4rem)] w-12 shrink-0 flex-col items-center gap-3 border-r bg-card py-4">
        <button
          onClick={() => onCollapsedChange(false)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Show filters"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="relative">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {activeCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-coke-red px-1 font-mono text-[9px] text-white">
              {activeCount}
            </span>
          )}
        </div>
        {isDirty && (
          <button
            onClick={onApply}
            className="mt-1 rounded-md bg-coke-red p-1.5 text-white hover:bg-coke-deep"
            title="Unapplied changes — Save & Run"
          >
            <Play className="h-3.5 w-3.5" />
          </button>
        )}
      </aside>
    );
  }

  return (
    <aside className="sticky top-16 flex h-[calc(100vh-4rem)] w-[268px] shrink-0 flex-col border-r bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-coke-red" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-widest">
            Filters
          </span>
          {activeCount > 0 && (
            <span className="rounded-full bg-coke-red px-1.5 font-mono text-[9px] leading-4 text-white">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowInfo((v) => !v)}
            aria-expanded={showInfo}
            aria-label="How filtering works"
            title="How filtering works"
            className={
              showInfo
                ? "rounded-md p-1 text-coke-red"
                : "rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-coke-red"
            }
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onCollapsedChange(true)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Collapse"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showInfo && (
        <div className="border-b border-l-2 border-l-coke-red bg-muted/50 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          Nothing here applies until <b>Save &amp; Run</b>, so you can build a whole cut — market,
          age, income — and pay for one round trip instead of three. Benefits you pin in the
          MaxDiff ranking stage here too. Filtering never refits a model: utilities are estimated
          per respondent, so a cut is a subset-and-average.
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {/* GLOBAL only. Operating units are shortcuts over the country picker:
            none lit means every country; picking one selects its countries,
            picking more adds theirs. Nothing applies until Save & Run. */}
        {!!meta?.subregions?.length && (
          <Group label="Operating Unit">
            {meta.subregions.map((r) => {
              // Like every other chip: nothing lit means no filter (all countries).
              const picked = draft.demo.market;
              const active = picked.length > 0 && r.markets.every((m) => picked.includes(m));
              const partial = !active && r.markets.some((m) => picked.includes(m));
              const next = active
                ? picked.filter((m) => !r.markets.includes(m))
                : [...picked, ...r.markets];
              return (
                <Chip
                  key={r.code}
                  active={active}
                  partial={partial}
                  onClick={() => onSetDemo("market", next)}
                  title={`${r.label} — ${r.markets.length} ${r.markets.length > 1 ? "countries" : "country"}`}
                >
                  {r.label}
                </Chip>
              );
            })}
          </Group>
        )}

        {!!meta?.subregions?.length && (
          <Group label="Country">
            <CountryPicker
              countries={meta.markets}
              units={meta.subregions}
              value={draft.demo.market}
              onChange={(next) => onSetDemo("market", next)}
            />
          </Group>
        )}

        {meta && !meta.subregions?.length && (
          <Group label="Market">
            {/* "No market picked" is the whole OU; this makes it a button of its
                own, lit when nothing else is, and clearing the picks when pressed. */}
            <Chip
              active={draft.demo.market.length === 0}
              onClick={() => onSetDemo("market", [])}
              title={`All ${meta.markets.length} markets`}
            >
              Total OU
            </Chip>
            {meta.markets.map((m) => (
              <Chip
                key={m.code}
                active={draft.demo.market.includes(m.code)}
                onClick={() => onToggle("market", m.code)}
                title={`${m.name} — ${formatCount(m.achieved_n)} achieved`}
              >
                {m.name}
              </Chip>
            ))}
          </Group>
        )}

        {/* GLOBAL only. Narrows the benefits shown, not the respondents. */}
        {showSubcategoryFilter && !!meta?.subcategories?.length && (
          <Group label="Benefits Platform">
            {meta.subcategories.map((s) => (
              <Chip
                key={s.label}
                active={draft.subcategory.includes(s.label)}
                onClick={() => onToggleSubcategory(s.label)}
                title={s.items.join(" · ")}
              >
                {s.label}
              </Chip>
            ))}
          </Group>
        )}

        {values?.generation?.length > 0 && (
          <Group label="Generation">
            {values.generation.map((c) => (
              <Chip
                key={c}
                active={draft.demo.generation.includes(c)}
                onClick={() => onToggle("generation", c)}
              >
                {labelFor(GENERATION_LABELS, c)}
              </Chip>
            ))}
          </Group>
        )}

        {values?.gender?.length > 0 && (
          <Group
            label="Gender"
            hint="Banner collapse: Male vs Female+Other. 'Prefer not to say' is unmapped and drops out of any gender cut."
          >
            {values.gender.map((c) => (
              <Chip
                key={c}
                active={draft.demo.gender.includes(c)}
                onClick={() => onToggle("gender", c)}
              >
                {labelFor(GENDER_BANNER_LABELS, c)}
              </Chip>
            ))}
          </Group>
        )}

        {values?.age?.length > 0 && (
          <Group label="Age">
            {values.age.map((c) => (
              <Chip key={c} active={draft.demo.age.includes(c)} onClick={() => onToggle("age", c)}>
                {labelFor(AGE_LABELS, c)}
              </Chip>
            ))}
          </Group>
        )}

        {values?.income?.length > 0 && (
          <Group
            label="Income"
            hint="Low/Medium/High band. The raw income ladder is market-specific and not comparable across markets."
            note={
              meta?.income_missing_markets?.length
                ? `No income data for ${meta.income_missing_markets.join(", ")}. An income filter leaves these markets out.`
                : undefined
            }
          >
            {values.income.map((c) => (
              <Chip
                key={c}
                active={draft.demo.income.includes(c)}
                onClick={() => onToggle("income", c)}
              >
                {labelFor(INCOME_BAND_LABELS, c)}
              </Chip>
            ))}
          </Group>
        )}

        {values?.area?.length > 0 && (
          <Group label="Area">
            {values.area.map((c) => (
              <Chip
                key={c}
                active={draft.demo.area.includes(c)}
                onClick={() => onToggle("area", c)}
              >
                {labelFor(AREA_LABELS, c)}
              </Chip>
            ))}
          </Group>
        )}

        {showSegmentFilter && segmentGroup && segmentGroup.segments.length > 0 && (
          <Group
            label={`Need-state (K=${activeK})`}
            hint="Latent Class membership. Selecting one drives every panel from that class."
          >
            {segmentGroup.segments.map((s) => (
              <Chip
                key={s.index}
                active={draft.segmentIndex === s.index && draft.segmentK === activeK}
                onClick={() =>
                  draft.segmentIndex === s.index && draft.segmentK === activeK
                    ? onSegment(null, null)
                    : onSegment(activeK, s.index)
                }
                title={
                  s.top_by_share?.length ? `Strongest: ${s.top_by_share.join(" · ")}` : undefined
                }
              >
                {s.label}
                {s.size_pct != null && (
                  <span className="ml-1 opacity-60">{s.size_pct.toFixed(0)}%</span>
                )}
              </Chip>
            ))}
          </Group>
        )}

        {/* Benefits pinned from the ranking. Shown here because that is where
            the Save & Run button is — otherwise a reader pins something far
            down the page and has no idea it is waiting to be applied. */}
        {lockedLabels.length > 0 && (
          <Group label={`Pinned for TURF (${lockedLabels.length})`}>
            <div className="w-full space-y-1">
              {lockedLabels.map((l) => (
                <div
                  key={l}
                  className="flex items-start gap-1.5 rounded-sm bg-coke-red/[0.07] px-1.5 py-1 text-[11px] leading-snug"
                >
                  <Lock className="mt-0.5 h-2.5 w-2.5 shrink-0 text-coke-red" />
                  <span className="min-w-0 flex-1">{l}</span>
                </div>
              ))}
              <button
                onClick={onClearLocks}
                className="flex items-center gap-1 pt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-coke-red"
              >
                <RotateCcw className="h-2.5 w-2.5" /> release all
              </button>
            </div>
          </Group>
        )}

      </div>

      <div className="space-y-2.5 border-t px-4 py-3">
        <div
          className={cn(
            "font-mono text-[11px]",
            thin ? "text-destructive" : "text-muted-foreground"
          )}
        >
          Base <b className="text-foreground">{formatCount(shown)}</b> of{" "}
          {formatCount(meta?.total_n)}
          {isDirty && <span className="ml-1 opacity-70">(before pending changes)</span>}
        </div>

        {/* The people those respondents stand for. Sits directly under the base
            so the sample size and the population it projects onto are read as
            one fact, and so every headcount elsewhere on the page has a visible
            denominator. */}
        {population?.filtered != null && (
          <div
            className="font-mono text-[11px] text-muted-foreground"
            title={
              `${population.filtered.toLocaleString()} people of ` +
              `${population.universe?.toLocaleString() ?? "?"} in the markets in scope.\n\n` +
              `${population.source}.\n${population.basis}`
            }
          >
            Represents{" "}
            <b className="text-coke-red">{formatPeople(population.filtered)}</b> people
            {population.universe != null && population.universe !== population.filtered && (
              <> of {formatPeople(population.universe)}</>
            )}
          </div>
        )}

        {!!population?.markets_without_population?.length && (
          <div className="font-mono text-[10px] leading-relaxed text-destructive">
            No population figure for {population.markets_without_population.join(", ")} — the
            headcounts exclude {population.markets_without_population.length > 1 ? "them" : "it"}.
          </div>
        )}

        <button
          onClick={onApply}
          disabled={!isDirty || isFetching}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-widest transition-colors",
            isDirty
              ? "bg-coke-red text-white hover:bg-coke-deep"
              : "cursor-default border bg-muted/50 text-muted-foreground"
          )}
          title={
            isDirty
              ? "Send the staged filters to the server and refresh every panel"
              : "Everything on screen reflects the current filters"
          }
        >
          <Play className="h-3 w-3" />
          {isFetching ? "Running…" : isDirty ? "Save & Run" : "Saved"}
        </button>

        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest">
          <button
            onClick={onClear}
            disabled={activeCount === 0}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-coke-red disabled:opacity-40 disabled:hover:text-muted-foreground"
          >
            <X className="h-2.5 w-2.5" /> clear all
          </button>
          {isDirty && (
            <button onClick={onDiscard} className="text-muted-foreground hover:text-coke-red">
              discard changes
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

function Group({
  label,
  hint,
  note,
  children,
}: {
  label: string;
  hint?: string;
  /** Shown under the chips behind an info icon, for caveats the reader must not miss. */
  note?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div
        className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
        title={hint}
      >
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
      {note && (
        <p className="mt-1.5 flex gap-1 text-[11px] leading-snug text-muted-foreground">
          <Info className="mt-[1px] h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{note}</span>
        </p>
      )}
    </div>
  );
}
