import { AlertTriangle } from "lucide-react";
import { formatCount } from "@/lib/utils";
import type { MetaResponse } from "@/types/maxdiff";

/**
 * Shown when respondents are ingested but no HB fit has been persisted.
 *
 * Without this the dashboard looks broken: the filter bar reports 6,224
 * respondents while every utility-backed panel reports a base of 0, and the
 * natural reading is "my filter is wrong" rather than "the model has not been
 * run". `has_utilities` on /maxdiff/meta is what distinguishes the two.
 *
 * Only the three panels that read MaxDiffRespondentUtility go empty —
 * best-minus-worst counts from MaxDiffTask and keeps working, which is worth
 * saying so the contrast is not read as a second bug.
 */
export function NotFittedBanner({ meta }: { meta?: MetaResponse }) {
  if (!meta) return null;
  if (meta.has_utilities) return null;
  // Nothing ingested at all is a different problem with a different fix.
  if (!meta.total_n) return null;

  return (
    <div className="mb-7 flex items-start gap-3 rounded-lg border border-coke-red/40 bg-coke-red/[0.05] p-4">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coke-red" />
      <div className="text-sm text-foreground">
        <div className="font-semibold">No utilities have been estimated yet.</div>
        <p className="mt-1.5 leading-relaxed">
          {formatCount(meta.total_n)} respondents are ingested, but nothing is stored for
          estimation run <code className="font-mono">{meta.estimation_run}</code>. Benefit
          ranking, market comparison and segments will stay empty until the fit is run and
          persisted. Best-minus-worst is counted from the tasks and works regardless.
        </p>
        <pre className="mt-2.5 overflow-x-auto rounded border border-coke-red/30 bg-coke-red/[0.04] p-2 font-mono text-[11px]">
          python utils/maxdiff_results.py --variant {meta.survey.variant}
        </pre>
        {meta.available_runs?.length > 0 && (
          <p className="mt-2 text-[11.5px]">
            Runs that do have data: {meta.available_runs.join(", ")} — append{" "}
            <code className="font-mono">?run=&lt;tag&gt;</code> to read one.
          </p>
        )}
      </div>
    </div>
  );
}
