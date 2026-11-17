import { useMemo } from "react";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { PanelError, PanelLoading, PanelEmpty, ThinBaseNotice } from "@/components/dashboard/States";
import { RunProvenance } from "@/components/dashboard/RunProvenance";
import { formatCount, formatNumber, signColor } from "@/lib/utils";
import type { RunMeta, UtilityResponse } from "@/types/maxdiff";

const METHOD_LABEL: Record<string, string> = {
  hierarchical_bayes: "Hierarchical Bayes",
};

/**
 * Block B — the utility table.
 *
 * A confidence interval is only readable against its neighbours, so each row
 * draws its interval on a shared scale with a zero marker. Two benefits whose
 * intervals overlap are not distinguishable, however different their point
 * estimates look in the number column.
 */
export function UtilityTable({
  data,
  runMeta,
  isLoading,
  error,
  onRetry,
}: {
  data?: UtilityResponse;
  runMeta?: RunMeta | null;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const scale = useMemo(() => {
    if (!data?.rows?.length) return null;
    const lo = Math.min(...data.rows.map((r) => r.lower_ci));
    const hi = Math.max(...data.rows.map((r) => r.upper_ci));
    const span = hi - lo || 1;
    // The reference line is the SAMPLE AVERAGE — the same quantity the Sig.
    // column tests against — derived from the rows rather than hardcoded to
    // zero. It happens to be 0.0000 because utilities are centred per
    // respondent before storage, but pinning the marker to a constant would
    // silently put the line in the wrong place if that ever changed, and a
    // benefit could then sit right of the line while being marked "−".
    const mean = data.rows.reduce((a, r) => a + r.utility, 0) / data.rows.length;
    return { lo, span, mean, meanPct: ((mean - lo) / span) * 100 };
  }, [data]);

  const method = data?.method ? METHOD_LABEL[data.method] ?? data.method : null;
  const showSub = data?.rows.some((r) => r.subcategory);

  return (
    <SectionCard
      tag="maxdiff"
      tagLabel="MaxDiff"
      title="Utility scores"
      description={
        <>
          Individual-level utilities averaged across the filtered group, with 95% confidence
          intervals. Preference share rescales them to sum to 100. <b>Sig.</b> marks benefits
          significantly above (+) or below (−) the sample average at 95%.
        </>
      }
      info={
        <>
          Each benefit's average appeal for the filtered group, from a hierarchical Bayes model
          fitted once per respondent — filtering subsets and re-averages, it never refits.
          Utilities are on a log scale; <b>preference share</b> converts them to percentages that
          sum to 100 across all benefits, so they measure relative appeal, not how many people want a
          benefit. The <b>+/−</b> column marks benefits significantly above or below the sample
          average at 95%; a wide confidence interval means the group is small or genuinely
          divided.
        </>
      }
      footnote={
        data && (
          <>
            Base n = {formatCount(data.base_n)}.
            {method && (
              <>
                {" "}
                {method} — utilities are estimated once per respondent on the total sample, so a
                demographic cut averages stored per-respondent estimates rather than refitting.
              </>
            )}{" "}
            Intervals are on the group mean, not on individual respondents — the upright tick is
            the <b>sample average</b> ({formatNumber(scale?.mean ?? 0, 2)}), which is the
            reference the <b>Sig.</b> column tests against. A benefit whose whole interval clears
            the tick differs significantly from the average benefit; one straddling it does not.
            {data.estimation_run && (
              <span className="ml-1 opacity-70">Run: {data.estimation_run}.</span>
            )}
          </>
        )
      }
    >
      {isLoading && <PanelLoading rows={8} />}
      {error && <PanelError error={error} onRetry={onRetry} />}
      {!isLoading && !error && data && data.base_n === 0 && (
        <PanelEmpty>
          {data.warning ?? "No respondents match this filter."}
          {/* Only suggest widening when the filter is actually the cause —
              telling someone to widen a filter will not conjure a model fit. */}
          {data.code !== "NO_UTILITIES" && " Widen the filters to get a result."}
        </PanelEmpty>
      )}

      {!isLoading && !error && data && data.base_n > 0 && (
        <>
          {data.thin_base && <ThinBaseNotice n={data.base_n} />}
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="nm">Rank</th>
                  {showSub && <th className="nm">Benefits Platform</th>}
                  <th className="nm">Benefit</th>
                  <th>Utility</th>
                  <th>95% CI low</th>
                  <th>95% CI high</th>
                  <th style={{ minWidth: 160 }} title="95% interval on the group mean. The upright tick is the sample average.">
                    Interval
                    <br />
                    <span className="font-normal normal-case tracking-normal opacity-70">
                      vs sample avg
                    </span>
                  </th>
                  <th>Pref. share</th>
                  <th>Sig.</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const left = scale ? ((r.lower_ci - scale.lo) / scale.span) * 100 : 0;
                  const width = scale
                    ? Math.max(((r.upper_ci - r.lower_ci) / scale.span) * 100, 0.7)
                    : 0;
                  return (
                    <tr key={r.item}>
                      <td className="nm font-mono text-muted-foreground">{r.rank}</td>
                      {showSub && <td className="nm">{r.subcategory ?? "—"}</td>}
                      <td className="nm" title={r.item}>
                        {r.item}
                      </td>
                      <td className="font-mono">{formatNumber(r.utility, 2)}</td>
                      <td className="font-mono text-muted-foreground">
                        {formatNumber(r.lower_ci, 2)}
                      </td>
                      <td className="font-mono text-muted-foreground">
                        {formatNumber(r.upper_ci, 2)}
                      </td>
                      <td>
                        <span className="relative block h-[13px] rounded-sm bg-muted">
                          <i
                            className="absolute -top-[3px] -bottom-[3px] w-[1.5px] bg-foreground/70"
                            style={{ left: `${scale?.meanPct ?? 50}%` }}
                            title={`Sample average (${formatNumber(scale?.mean ?? 0, 2)})`}
                          />
                          <i
                            className="absolute top-[3px] h-[7px] rounded-sm"
                            style={{
                              left: `${left}%`,
                              width: `${width}%`,
                              background: signColor(r.utility),
                            }}
                          />
                        </span>
                      </td>
                      <td className="font-mono font-semibold">
                        {formatNumber(r.preference_share, 2)}%
                      </td>
                      <td
                        className="font-mono"
                        style={{
                          color: r.sig_vs_total
                            ? signColor(r.sig_vs_total === "+" ? 1 : -1)
                            : "hsl(var(--muted-foreground))",
                        }}
                      >
                        {r.sig_vs_total || "·"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <RunProvenance run={runMeta} />
        </>
      )}
    </SectionCard>
  );
}
