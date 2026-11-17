import { SectionCard } from "@/components/dashboard/SectionCard";
import { PanelEmpty, PanelError, PanelLoading } from "@/components/dashboard/States";
import { formatCount, formatNumber, signColor } from "@/lib/utils";
import type { BwResponse } from "@/types/maxdiff";

/**
 * Block A — the counting-based check on the model.
 *
 * No model is involved: BW is (times best − times worst) ÷ times shown. That
 * is what makes it worth showing next to the utilities rather than instead of
 * them — if this ordering and the HB ordering disagree badly, the problem is
 * upstream in the data, not in either statistic.
 *
 * `shareByItem` is joined in from the ranking query; the /maxdiff/bw endpoint
 * does not return preference share, but the column is useful for exactly the
 * comparison above.
 */
export function BwTable({
  data,
  shareByItem,
  isLoading,
  error,
  onRetry,
}: {
  data?: BwResponse;
  shareByItem?: Record<string, number>;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const showSub = data?.rows.some((r) => r.subcategory);

  return (
    <SectionCard
      tag="maxdiff"
      tagLabel="MaxDiff"
      title="Best-minus-worst & relative utility index"
      description={
        <>
          BW is (times chosen best − times chosen worst) ÷ times shown, ranging −1 to +1. RUI
          rescales BW to a 0–100 index across the benefits in view. Both are counted straight from
          the tasks, with no model at all.
        </>
      }
      info={
        <>
          Counting scores, computed straight from the choices with no model involved: how often a
          benefit was picked best minus how often worst, over how often it was shown.
          <b> RUI</b> rescales that to 0–100 across the benefits in view. Use this as the sanity
          check on the HB utilities above — the two orderings should broadly agree, and a benefit
          that ranks very differently in each is worth investigating before it goes in a deck.
        </>
      }
      footnote={
        data && (
          <>
            Base n = {formatCount(data.base_n)}. Exposure is counted rather than assumed — the
            design guarantees each benefit appears at least 3 times, but not equally often, so
            every benefit has its own denominator.
          </>
        )
      }
    >
      {isLoading && <PanelLoading rows={8} />}
      {error && <PanelError error={error} onRetry={onRetry} />}
      {!isLoading && !error && data && data.base_n === 0 && (
        <PanelEmpty>No respondents match this filter.</PanelEmpty>
      )}

      {!isLoading && !error && data && data.base_n > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th className="nm">#</th>
                {showSub && <th className="nm">Benefits Platform</th>}
                <th className="nm">Benefit</th>
                <th>Shown</th>
                <th>Best %</th>
                <th>Worst %</th>
                <th>BW score</th>
                <th style={{ minWidth: 130 }}>BW</th>
                <th>RUI (0–100)</th>
                <th>Pref. share</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                // Bar is centred: zero sits at 50%, and a full ±1 fills half
                // the track in either direction.
                const width = Math.abs(r.bw) * 50;
                return (
                  <tr key={r.item}>
                    <td className="nm font-mono text-muted-foreground">{r.rank}</td>
                    {showSub && <td className="nm">{r.subcategory ?? "—"}</td>}
                    <td className="nm" title={r.item}>
                      {r.item}
                    </td>
                    <td className="font-mono text-muted-foreground">
                      {formatCount(r.times_shown)}
                    </td>
                    <td className="font-mono">{formatNumber(r.best_pct, 1)}</td>
                    <td className="font-mono text-muted-foreground">
                      {formatNumber(r.worst_pct, 1)}
                    </td>
                    <td className="font-mono">{formatNumber(r.bw, 3)}</td>
                    <td>
                      <span className="relative block h-3 rounded-sm bg-muted">
                        <i className="absolute -top-px -bottom-px left-1/2 w-px bg-muted-foreground" />
                        <i
                          className="absolute top-[3px] h-[6px] rounded-sm"
                          style={{
                            left: r.bw >= 0 ? "50%" : `${50 - width}%`,
                            width: `${width}%`,
                            background: signColor(r.bw),
                          }}
                        />
                      </span>
                    </td>
                    <td className="font-mono font-semibold">{formatNumber(r.rui, 1)}</td>
                    <td className="font-mono text-muted-foreground">
                      {shareByItem?.[r.item] !== undefined
                        ? `${formatNumber(shareByItem[r.item], 2)}%`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
