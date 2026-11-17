import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCount, formatNumber } from "@/lib/utils";
import type { RunMeta } from "@/types/maxdiff";

/**
 * Provenance strip for the fit behind the utilities.
 *
 * Read from Survey.meta["estimation_runs"], not recomputed. These are the
 * facts that decide whether the numbers above are quotable, and they are not
 * recoverable from the utility rows — so if they are not shown, nobody checks
 * them.
 *
 * Three failure modes get called out explicitly because each invalidates the
 * numbers in a different way:
 *   - the convergence gate failed, or was not enforced (`strict: false`)
 *   - the fit ran on a capped slice (`limit`), so it is not representative
 *   - mean RLH sits near chance, meaning the model barely predicts anyone
 */
export function RunProvenance({ run }: { run: RunMeta | null }) {
  if (!run) return null;

  const d = run.hb_diagnostics;
  const converged = d?.ok;
  const limited = run.limit != null;
  const lenient = run.strict === false;

  // Chance RLH for a best-worst task over k items is sqrt((1/k)(1/(k-1))),
  // not 1/k. A mean only marginally above it means the utilities predict
  // little better than guessing.
  const rlh = run.fit?.average_fit;
  const chance = run.fit?.rlh_threshold;
  const rlhRatio = rlh && chance ? rlh / chance : null;
  const weakFit = rlhRatio != null && rlhRatio < 1.25;

  const problems = limited || lenient || !converged || weakFit;

  return (
    <div
      className={
        problems
          ? "mt-4 rounded-md border border-coke-red/40 bg-coke-red/[0.05] p-3"
          : "mt-4 rounded-md border bg-muted/40 p-3"
      }
    >
      <div className="flex items-start gap-2">
        {problems ? (
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-coke-red" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-viz-pos" />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Fit provenance
          </div>

          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[11px]">
            <Stat label="R-hat" value={formatNumber(d?.max_rhat, 4)} bad={!(d?.max_rhat < 1.01)} />
            <Stat label="divergences" value={formatCount(d?.divergences)} bad={!!d?.divergences} />
            <Stat label="ESS bulk" value={formatCount(Math.round(d?.min_ess_bulk ?? 0))} />
            <Stat
              label="mean RLH"
              value={`${formatNumber(rlh, 3)} vs ${formatNumber(chance, 3)} chance`}
              bad={weakFit}
            />
            <Stat label="respondents" value={formatCount(run.n_respondents)} bad={limited} />
            <Stat label="tasks" value={formatCount(run.stan_meta?.n_tasks)} />
          </div>

          {problems && (
            <ul className="mt-2.5 space-y-1 text-[11.5px] leading-relaxed text-foreground">
              {limited && (
                <li>
                  <b>Fitted on a capped slice of {formatCount(run.limit)} respondents.</b> That is
                  a pipeline test, not a representative sample — do not read the numbers.
                </li>
              )}
              {lenient && (
                <li>
                  <b>Convergence was not enforced</b> for this run (<code>--lenient</code>).
                </li>
              )}
              {!converged && !lenient && (
                <li>
                  <b>Diagnostics did not pass.</b>{" "}
                  {d?.divergences
                    ? "Divergent transitions mean the sampler could not explore the posterior; the utilities are unreliable."
                    : "R-hat is above 1.01 — the chains have not mixed to tolerance."}
                </li>
              )}
              {weakFit && (
                <li>
                  <b>Mean RLH is close to chance.</b> The model predicts respondents barely better
                  than guessing, which usually means a data problem upstream.
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <span>
      <span className="text-muted-foreground">{label} </span>
      <b className={bad ? "text-coke-red" : "text-foreground"}>{value}</b>
    </span>
  );
}
