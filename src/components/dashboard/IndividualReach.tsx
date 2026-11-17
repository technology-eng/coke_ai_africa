import { Lock } from "lucide-react";
import { isPlatformView } from "@/lib/region";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { PanelEmpty, PanelError, PanelLoading, ThinBaseNotice } from "@/components/dashboard/States";
import { formatCount, formatNumber, formatPeople } from "@/lib/utils";
import type { TurfResponse } from "@/types/maxdiff";

/**
 * Each benefit's reach on its own, before any combining — the same quantity
 * behind the optimal portfolio's ghost bars, but for every benefit rather
 * than just the ones the current portfolio happens to include.
 *
 * Sits ABOVE the portfolio deliberately. Individual reach is the baseline the
 * portfolio's incremental bars are read against: a benefit can lead this table
 * and still add almost nothing to a combination, because its reach overlaps
 * with whatever is already picked. Showing the standalone numbers first makes
 * that drop legible rather than surprising.
 */
export function IndividualReach({
  data,
  isLoading,
  error,
  onRetry,
}: {
  data?: TurfResponse;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const items = data?.items ?? [];
  const portfolioItems = new Set(data?.portfolio?.items ?? []);
  const lockedItems = new Set(data?.locked ?? []);
  const rows = items
    .map((item, index) => ({
      index,
      item,
      reach: data?.own_reach?.[item] ?? 0,
      people: data?.own_reach_people?.[item] ?? null,
    }))
    .sort((a, b) => b.reach - a.reach);
  const maxReach = rows.length ? Math.max(...rows.map((r) => r.reach), 1) : 1;

  const showSub = Object.values(data?.item_subcategory ?? {}).some(Boolean);
  return (
    <SectionCard
      tag="turf"
      tagLabel="TURF"
      title="Individual reach"
      description="Share of people each benefit reaches on its own, ranked highest to lowest — independent of portfolio size."
      info={
        <>
          Every benefit's own reach — the same number the optimal portfolio's ghost bars draw on
          — shown here for all {items.length} rather than just the ones currently selected.{" "}
          <b>In portfolio</b> marks benefits the optimiser picked at the current size; a benefit
          can reach the most people alone and still be left out, because its reach overlaps with
          benefits already in the set. That gap between reaching people and <em>adding</em>
          people is what the portfolio below resolves.
        </>
      }
      footnote={
        data?.rule && (
          <>Base n = {formatCount(data.base_n)}. Reached means {data.rule.description}.</>
        )
      }
    >
      {isLoading && <PanelLoading rows={8} />}
      {error && <PanelError error={error} onRetry={onRetry} />}
      {!isLoading && !error && data && data.base_n === 0 && (
        <PanelEmpty>{data.warning ?? "No respondents match this filter."}</PanelEmpty>
      )}

      {!isLoading && !error && data && data.base_n > 0 && (
        <>
          {data.thin_base && <ThinBaseNotice n={data.base_n} />}
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
            {rows.map((r, i) => {
              const inPortfolio = portfolioItems.has(r.index);
              return (
                <div
                  key={r.index}
                  className={showSub ? "grid grid-cols-[26px_150px_1fr_170px_58px_72px] items-center gap-2.5 rounded-sm py-[3px] hover:bg-muted" : "grid grid-cols-[26px_1fr_170px_58px_72px] items-center gap-2.5 rounded-sm py-[3px] hover:bg-muted"}
                >
                  <div className="text-right font-mono text-[10.5px] text-muted-foreground">
                    {i + 1}
                  </div>
{showSub && <div className="truncate text-[12.5px] leading-tight" title={data?.item_subcategory?.[r.item] ?? undefined}>{data?.item_subcategory?.[r.item] ?? "—"}</div>}
                  <div className="flex items-center gap-1.5 truncate text-left text-[12.5px] leading-tight">
                    <span className="truncate">{r.item}</span>
                    {inPortfolio && (
                      <span
                        className="flex shrink-0 items-center gap-0.5 rounded-sm bg-viz-pos/15 px-1 font-mono text-[9px] uppercase tracking-wider text-viz-pos"
                        title="In the current optimal portfolio"
                      >
                        {lockedItems.has(r.index) && <Lock className="h-2.5 w-2.5" />}
                        in portfolio
                      </span>
                    )}
                  </div>
                  <div
                    className="relative h-[11px] rounded-sm bg-muted"
                    title={
                      `Reaches ${formatNumber(r.reach, 1)}% on its own` +
                      (r.people != null ? ` (${r.people.toLocaleString()} people)` : "")
                    }
                  >
                    <div
                      className={
                        inPortfolio
                          ? "absolute inset-y-0 left-0 rounded-sm bg-viz-pos"
                          : "absolute inset-y-0 left-0 rounded-sm bg-viz-bar/60"
                      }
                      style={{ width: `${(r.reach / maxReach) * 100}%` }}
                    />
                  </div>
                  <div className="text-right font-mono text-[11.5px]">
                    {formatNumber(r.reach, 1)}%
                  </div>
                  <div className="text-right font-mono text-[11px] text-muted-foreground">
                    {r.people == null ? "" : formatPeople(r.people)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </SectionCard>
  );
}
