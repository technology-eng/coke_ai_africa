import type { ReactNode } from "react";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { PanelEmpty, PanelError, PanelLoading, ThinBaseNotice } from "@/components/dashboard/States";
import { formatCount, formatNumber, formatPeople, sequentialBar } from "@/lib/utils";
import type { AwarenessResponse } from "@/types/maxdiff";

/**
 * Prompted awareness — one row per benefit (B2) or ingredient (M2).
 *
 * LENGTH is absolute, COLOUR is relative, and the split is deliberate. Bars are
 * scaled to 100% rather than to the highest row: scaling length to the leader
 * would make the top item a full bar whether it scored 42% or 92%, which is the
 * one thing a reader takes from a bar chart at a glance, and an awareness table
 * is about absolute level. But a panel whose leader sits at 42% then has no bar
 * past the halfway mark, so intensity is ramped against the largest row instead
 * — the leader reads at full Coke red and the tail recedes, which is the
 * `viz.seq` "single-direction intensity" role in the palette.
 */
export function AwarenessTable({
  tagLabel,
  title,
  description,
  info,
  data,
  isLoading,
  error,
  onRetry,
  hideSubcategory = false,
  itemLabel,
}: {
  tagLabel: string;
  title: string;
  description: ReactNode;
  info?: ReactNode;
  data?: AwarenessResponse;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  /** Drops the Benefits Platform column (ASP Benefits Dashboard). */
  hideSubcategory?: boolean;
  /** Header over the item column when there is no platform column. */
  itemLabel?: string;
}) {
  const rows = data?.rows ?? [];
  // Ramp reference: the top row. Sorted server-side, but taken as a max rather
  // than rows[0] so a re-sort upstream cannot silently wash out the whole panel.
  const maxPct = rows.length ? Math.max(...rows.map((r) => r.pct ?? 0), 1) : 1;

  const showSub = !hideSubcategory && rows.some((r) => r.subcategory);
  return (
    <SectionCard
      tag="assoc"
      tagLabel={tagLabel}
      title={title}
      description={description}
      info={info}
      footnote={
        data && (
          <>
            Base n = {formatCount(data.base_n)}. {data.base_note}
          </>
        )
      }
    >
      {isLoading && <PanelLoading rows={8} />}
      {error && <PanelError error={error} onRetry={onRetry} />}
      {!isLoading && !error && data && data.base_n === 0 && (
        <PanelEmpty>
          {data.warning ?? "No respondents match this filter."} Widen the filters to get a
          result.
        </PanelEmpty>
      )}

      {!isLoading && !error && data && data.base_n > 0 && (
        <>
          {data.thin_base && <ThinBaseNotice n={data.base_n} />}
          {showSub && (
            <div className="grid grid-cols-[26px_150px_1fr_170px_58px_72px] gap-2.5 pb-1 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
              <div /><div>Benefits Platform</div><div>Benefit</div><div /><div /><div />
            </div>
          )}
          {!showSub && itemLabel && (
            <div className="grid grid-cols-[26px_1fr_170px_58px_72px] gap-2.5 pb-1 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
              <div /><div>{itemLabel}</div><div /><div /><div />
            </div>
          )}
          <div className="space-y-px border-t pt-3">
            {rows.map((r) => (
              <div
                key={r.item}
                className={showSub ? "grid grid-cols-[26px_150px_1fr_170px_58px_72px] items-center gap-2.5 rounded-sm py-[3px] hover:bg-muted" : "grid grid-cols-[26px_1fr_170px_58px_72px] items-center gap-2.5 rounded-sm py-[3px] hover:bg-muted"}
              >
                <div className="text-right font-mono text-[10.5px] text-muted-foreground">
                  {r.rank}
                </div>
{showSub && <div className="truncate text-[12.5px] leading-tight" title={r.subcategory ?? undefined}>{r.subcategory ?? "—"}</div>}
                <div className="truncate text-[12.5px] leading-tight" title={r.item}>
                  {r.item}
                </div>
                <div
                  className="relative h-[11px] rounded-sm bg-muted"
                  title={
                    `${formatNumber(r.pct ?? 0, 1)}% of the filtered base ` +
                    `(${r.count.toLocaleString()} respondents)`
                  }
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm"
                    style={{
                      width: `${Math.min(r.pct ?? 0, 100)}%`,
                      background: sequentialBar(r.pct, maxPct),
                    }}
                  />
                </div>
                <div className="text-right font-mono text-[11.5px]">
                  {formatNumber(r.pct ?? 0, 1)}%
                </div>
                <div
                  className="text-right font-mono text-[11px] text-muted-foreground"
                  title={
                    r.people != null
                      ? `${r.people.toLocaleString()} people on the projected population`
                      : undefined
                  }
                >
                  {r.people == null ? "" : formatPeople(r.people)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </SectionCard>
  );
}
