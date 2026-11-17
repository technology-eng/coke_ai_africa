import { useState } from "react";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { PanelEmpty, PanelError, PanelLoading } from "@/components/dashboard/States";
import { Button } from "@/components/ui/button";
import { divergingCell, formatCount, formatNumber, formatSigned } from "@/lib/utils";
import type { MarketsResponse } from "@/types/maxdiff";
import { brandColorName, getRegion, itemHeader } from "@/lib/region";

/** EU compares against "Europe"; GLOBAL against the all-country total. */
const EU = getRegion() === "EU";
const TOTAL = EU ? "Europe" : "Overall";
const AVG = EU ? "European average" : "overall average";
const BY = EU ? "European" : "overall";

/** Deviation, in share points, that saturates a cell. Fixed rather than
 *  data-derived so a weak effect on a narrow filter cannot be auto-scaled up
 *  into looking like a strong one. */
const DELTA_SPAN = 2.2;

const TOP_N = 12;

/**
 * Block D — preference share by market against the all-market average.
 *
 * One HB fit, six subsets. A market column is that market's respondents
 * averaged out of the same per-respondent estimates that produced the total,
 * which is why the six columns are directly comparable to each other and to
 * the Europe column.
 */
export function MarketHeatmap({
  data,
  isLoading,
  error,
  onRetry,
}: {
  data?: MarketsResponse;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const items = data?.items ?? [];
  const visible = showAll ? items : items.slice(0, TOP_N);
  const hasMore = items.length > TOP_N;
  const showSub = !!data?.item_subcategory && Object.values(data.item_subcategory).some(Boolean);

  return (
    <SectionCard
      tag="maxdiff"
      tagLabel="MaxDiff"
      title="Where markets disagree"
      description={
        <>
          Preference share by market. <span className="font-medium capitalize text-viz-pos">{brandColorName()}</span> is
          above the {AVG}, <span className="font-medium text-viz-neg">charcoal</span>{" "}
          below. Rows are ordered by {BY} importance.
        </>
      }
      actions={
        hasMore && (
          <Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? `Top ${TOP_N}` : `All ${items.length}`}
          </Button>
        )
      }
      info={
        <>
          Preference share per market, shaded against the {AVG} — {brandColorName()} above, charcoal
          below, saturating at the span given in the footnote. A fixed span keeps markets
          comparable when you change the filter; auto-scaling would make a weak difference on a
          narrow cut look as strong as a real one. <b>+/−</b> marks significance at 95%, and a
          market whose base is thin is flagged: read its deltas as noise until the base grows.
        </>
      }
      footnote={
        data && (
          <>
            Base n = {formatCount(data.base_n)}. Cell shading is the deviation from the {AVG},
            saturating at ±{DELTA_SPAN} share points. Hover a cell for the exact gap.
          </>
        )
      }
    >
      {isLoading && <PanelLoading rows={8} />}
      {error && <PanelError error={error} onRetry={onRetry} />}
      {!isLoading && !error && data && !items.length && (
        <PanelEmpty>{data.warning ?? "No respondents match this filter."}</PanelEmpty>
      )}

      {!isLoading && !error && data && items.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {showSub && <th className="nm">Benefits Platform</th>}
                <th className="nm sticky-col">{itemHeader()}</th>
                <th>{TOTAL}</th>
                {data.markets.map((m) => (
                  <th key={m.code} title={`${m.name} — base ${formatCount(m.base_n)}`}>
                    {m.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const eu = data.total_share[item];
                const row = data.cells[item] ?? {};
                return (
                  <tr key={item}>
                    {showSub && <td className="nm">{data.item_subcategory?.[item] ?? "—"}</td>}
                    <td className="nm sticky-col" title={item}>
                      {item}
                    </td>
                    <td className="font-mono font-semibold">{formatNumber(eu, 1)}</td>
                    {data.markets.map((m) => {
                      const cell = row[String(m.code)];
                      const style = divergingCell(cell?.delta_vs_total, DELTA_SPAN, 0.75);
                      return (
                        <td key={m.code}>
                          <span
                            className="sw font-mono"
                            style={style}
                            title={
                              cell
                                ? `${m.name}: ${formatNumber(cell.preference_share, 2)}% (${formatSigned(cell.delta_vs_total, 2)} vs ${TOTAL})`
                                : "no data"
                            }
                          >
                            {cell ? formatNumber(cell.preference_share, 1) : "—"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            {/* Base sizes live here rather than in the header. They are
                reference, consulted once, and stacking them above every column
                made a three-line header band that pushed the data down and
                slowed down scanning the thing people actually came for. */}
            <tfoot>
              <tr className="border-t">
                <td className="nm sticky-col text-muted-foreground">Base (n)</td>
                <td className="font-mono text-muted-foreground">
                  {formatCount(data.base_n)}
                </td>
                {data.markets.map((m) => (
                  <td
                    key={m.code}
                    className={
                      m.thin_base
                        ? "font-mono text-destructive"
                        : "font-mono text-muted-foreground"
                    }
                    title={
                      m.thin_base
                        ? `${m.name}: base ${formatCount(m.base_n)} — too thin to read deltas from`
                        : `${m.name}: base ${formatCount(m.base_n)}`
                    }
                  >
                    {formatCount(m.base_n)}
                    {m.thin_base ? " ⚠" : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
