import { SectionCard } from "@/components/dashboard/SectionCard";
import { isPlatformView } from "@/lib/region";
import { PanelEmpty, PanelError, PanelLoading } from "@/components/dashboard/States";
import { formatNumber, sequentialCell } from "@/lib/utils";
import type { TurfResponse } from "@/types/maxdiff";

/** Overlap saturating the cell colour. Above this a pair is near-duplicate. */
const SPAN = 60;

/**
 * Which benefits compete for the same people.
 *
 * The matrix is deliberately ASYMMETRIC and the header says so, because the
 * obvious reading is wrong. cell[row][col] is "of the people the ROW benefit
 * reaches, what share does the COLUMN benefit also reach". A niche benefit can
 * sit almost entirely inside a broad one — high going one way, low coming
 * back — and that asymmetry is exactly what tells you which of the pair to
 * drop from a portfolio.
 */
export function TurfOverlap({
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
  const labels = data?.overlap?.labels ?? [];
  const cells = data?.overlap?.cells ?? [];
  const inPortfolio = new Set(data?.portfolio?.items ?? []);
  const indices = data?.overlap?.indices ?? [];

  const showSub = Object.values(data?.item_subcategory ?? {}).some(Boolean);
  return (
    <SectionCard
      tag="turf"
      tagLabel="TURF"
      title={isPlatformView() ? "Platforms competing for the same people" : "Benefits competing for the same people"}
      description={
        <>
          Of the people reached by the <b>row</b> benefit, the share also reached by the{" "}
          <b>column</b> benefit. High values mean the pair is redundant — carrying both buys
          little. Read it one direction at a time: the matrix is not symmetric.
        </>
      }
      info={
        <>
          Of the people reached by the <b>row</b> benefit, the percentage also reached by the{" "}
          <b>column</b> benefit. Darker means more redundant. It is asymmetric on purpose: a
          niche benefit can sit almost entirely inside a broad one — high one way, low back — and
          that tells you which of the pair to keep. High in <em>both</em> directions is a true
          duplicate and one of them is doing no work in a portfolio.
        </>
      }
      footnote={
        data && (
          <>
            The {labels.length} highest-ranked benefits. Rows highlighted in the label column
            are in the current portfolio. A pair that is high in <em>both</em> directions is a
            true duplicate; high in only one means the first benefit is contained inside the
            second, and the second is the one to keep.
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
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {showSub && <th className="nm">Benefits Platform</th>}
                <th className="nm sticky-col">
                  Reached by ↓ … also reached by →
                </th>
                {labels.map((l, i) => (
                  <th key={l} title={l}>
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((rowLabel, a) => (
                <tr key={rowLabel}>
                  {showSub && <td className="nm">{data?.item_subcategory?.[rowLabel] ?? "—"}</td>}
                  <td
                    className={
                      inPortfolio.has(indices[a])
                        ? "nm sticky-col font-semibold text-coke-red"
                        : "nm sticky-col"
                    }
                    title={
                      inPortfolio.has(indices[a])
                        ? `${rowLabel} — in the current portfolio`
                        : rowLabel
                    }
                  >
                    {a + 1}. {rowLabel}
                  </td>
                  {labels.map((colLabel, b) => {
                    const v = cells[a]?.[b];
                    return (
                      <td key={colLabel}>
                        {v === null || v === undefined ? (
                          <span className="text-muted-foreground">–</span>
                        ) : (
                          <span
                            className="sw font-mono"
                            style={sequentialCell(v, SPAN)}
                            title={`${formatNumber(v, 0)}% of those reached by "${rowLabel}" are also reached by "${colLabel}"`}
                          >
                            {formatNumber(v, 0)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
