import { Lock, LockOpen } from "lucide-react";
import { brandColorName, isPlatformView } from "@/lib/region";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { PanelEmpty, PanelError, PanelLoading, ThinBaseNotice } from "@/components/dashboard/States";
import { cn, formatCount, formatNumber } from "@/lib/utils";
import type { RankingResponse } from "@/types/maxdiff";

/**
 * Preference share for the filtered group, ordered.
 *
 * Bars are scaled to the top benefit rather than to 100, because shares over
 * the shares of two dozen items top out around 8% and a 0–100 axis would render every bar as a
 * sliver. The number column carries the absolute value.
 *
 * Rows are also the TURF control. Clicking one pins that benefit into the
 * portfolio below and the optimiser re-solves around it, which usually returns
 * a different set rather than the same set with one item swapped — a pinned
 * benefit covers people the others no longer need to.
 *
 * Statements, not indices, cross this boundary: this panel renders text and
 * has no reason to know the canonical item order. The page owns that mapping.
 */
export function BenefitRanking({
  data,
  isLoading,
  error,
  onRetry,
  lockedItems,
  appliedLockedItems,
  portfolioItems,
  onToggleLock,
}: {
  data?: RankingResponse;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  /** Pins the user has made — including ones not yet applied. */
  lockedItems?: Set<string>;
  /** Pins the displayed portfolio was actually solved with. */
  appliedLockedItems?: Set<string>;
  /** Benefit statements in the current best portfolio, pinned or not. */
  portfolioItems?: Set<string>;
  onToggleLock?: (item: string) => void;
}) {
  const max = data?.rows?.length ? Math.max(...data.rows.map((r) => r.preference_share)) : 1;
  const interactive = Boolean(onToggleLock);
  // The count comes from the data: each study has its own number of items.
  const noun = isPlatformView() ? "platforms" : "benefits";
  const allItems = data?.rows?.length ? `all ${data.rows.length} ${noun}` : `all ${noun}`;

  return (
    <SectionCard
      tag="maxdiff"
      tagLabel="MaxDiff"
      title={isPlatformView() ? "Benefits Platform ranking" : "Benefit ranking"}
      description={
        interactive ? (
          <>
            Preference share for the filtered group. Shares sum to 100 across {allItems}, so
            they measure relative appeal, not the proportion of people who want each one.{" "}
            <b>Click any benefit to pin it into the TURF portfolio below.</b>
          </>
        ) : (
          `Preference share for the filtered group. Shares sum to 100 across ${allItems}, so they measure relative appeal, not the proportion of people who want each one.`
        )
      }
      info={
        <>
          Preference share, ordered. Bars scale to the top benefit rather than to 100, because
          shares spread across {allItems} stay far below 100 and a 0–100 axis would render every bar as a
          sliver. <b>Click any row to pin that benefit into the TURF portfolio</b> — the pin
          stages in the filter rail and takes effect on Save &amp; Run. <span className="capitalize">{brandColorName()}</span> bars are benefits in
          the current portfolio; ranking high and reaching widely are different things.
        </>
      }
      footnote={
        data && (
          <>
            Base n = {formatCount(data.base_n)}.
            {interactive && (
              <>
                {" "}
                <b className="text-foreground">Bold + tinted</b> = in the portfolio shown below.{" "}
                <Lock className="inline h-2.5 w-2.5 text-coke-red" /> = pinned and applied.{" "}
                <LockOpen className="inline h-2.5 w-2.5" /> = pinned but not run yet — press
                Save &amp; Run. The two are independent: ranking high and reaching widely are
                different things, so a benefit can lead this table and still add nothing to a
                portfolio that already covers its audience.
              </>
            )}
          </>
        )
      }
    >
      {isLoading && <PanelLoading rows={10} />}
      {error && <PanelError error={error} onRetry={onRetry} />}
      {!isLoading && !error && data && data.base_n === 0 && (
        <PanelEmpty>{data.warning ?? "No respondents match this filter."}</PanelEmpty>
      )}

      {!isLoading && !error && data && data.base_n > 0 && (
        <>
          {data.thin_base && <ThinBaseNotice n={data.base_n} />}
          <div className="space-y-px">
            {data.rows.map((r) => {
              const locked = lockedItems?.has(r.item) ?? false;
              const inPortfolio = portfolioItems?.has(r.item) ?? false;
              // A pin the user has made but not yet run. Distinguishing this
              // matters: otherwise a pinned row that is NOT bold looks like
              // the optimiser rejected the pin, when really nobody has asked
              // the server yet.
              const pinPending = locked && !(appliedLockedItems?.has(r.item) ?? false);
              const Row = interactive ? "button" : "div";
              return (
                <Row
                  key={r.item}
                  {...(interactive
                    ? {
                        type: "button" as const,
                        onClick: () => onToggleLock?.(r.item),
                        "aria-pressed": locked,
                        title: pinPending
                          ? `${r.item} — pinned, but not applied yet. Press Save & Run to re-solve.`
                          : locked
                            ? `${r.item} — pinned into the portfolio. Click to release.`
                            : `Click to pin "${r.item}" into the TURF portfolio.`,
                      }
                    : {})}
                  className={cn(
                    "grid w-full grid-cols-[26px_1fr_150px_52px] items-center gap-2.5 rounded-sm py-[3px] text-left",
                    interactive && "cursor-pointer hover:bg-muted",
                    !interactive && "hover:bg-muted",
                    inPortfolio && "bg-coke-red/[0.06]"
                  )}
                >
                  <div className="text-right font-mono text-[10.5px] text-muted-foreground">
                    {r.rank}
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-1.5 truncate text-[12.5px] leading-tight",
                      inPortfolio && "font-semibold"
                    )}
                    title={r.item}
                  >
                    {locked &&
                      (pinPending ? (
                        <LockOpen className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                      ) : (
                        <Lock className="h-2.5 w-2.5 shrink-0 text-coke-red" />
                      ))}
                    <span className="truncate">{r.item}</span>
                  </div>
                  <div className="h-[11px] rounded-sm bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-sm transition-[width] duration-300",
                        inPortfolio ? "bg-viz-pos" : "bg-viz-bar"
                      )}
                      style={{ width: `${(r.preference_share / max) * 100}%` }}
                    />
                  </div>
                  <div className="text-right font-mono text-[11.5px]">
                    {formatNumber(r.preference_share, 1)}
                  </div>
                </Row>
              );
            })}
          </div>
        </>
      )}
    </SectionCard>
  );
}
