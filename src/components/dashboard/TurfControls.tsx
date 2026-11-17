import { useState } from "react";
import { AlertTriangle, Info, X } from "lucide-react";
import { Chip } from "@/components/dashboard/Chip";
import { formatNumber } from "@/lib/utils";
import type { TurfMetaResponse, TurfResponse } from "@/types/maxdiff";

const TOP_N_CHOICES = [2, 3, 4, 5];
const THRESHOLD_CHOICES = [40, 60, 80];
/**
 * Cuts on the net MaxDiff count score, in percent. 50 is the client's existing
 * convention and the default; the other two bracket it. On this study they run
 * 8.1, 3.3 and 1.0 benefits reaching the average person — so 50 sits close to
 * top-3 in strictness, which is what makes the two comparable.
 */
const COUNT_THRESHOLD_CHOICES = [25, 50, 75];

/**
 * When the single strongest benefit already reaches more than this share of
 * the sample on its own, the rule is too loose for TURF to discriminate —
 * every portfolio starts near the ceiling and combinations stop mattering.
 *
 * Measured on this study. The strongest single benefit reaches 30.9% under
 * top-2, 41.0% under top-3, 56.1% under top-5 and 44.4% above a threshold of
 * 80 — all workable. It jumps to 76.1%, 82.7% and 91.9% for threshold-60,
 * positive utility and threshold-40, which are the three that collapse. A cut
 * at 70 sits in open space between the two groups.
 *
 * This replaced a spread measure (reach at the largest size minus reach at
 * size one). Spread classified the rules identically but was computed off the
 * CONSTRAINED curve, so pinning benefits inflated it — seven weak pins took it
 * from 57.6 to 79.3 points, turning a diagnostic of the RULE into a
 * measurement of the user's pins. Own-reach is per benefit and cannot be
 * moved by a pin.
 */
const MAX_SINGLE_REACH_PCT = 70;

/**
 * How "reached" is defined — the single most consequential choice in a TURF,
 * and the reason this is a control rather than a constant.
 *
 * Loose rules do not merely shift the numbers, they destroy the analysis: under
 * "positive utility" the average respondent is reached by 11.75 of 24 benefits,
 * so one benefit alone reaches 83% and five reach 100%. Every portfolio scores
 * the same and the optimiser has nothing to optimise. The panel measures that
 * directly and says so rather than leaving the reader to notice a suspiciously
 * flat curve.
 */
export function TurfControls({
  data,
  meta,
  rule,
  topN,
  threshold,
  onChange,
}: {
  data?: TurfResponse;
  meta?: TurfMetaResponse;
  rule: string;
  topN: number;
  threshold: number;
  onChange: (rule: string, opts?: { topN?: number; threshold?: number }) => void;
}) {
  const rules = meta?.rules ?? [];
  const reaches = Object.values(data?.own_reach ?? {});
  const strongest = reaches.length ? Math.max(...reaches) : null;
  const weak = strongest !== null && strongest > MAX_SINGLE_REACH_PCT;
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="mt-5 rounded-lg border bg-card px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
            title="A benefit only helps a portfolio if it reaches someone. This decides what reaching them means."
          >
            Counts as reached when
          </span>
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            aria-expanded={showInfo}
            aria-label="How the reach rule works"
            title={showInfo ? "Hide guidance" : "How the reach rule works"}
            className={
              showInfo
                ? "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-coke-red bg-coke-red text-white"
                : "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground hover:border-coke-red hover:text-coke-red"
            }
          >
            <Info className="h-2.5 w-2.5" />
          </button>
          {rules.map((r) => (
            <Chip
              key={r.value}
              active={rule === r.value}
              onClick={() => onChange(r.value)}
              title={r.note}
            >
              {r.label}
            </Chip>
          ))}
        </div>

        {rule === "top_n" && (
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
              title="How many of a respondent's OWN favourites count as reached. Nothing to do with how many benefits the portfolio carries."
            >
              Their own top
            </span>
            {TOP_N_CHOICES.map((n) => (
              <Chip
                key={n}
                active={topN === n}
                onClick={() => onChange("top_n", { topN: n })}
                title={`A benefit reaches someone when it is among their own ${n} favourites`}
              >
                {n}
              </Chip>
            ))}
          </div>
        )}

        {rule === "rescaled_gt" && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Above
            </span>
            {THRESHOLD_CHOICES.map((t) => (
              <Chip
                key={t}
                active={threshold === t}
                onClick={() => onChange("rescaled_gt", { threshold: t })}
                title={`Benefit scores above ${t} on a 0–100 rescaling of that respondent's own utility range`}
              >
                {t}
              </Chip>
            ))}
          </div>
        )}

        {rule === "count_score" && (
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
              title="Net count score: (times picked best − times picked worst) ÷ times shown, per respondent per benefit. Counted from their own choices — no model involved."
            >
              Count score at least
            </span>
            {COUNT_THRESHOLD_CHOICES.map((t) => (
              <Chip
                key={t}
                active={threshold === t}
                onClick={() => onChange("count_score", { threshold: t })}
                title={`A benefit reaches someone when their own (best − worst) ÷ shown score for it is ${t}% or more`}
              >
                {t}%
              </Chip>
            ))}
          </div>
        )}

        {data?.rule && (
          <div className="ml-auto text-right font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {formatNumber(data.rule.mean_items_reaching, 1)} of {data.items.length} benefits
            reach the average person
            {strongest !== null && (
              <>
                {" · "}
                <span className={weak ? "text-coke-red font-semibold" : undefined}>
                  strongest alone reaches {formatNumber(strongest, 0)}%
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {showInfo && (
        <div className="mt-3 flex items-start gap-2.5 rounded-md border-l-2 border-l-coke-red bg-muted/50 py-2.5 pl-3 pr-2 text-[11.5px] leading-relaxed text-muted-foreground">
          <div className="min-w-0 flex-1">
            This decides what it means for a benefit to reach someone, and it governs all three
            TURF panels below. <b>In their top N</b> is strictest and the default;{" "}
            <b>positive utility</b> and low <b>thresholds</b> are loose enough that one benefit
            already reaches most of the sample. <b>Count score</b> is the odd one out — it uses
            no model at all, just each person's own (best − worst) ÷ shown per benefit, flagged
            yes at 50% or more. That is the convention earlier TURF decks used, so it is the
            setting to pick when reconciling this dashboard against one of those. Watch the
            readout on the right — it is what the single strongest benefit reaches on its own,
            and once that passes {MAX_SINGLE_REACH_PCT}% every portfolio starts near the ceiling
            and the optimiser has nothing left to optimise. It is measured per benefit, so
            pinning cannot move it. Reach is only comparable within one rule; always quote the
            rule with the number.
          </div>
          <button
            type="button"
            onClick={() => setShowInfo(false)}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Hide guidance"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {weak && data?.rule && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-coke-red/40 bg-coke-red/[0.05] px-3 py-2 text-[11.5px] leading-relaxed text-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <b>This rule is too loose for TURF to discriminate.</b> It counts{" "}
            {formatNumber(data.rule.mean_items_reaching, 1)} of {data.items.length} benefits as
            reaching the average respondent, so the single strongest benefit already reaches{" "}
            {formatNumber(strongest, 0)}% of the sample on its own. Every portfolio starts near
            the ceiling and combinations stop mattering, which makes the "optimal" set below
            close to arbitrary. Tighten the rule before reading anything into it.
          </div>
        </div>
      )}
    </div>
  );
}
