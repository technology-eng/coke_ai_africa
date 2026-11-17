import { useMemo, type ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Chip } from "@/components/dashboard/Chip";
import { PanelError, PanelLoading } from "@/components/dashboard/States";
import { Switch } from "@/components/ui/switch";
import { brandColorName } from "@/lib/region";
import {
  divergingCell,
  formatCount,
  formatNumber,
  formatPeople,
  formatSigned,
} from "@/lib/utils";
import type { SegmentsResponse } from "@/types/maxdiff";

/** Lift, in share points, that saturates a cell. */
const LIFT_SPAN = 6;

/**
 * Block C — Latent Class MNL need-state segments.
 *
 * How this responds to a demographic filter, which is the thing readers get
 * wrong: the class DEFINITIONS never move — the shares below are always the
 * total-sample fit, which is exactly what lets you compare one cut against
 * another. The class SIZES do move, because they are a count of who in the
 * filtered base falls in each class. So filtering answers "how is this
 * subgroup's mix different?" rather than "what classes would this subgroup
 * have had?", and the sizes row carries the total-sample share beside it so
 * the skew is visible rather than inferred.
 */
export function SegmentProfiles({
  data,
  shareByItem,
  itemOrder,
  isLoading,
  error,
  onRetry,
  activeK,
  appliedK,
  onSelectK,
}: {
  data?: SegmentsResponse;
  shareByItem?: Record<string, number>;
  itemOrder?: string[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  /** Draft class count — what the chips show as selected. */
  activeK: number | null;
  /** Applied class count — what the table below is actually showing. */
  appliedK?: number | null;
  onSelectK: (k: number) => void;
}) {
  const segments = data?.profiles?.segments ?? [];

  /**
   * The "Total" column. Prefer the HB total-sample preference share from the
   * ranking query, which is what a reader compares a class against. Where it
   * is missing, fall back to reconstructing the mixture's own reference
   * (share − lift), which is the unweighted mean across classes — a different
   * quantity, so it is only a fallback.
   */
  const totals = useMemo(() => {
    const out: Record<string, number> = {};
    const first = segments[0];
    if (first) {
      for (const item of Object.keys(first.shares ?? {})) {
        if (shareByItem?.[item] !== undefined) out[item] = shareByItem[item];
        else out[item] = (first.shares[item] ?? 0) - (first.lift_vs_total?.[item] ?? 0);
      }
    }
    return out;
  }, [segments, shareByItem]);

  const rows = useMemo(() => {
    const known = Object.keys(segments[0]?.shares ?? {});
    if (!itemOrder?.length) return known.sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0));
    // Follow the importance ordering used by the rest of the dashboard, then
    // append anything the ordering did not mention so nothing is silently lost.
    const inOrder = itemOrder.filter((i) => known.includes(i));
    const rest = known.filter((i) => !inOrder.includes(i));
    return [...inOrder, ...rest];
  }, [segments, itemOrder, totals]);

  const availableK = data?.available_k ?? (data?.k ? [data.k] : []);
  const shownK = data?.k ?? appliedK ?? activeK;
  // A staged K the reader has not applied yet. The chip moves immediately
  // so the click registers; the table stays on the applied fit until
  // Save & Run, and this says so rather than letting the two silently differ.
  const pendingK = activeK !== null && activeK !== shownK ? activeK : null;
  // Base the class percentages on the FILTERED count, not on the stored
  // total-sample size_pct — otherwise the row would keep reporting 48% for a
  // class while showing a filtered n that clearly is not 48% of the base.
  const filteredBase = data?.filtered_base_n ?? data?.base_n ?? 0;
  const totalBase = data?.total_base_n ?? 0;
  const isFiltered = !!totalBase && !!filteredBase && filteredBase !== totalBase;
  const population = data?.population?.filtered ?? null;
  const alignment = data?.alignment;
  const unreliable = data?.refit && alignment?.reliable === false;

  return (
    <SectionCard
      tag="latent"
      tagLabel="Latent Class"
      title="Need-state segment profiles"
      description={
        <>
          Preference share within each class, from a finite mixture of MNL models fitted by EM.
          Segments come from the respondent-level preference data, not from the questionnaire's
          predefined benefit nets. <span className="font-medium capitalize text-viz-pos">{brandColorName()}</span> marks
          benefits a class rates above the total sample and <span className="font-medium">grey</span>{" "}
          below — the {brandColorName()} cells are what define a class.
        </>
      }
      footnote={
        data && (
          <>
            Shares are the total-sample fit and do not change with a filter — that is what
            keeps one cut comparable with another. The <b>base row</b> does change: it counts
            who in the current filter falls into each class. Cell shading is lift vs the total
            sample, saturating at ±{LIFT_SPAN} share points.
          </>
        )
      }
    >
      {isLoading && <PanelLoading rows={10} />}
      {error && <PanelError error={error} onRetry={onRetry} />}

      {!isLoading && !error && data && (
        <>
          {availableK.length > 1 && (
            <div className="mb-4 flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Classes
              </span>
              {availableK.map((k) => {
                const bic = data.bic_by_k?.[String(k)];
                // "recommended", never "best". BIC's minimum is usually a
                // LARGER K than the one served, so a chip labelled "best"
                // sitting next to one with a lower BIC reads as a mistake.
                const rec = data.best_k === k;
                const staged = activeK === k;
                const bicBest = data.bic_best_k === k;
                return (
                  <Chip
                    key={k}
                    active={staged}
                    onClick={() => onSelectK(k)}
                    title={[
                      bic !== undefined ? `BIC ${formatNumber(bic, 0)}` : null,
                      rec ? "recommended — see the note below" : null,
                      bicBest && !rec
                        ? "lowest BIC, but BIC over-selects at this sample size"
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  >
                    K={k}
                    {rec && <span className="ml-1 opacity-60">recommended</span>}
                  </Chip>
                );
              })}
            </div>
          )}

          {pendingK && (
            <Notice tone="warn">
              <b>K={pendingK} is staged but not applied.</b> The profiles below are still the
              K={shownK} fit. Press <b>Save &amp; Run</b> in the filter rail to switch.
            </Notice>
          )}

          {data.recommendation && (
            <Notice tone={data.recommendation.clean ? "info" : "warn"}>
              <b>K={data.recommendation.k} is the recommended read</b> — {data.recommendation.reason}.
              {data.bic_best_k && data.bic_best_k !== data.recommendation.k && (
                <>
                  {" "}
                  BIC alone would pick K={data.bic_best_k}, but it is not evidence here: its
                  penalty grows with log(N) while the fit gain does not, so on{" "}
                  {formatCount(
                    Object.values(data.segment_sizes ?? {}).reduce((a, b) => a + b, 0) || undefined
                  )}{" "}
                  respondents it keeps falling to the top of whatever range is searched. The
                  other class counts are shown so you can look, not because the statistics are
                  undecided between them.
                </>
              )}
            </Notice>
          )}

          {data.best_k_at_boundary && (
            <Notice tone="warn">
              <b>K={data.best_k} is the largest class count that was fitted.</b> It met
              every quality threshold, but so might a larger one — the search stopped
              here, so we cannot say whether more need-states would also have held up.
              Treat the class count as a practical choice rather than a settled one.
            </Notice>
          )}

          {!!data.profiles?.duplicate_pairs?.length && (
            <Notice tone="warn">
              <b>K={shownK} splits one need-state in two.</b>{" "}
              {data.profiles.duplicate_pairs
                .map(([a, b, r]) => `${a} and ${b} (r=${formatNumber(r, 2)})`)
                .join(", ")}{" "}
              have almost the same preference profile, so this class count buys
              granularity without adding a story. A lower K says the same thing more
              simply.
            </Notice>
          )}

          {(data.profiles?.n_undifferentiated ?? 0) > 0 && (
            <Notice tone="info">
              One class below has <b>no distinct profile</b> — it rates every benefit
              alike. That is a finding about the market rather than a problem with the
              fit: this share of the sample does not organise around any single benefit,
              and adding classes does not break it up. Read the others as the
              need-states and this one as the remainder.
            </Notice>
          )}

          {data.run_mismatch && (
            <Notice tone="warn">
              <b>These segments came from a different run.</b> The classes below were
              fitted in <code className="font-mono">{data.estimation_run}</code>, but the
              utilities on this page are from{" "}
              <code className="font-mono">{data.requested_run}</code>. Only one segmentation
              is stored per survey, so the most recent fit overwrote the earlier one — refit
              under the run you are viewing to bring them back into step.
            </Notice>
          )}

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="nm sticky-col">Benefit</th>
                  <th>Total</th>
                  {segments.map((s, i) => (
                    <th
                      key={s.segment ?? i}
                      title={
                        s.top_by_share?.length
                          ? `Strongest: ${s.top_by_share.join(" · ")}`
                          : undefined
                      }
                    >
                      {s.segment ?? `S${i + 1}`}
                      {s.is_undifferentiated && (
                        <span className="ml-1 font-normal normal-case tracking-normal opacity-60">
                          ·&nbsp;undiff.
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const total = totals[item];
                  return (
                    <tr key={item}>
                      <td className="nm sticky-col" title={item}>
                        {item}
                      </td>
                      <td className="font-mono font-semibold">{formatNumber(total, 1)}</td>
                      {segments.map((s, i) => {
                        const v = s.shares?.[item];
                        const delta = v !== undefined && total !== undefined ? v - total : null;
                        const style = divergingCell(delta, LIFT_SPAN, 0.8);
                        return (
                          <td key={s.segment ?? i}>
                            <span
                              className="sw font-mono"
                              style={style}
                              title={
                                delta !== null
                                  ? `${s.segment ?? `S${i + 1}`}: ${formatNumber(v, 2)}% (${formatSigned(delta, 2)} vs total)`
                                  : undefined
                              }
                            >
                              {formatNumber(v, 1)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              {/* Base row. This is the half of the panel that responds to a
                  demographic filter: the shares above are the fixed
                  total-sample fit, these counts are who in the current filter
                  landed in each class. The total-sample share sits beside each
                  one so a skew reads as a skew rather than as a bare number. */}
              <tfoot>
                <tr className="border-t">
                  <td className="nm sticky-col text-muted-foreground">Base (n)</td>
                  <td className="font-mono text-muted-foreground">
                    {formatCount(filteredBase)}
                  </td>
                  {segments.map((s, i) => {
                    const n = data.segment_sizes?.[String(i)] ?? 0;
                    const pct = filteredBase ? (n / filteredBase) * 100 : 0;
                    const totalN = data.segment_sizes_total?.[String(i)];
                    const totalPct =
                      totalBase && totalN !== undefined ? (totalN / totalBase) * 100 : null;
                    // Only worth flagging a skew when there is a filter to
                    // cause one; unfiltered, the two figures are the same.
                    const skew =
                      isFiltered && totalPct !== null ? pct - totalPct : null;
                    return (
                      <td key={s.segment ?? i} className="font-mono">
                        <span className={n < 30 ? "text-destructive" : "text-foreground"}>
                          {formatCount(n)}
                        </span>
                        <span className="ml-1 text-muted-foreground">
                          {formatNumber(pct, 0)}%
                        </span>
                        {skew !== null && Math.abs(skew) >= 1 && (
                          <span
                            className={
                              skew > 0
                                ? "ml-1 text-viz-pos"
                                : "ml-1 text-muted-foreground"
                            }
                            title={`${formatNumber(pct, 1)}% of this filter vs ${formatNumber(totalPct, 1)}% of the total sample`}
                          >
                            {formatSigned(skew, 0)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                {/* People, not respondents. A class at 48% of the sample is a
                    statistic; 71.8m people is a market. This row is what makes
                    a segment sizeable against a portfolio decision, and it
                    tracks the filter — narrow to the UK and it becomes a share
                    of 32.8m. */}
                {population != null && (
                  <tr className="border-t">
                    <td
                      className="nm sticky-col text-muted-foreground"
                      title={
                        `Each class's share of the filtered base applied to the ` +
                        `${population.toLocaleString()} people it represents.\n\n` +
                        (data.population?.basis ?? "")
                      }
                    >
                      People
                    </td>
                    <td className="font-mono font-semibold text-coke-red">
                      {formatPeople(population)}
                    </td>
                    {segments.map((s, i) => {
                      const people = data.segment_populations?.[String(i)];
                      return (
                        <td key={s.segment ?? i} className="font-mono text-coke-red">
                          <span title={people != null ? people.toLocaleString() : undefined}>
                            {people == null ? "—" : formatPeople(people)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {segments.map((s, i) => {
              // An undifferentiated class rates everything alike. It is a real
              // result — a slice of the sample whose preferences do not
              // cluster — but it has no defining benefits, and the backend
              // sends an empty list rather than let the lift ranking invent
              // some. Say what it is instead of rendering "Defines it: —".
              const flat = s.is_undifferentiated;
              const vals = Object.values(s.shares ?? {});
              const span = vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
              return (
              <div
                key={s.segment ?? i}
                className={
                  flat
                    ? "rounded-md border border-dashed bg-muted/20 p-3"
                    : "rounded-md border bg-muted/40 p-3"
                }
              >
                <div className="font-mono text-[11px] font-semibold uppercase tracking-wider">
                  {s.segment ?? `S${i + 1}`}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {formatNumber(s.size_pct, 1)}%
                  </span>
                  {data.segment_populations?.[String(i)] != null && (
                    <span
                      className="ml-2 font-normal normal-case tracking-normal text-coke-red"
                      title={`${data.segment_populations[String(i)]!.toLocaleString()} people in the current cut`}
                    >
                      {formatPeople(data.segment_populations[String(i)])} people
                    </span>
                  )}
                  {flat && (
                    <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground">
                      · undifferentiated
                    </span>
                  )}
                </div>
                <div className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                  {flat ? (
                    <>
                      Rates every benefit within {formatNumber(span, 1)} share points of
                      the next — nothing on the list separates this group. Report it as a
                      residual, not as a need-state.
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-foreground">Defines it:</span>{" "}
                      {s.defining_attributes?.join(" · ") || "—"}
                    </>
                  )}
                </div>
                <div
                  className="mt-1 font-mono text-[10px] text-muted-foreground"
                  title={
                    "differentiation — spread of this class's preference shares; near zero means it has no distinct profile.\n" +
                    "confidence — average posterior among this class's own members; 1.00 is a clean partition, 1/K is a coin flip."
                  }
                >
                  differentiation {formatNumber(s.differentiation, 2)}
                  {s.crispness !== undefined
                    ? ` · confidence ${formatNumber(s.crispness, 2)}`
                    : ""}
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

function Notice({
  tone,
  children,
}: {
  tone: "info" | "warn";
  children: ReactNode;
}) {
  const warn = tone === "warn";
  const Icon = warn ? AlertTriangle : Info;
  return (
    <div
      className={
        warn
          ? "mb-4 flex items-start gap-2 rounded-md border border-coke-red/40 bg-coke-red/[0.05] px-3 py-2 text-[11.5px] leading-relaxed text-foreground"
          : "mb-4 flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-[11.5px] leading-relaxed text-muted-foreground"
      }
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
