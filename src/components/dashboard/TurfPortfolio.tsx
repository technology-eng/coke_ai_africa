import { AlertTriangle, Lock, RotateCcw } from "lucide-react";
import { isPlatformView } from "@/lib/region";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Chip } from "@/components/dashboard/Chip";
import { PanelEmpty, PanelError, PanelLoading, ThinBaseNotice } from "@/components/dashboard/States";
import { formatCount, formatNumber, formatPeople, formatSigned } from "@/lib/utils";
import type { TurfResponse } from "@/types/maxdiff";

/**
 * Block H — the best-reaching combination of benefits at the chosen size.
 *
 * The bars show INCREMENTAL reach, not each benefit's own appeal, and that is
 * the whole point of the panel. A benefit can reach 36% of people on its own
 * and still contribute 12 points here, because most of the people it reaches
 * were already covered by something above it. Reading these bars as popularity
 * is the single easiest way to misuse a TURF, so both numbers are shown.
 */
export function TurfPortfolio({
  data,
  isLoading,
  error,
  onRetry,
  pendingSize,
  pendingLocked,
  onSelectSize,
  onToggleLock,
  onClearLocks,
}: {
  data?: TurfResponse;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  /** Staged size/locks — controls reflect these, the numbers reflect applied. */
  pendingSize?: number;
  pendingLocked?: number[];
  onSelectSize: (k: number) => void;
  onToggleLock: (index: number) => void;
  onClearLocks: () => void;
}) {
  const p = data?.portfolio;
  const pop = data?.population?.filtered ?? null;
  const rows = p?.waterfall ?? [];
  const maxInc = rows.length ? Math.max(...rows.map((r) => r.incremental_reach), 1) : 1;
  const sizes = data ? data.curve.map((c) => c.k) : [];
  const stagedSize = pendingSize ?? data?.size;
  const stagedLocks = pendingLocked ?? data?.locked ?? [];
  const lockCount = stagedLocks.length;
  const pending =
    !!data && (stagedSize !== data.size ||
      stagedLocks.join(",") !== (data.locked ?? []).join(","));

  const showSub = Object.values(data?.item_subcategory ?? {}).some(Boolean);
  return (
    <SectionCard
      tag="turf"
      tagLabel="TURF"
      title="Optimal portfolio"
      description={
        <>
          The combination reaching the most different people at the selected size. Each bar is
          the <b>new</b> reach that benefit adds on top of the ones above it — not how much
          people like it.
        </>
      }
      actions={
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
            title="How many benefits the portfolio carries. Independent of the reach rule above — a portfolio of any size is scored against each respondent's own top N."
          >
            Portfolio size
          </span>
          {sizes.map((k) => (
            <Chip
              key={k}
              active={stagedSize === k}
              onClick={() => onSelectSize(k)}
              disabled={k < lockCount}
              title={
                k < lockCount
                  ? `Smaller than the ${lockCount} pinned benefits`
                  : `Best portfolio of ${k}`
              }
            >
              {k}
            </Chip>
          ))}
          {lockCount > 0 && (
            <button
              type="button"
              onClick={onClearLocks}
              className="ml-1 flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-muted"
              title="Release all pinned benefits and re-solve without constraints"
            >
              <RotateCcw className="h-3 w-3" />
              {lockCount} pinned
            </button>
          )}
        </div>
      }
      info={
        <>
          The combination of benefits reaching the most different people — reach is a union, so
          two benefits that appeal to the same crowd add little. Bars are{" "}
          <b>incremental reach</b>: what each benefit adds beyond the ones above it, with a ghost
          bar behind showing what it reaches alone. The gap between them is how much was already
          covered. <b>Size</b> chips set the portfolio size and clicking a benefit pins it, so
          the optimiser solves around your commitments; both stage until Save &amp; Run.
        </>
      }
      footnote={
        data?.rule && (
          <>
            Base n = {formatCount(data.base_n)}. Reached means {data.rule.description} — a
            property of each respondent, not of the portfolio, so the two numbers are
            independent: a portfolio of {data.portfolio?.size ?? data.size} is scored against
            everyone's own top {data.rule.top_n}. On this base the average person is reached by{" "}
            {formatNumber(data.rule.mean_items_reaching, 1)} of the {data.items.length}{" "}
            benefits, and frequency cannot exceed {data.rule.top_n} for the same reason.
            {p && !p.exhaustive && (
              <>
                {" "}
                This size is solved by a greedy search with swap repair rather than
                exhaustively, so it is strong but not provably optimal.
              </>
            )}
            {!!data.incomplete_dropped && (
              <>
                {" "}
                {formatCount(data.incomplete_dropped)} respondents were dropped for having an
                incomplete utility vector.
              </>
            )}
            {pop != null && (
              <>
                {" "}
                Headcounts are each percentage applied to the{" "}
                <b>{formatPeople(pop)}</b> people this cut represents —{" "}
                {data.population?.source ?? "UN population estimates"}, scaled market by market
                by the survey's own composition. The percentages themselves are unweighted, so
                the two always reconcile.
              </>
            )}
          </>
        )
      }
    >
      {isLoading && <PanelLoading rows={8} />}
      {error && <PanelError error={error} onRetry={onRetry} />}
      {!isLoading && !error && data && data.base_n === 0 && (
        <PanelEmpty>{data.warning ?? "No respondents match this filter."}</PanelEmpty>
      )}

      {!isLoading && !error && data && p && data.base_n > 0 && (
        <>
          {data.thin_base && <ThinBaseNotice n={data.base_n} />}

          {pending && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-coke-red/40 bg-coke-red/[0.06] px-3 py-2 text-[11.5px] leading-relaxed">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-coke-red" />
              <div>
                <b>Staged, not applied.</b> The portfolio below is still the last one you ran
                — {data.size} benefits{data.locked.length ? `, ${data.locked.length} pinned` : ""}.
                Press <b>Save &amp; Run</b> in the filter rail to re-solve.
              </div>
            </div>
          )}

          {/* Each percentage carries the headcount it represents. A reach of
              89% is an abstraction; 133m people is the size of the prize, and
              it is what a portfolio decision is actually argued over. */}
          <div className="mb-5 flex flex-wrap items-end gap-x-11 gap-y-4">
            <Kpi
              value={`${formatNumber(p.reach, 1)}%`}
              label="Total reach"
              sub={peopleLabel(p.reach_people)}
              hint={exactPeople(p.reach_people, pop)}
            />
            <Kpi
              value={formatNumber(p.frequency, 2)}
              label="Avg. benefits per person reached"
              hint="Counted only among people the portfolio reaches at all, so it never dips below 1."
            />
            <Kpi
              value={`${formatNumber(data.baseline.reach, 1)}%`}
              label="Reach from the top-scoring benefits"
              sub={peopleLabel(data.baseline.reach_people)}
              hint={`The ${data.size} highest-ranked benefits: ${data.baseline.labels.join(" · ")}`}
            />
            <Kpi
              value={`${formatSigned(data.gain_vs_baseline_pts, 1)}pts`}
              label="Gain from optimising"
              tone={data.gain_vs_baseline_pts >= 0 ? "pos" : "neg"}
              sub={
                data.gain_vs_baseline_people == null
                  ? undefined
                  : `${data.gain_vs_baseline_people >= 0 ? "+" : "−"}${formatPeople(
                      Math.abs(data.gain_vs_baseline_people)
                    )} people`
              }
              hint={
                data.gain_vs_baseline_pts < 0
                  ? "Negative because pinned benefits are forcing a portfolio that reaches fewer people than simply taking the top-ranked ones."
                  : "Extra people reached by optimising the combination instead of taking the highest-ranked benefits."
              }
            />
          </div>

          {showSub && (
            <div className="grid grid-cols-[26px_150px_1fr_170px_58px_72px] gap-2.5 pb-1 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
              <div /><div>Benefits Platform</div><div>Benefit</div><div /><div /><div />
            </div>
          )}
          {isPlatformView() && (
            <div className="grid grid-cols-[26px_1fr_170px_58px_72px] gap-2.5 pb-1 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
              <div /><div>Benefits Platform</div><div /><div /><div />
            </div>
          )}
          <div className="space-y-px border-t pt-3">
            {rows.map((r, i) => (
              <div
                key={r.item_index}
                className={showSub ? "grid grid-cols-[26px_150px_1fr_170px_58px_72px] items-center gap-2.5 rounded-sm py-[3px] hover:bg-muted" : "grid grid-cols-[26px_1fr_170px_58px_72px] items-center gap-2.5 rounded-sm py-[3px] hover:bg-muted"}
              >
                <div className="text-right font-mono text-[10.5px] text-muted-foreground">
                  {i + 1}
                </div>
{showSub && <div className="truncate text-[12.5px] leading-tight" title={data?.item_subcategory?.[r.item] ?? undefined}>{data?.item_subcategory?.[r.item] ?? "—"}</div>}
                <button
                  type="button"
                  onClick={() => onToggleLock(r.item_index)}
                  className="flex items-center gap-1.5 truncate text-left text-[12.5px] leading-tight hover:underline"
                  title={
                    r.locked
                      ? "Pinned — click to release and let the optimiser choose freely"
                      : `Reaches ${formatNumber(r.own_reach, 1)}% on its own` +
                        (r.own_people != null
                          ? ` (${r.own_people.toLocaleString()} people)`
                          : "") +
                        `. Click to pin it into the portfolio.`
                  }
                >
                  <span className="truncate">{r.item}</span>
                  {r.locked && (
                    <span className="flex shrink-0 items-center gap-0.5 rounded-sm bg-coke-red/15 px-1 font-mono text-[9px] uppercase tracking-wider text-coke-red">
                      <Lock className="h-2.5 w-2.5" />
                      pinned
                    </span>
                  )}
                </button>
                <div
                  className="relative h-[11px] rounded-sm bg-muted"
                  title={
                    `Adds ${formatNumber(r.incremental_reach, 1)} pts of new reach` +
                    (r.incremental_people != null
                      ? ` (${r.incremental_people.toLocaleString()} people)`
                      : "") +
                    ` · reaches ${formatNumber(r.own_reach, 1)}% on its own · ` +
                    `${formatNumber(r.cumulative_reach, 1)}% cumulative`
                  }
                >
                  {/* Ghost bar: own reach, so the gap between the two shows how
                      much of this benefit's appeal was already covered. */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm bg-viz-bar/40"
                    style={{ width: `${Math.min((r.own_reach / maxInc) * 100, 100)}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm bg-viz-pos transition-[width] duration-300"
                    style={{ width: `${(r.incremental_reach / maxInc) * 100}%` }}
                  />
                </div>
                <div className="text-right font-mono text-[11.5px] text-viz-pos">
                  +{formatNumber(r.incremental_reach, 1)}
                </div>
                {/* The same increment as people — what this slot on the pack
                    actually buys, which is the number a portfolio argument is
                    made in. */}
                <div
                  className="text-right font-mono text-[11px] text-muted-foreground"
                  title={
                    r.incremental_people != null
                      ? `${r.incremental_people.toLocaleString()} people reached by this benefit and nothing above it`
                      : undefined
                  }
                >
                  {r.incremental_people == null ? "" : formatPeople(r.incremental_people)}
                </div>
              </div>
            ))}
          </div>

          {(data.swaps.out.length > 0 || data.swaps.in.length > 0) && (
            <p className="mt-4 border-t pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
              TURF drops <Names of={data.swaps.out} /> — strong individually, but they appeal to
              people already covered — in favour of <Names of={data.swaps.in} />, which bring in
              people nothing else reaches.
            </p>
          )}
          {data.swaps.out.length === 0 && data.swaps.in.length === 0 && (
            <p className="mt-4 border-t pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
              At this size the widest-reaching combination is also the {data.size}{" "}
              highest-scoring benefits — the rankings and the portfolio agree, so there is
              nothing to trade.
            </p>
          )}
        </>
      )}
    </SectionCard>
  );
}

/** "133.3m people", or nothing when the projection is unavailable. */
function peopleLabel(value: number | null | undefined): string | undefined {
  return value == null ? undefined : `${formatPeople(value)} people`;
}

/** Exact figure plus its denominator, for the tooltip — the compact display
 *  rounds, and anyone reconciling against a deck needs the full number. */
function exactPeople(value: number | null | undefined, pop: number | null): string | undefined {
  if (value == null) return undefined;
  const of = pop != null ? ` of ${pop.toLocaleString()} in this cut` : "";
  return `${value.toLocaleString()} people${of}`;
}

function Names({ of }: { of: string[] }) {
  if (!of.length) return <>nothing</>;
  return (
    <>
      {of.map((n, i) => (
        <span key={n}>
          {i > 0 && (i === of.length - 1 ? " and " : ", ")}
          <b className="text-foreground">{n}</b>
        </span>
      ))}
    </>
  );
}

function Kpi({
  value,
  label,
  hint,
  tone,
  sub,
}: {
  value: string;
  label: string;
  hint?: string;
  tone?: "pos" | "neg";
  /** The headcount the percentage represents. Sits between the figure and its
   *  label so it reads as the same fact restated, not as a second metric. */
  sub?: string;
}) {
  return (
    <div title={hint}>
      <div
        className={
          tone === "neg"
            ? "font-mono text-[30px] font-semibold leading-none tracking-tight text-viz-pos"
            : "font-mono text-[30px] font-semibold leading-none tracking-tight"
        }
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 font-mono text-[11px] font-semibold leading-none text-coke-red">
          {sub}
        </div>
      )}
      <div className="mt-1.5 font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
