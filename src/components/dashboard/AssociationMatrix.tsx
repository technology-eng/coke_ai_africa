import { useMemo, type ReactNode } from "react";
import { itemHeader } from "@/lib/region";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { PanelEmpty, PanelError, PanelLoading } from "@/components/dashboard/States";
import { formatCount, formatNumber, sequentialCell } from "@/lib/utils";
import type { AssociationResponse } from "@/types/maxdiff";

/**
 * Blocks F and G — benefit × ingredient (M2) and benefit × category (M3).
 *
 * THE BASE IS THE WHOLE STORY HERE. M2 and M3 are piped to each respondent's
 * own top-5 benefits, so a benefit's base is the number of filtered
 * respondents who ranked it in their personal top five — roughly n/5, and
 * different for every row. Percentages are over that row's own base. Reading
 * them against the filtered n instead would understate every cell about
 * five-fold, which is why the base column is not optional.
 */
export function AssociationMatrix({
  title,
  tagLabel,
  description,
  data,
  isLoading,
  error,
  onRetry,
}: {
  title: string;
  tagLabel: string;
  description: ReactNode;
  data?: AssociationResponse;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  // Colour intensity is scaled to the largest cell in view, since association
  // rates have no natural ceiling — an "average" rate differs per study.
  const max = useMemo(() => {
    if (!data) return 0;
    let hi = 0;
    for (const row of Object.values(data.cells ?? {})) {
      for (const cell of Object.values(row ?? {})) {
        if (cell?.pct != null && cell.pct > hi) hi = cell.pct;
      }
    }
    return hi;
  }, [data]);

  const rows = data?.rows ?? [];
  const showSub = rows.some((r) => r.subcategory);

  return (
    <SectionCard
      tag="assoc"
      tagLabel={tagLabel}
      title={title}
      description={description}
      info={
        <>
          Share of people who linked each column to each benefit. These questions were asked only
          of respondents who ranked that benefit in their own top five, so{" "}
          <b>every row has its own base</b> — roughly n/5, and percentages are over that base,
          never over the filtered n. Read down a column to see what a benefit owns; an
          important benefit with no dark cell anywhere is unclaimed territory.
        </>
      }
      footnote={
        data && (
          <>
            Filtered base n = {formatCount(data.base_n)}. {data.base_note} Shading is scaled to the
            strongest cell in view ({formatNumber(max, 0)}%). Rows marked ⚠ have a base under 50
            and should not be quoted.
          </>
        )
      }
    >
      {isLoading && <PanelLoading rows={8} />}
      {error && <PanelError error={error} onRetry={onRetry} />}
      {!isLoading && !error && data && !rows.length && (
        <PanelEmpty>No respondents match this filter.</PanelEmpty>
      )}

      {!isLoading && !error && data && rows.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {showSub && <th className="nm">Benefits Platform</th>}
                <th className="nm sticky-col">{itemHeader()}</th>
                <th>Base</th>
                {data.answers.map((a) => (
                  <th
                    key={a}
                    title={a}
                    style={{
                      writingMode: "vertical-rl",
                      transform: "rotate(180deg)",
                      // Long names ("Fizzy Cola Soft Drinks") wrap onto a second rotated line rather than clip.
                      height: 132,
                      padding: "4px 2px",
                      whiteSpace: "normal",
                      lineHeight: 1.2,
                    }}
                  >
                    {a}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cells = data.cells[r.item] ?? {};
                return (
                  <tr key={r.item}>
                    {showSub && <td className="nm">{r.subcategory ?? "—"}</td>}
                    <td className="nm sticky-col" title={r.item}>
                      {r.item}
                    </td>
                    <td
                      className="font-mono text-muted-foreground"
                      title={
                        r.preference_share != null
                          ? `Preference share ${formatNumber(r.preference_share, 2)}%`
                          : undefined
                      }
                    >
                      {formatCount(r.base_n)}
                      {r.thin_base && <span className="ml-1 text-coke-red">⚠</span>}
                    </td>
                    {data.answers.map((a) => {
                      const cell = cells[a];
                      // The API omits answers nobody picked, which means zero,
                      // not missing. Only a row with no base at all is unknown.
                      const pct = cell?.pct ?? (r.base_n > 0 ? 0 : null);
                      const style = sequentialCell(pct, max);
                      return (
                        <td key={a}>
                          <span
                            className="sw font-mono"
                            style={{ ...style, padding: "3px 2px" }}
                            title={
                              cell
                                ? `${r.item} → ${a}: ${formatNumber(pct, 1)}% (${formatCount(cell.count)} of ${formatCount(r.base_n)})`
                                : `${r.item} → ${a}: none`
                            }
                          >
                            {pct == null ? "—" : formatNumber(pct, 0)}
                          </span>
                        </td>
                      );
                    })}
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
