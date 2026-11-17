import { formatCount } from "@/lib/utils";
import type { MetaResponse } from "@/types/maxdiff";
import { getRegion, regionInfo } from "@/lib/region";

/**
 * Study header — the design facts that make the rest of the dashboard legible.
 *
 * Screens × items-per-screen matters when reading any of this: with 24 items
 * shown 5 at a time over 15 screens, each benefit is seen at least 3 times,
 * and that exposure count is the denominator behind every BW score.
 */
export function Masthead({ meta, selectedMarkets = [] }: { meta?: MetaResponse; selectedMarkets?: number[] }) {
  const design = meta?.design;
  // GLOBAL only, and only once countries are picked (applied, not the draft).
  const shown = getRegion() === "GLOBAL"
    ? (meta?.markets ?? []).filter((m) => selectedMarkets.includes(m.code))
    : [];
  return (
    <>
    <header className="mb-6 border-b-2 border-foreground pb-5">
      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {meta?.survey.job_number ? `Job ${meta.survey.job_number} · ` : ""}
        MaxDiff Analysis · {regionInfo().title}
      </div>
      {/* Title and design facts sit on one baseline from lg up, so the header
          spans the page instead of stacking into the left third. The line break
          in the title is a WRAP, not a hard <br>: on a wide monitor it reads as
          one line, and it still breaks cleanly when the rail is open on a
          laptop. */}
      <div className="lg:flex lg:items-end lg:justify-between lg:gap-10">
        <h1 className="mb-3 mt-2.5 max-w-[18ch] text-4xl font-bold leading-[0.98] tracking-tight md:text-5xl lg:mb-0 lg:max-w-none">
          {regionInfo().heading ?? `Functional Benefits ${regionInfo().title}`}
        </h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 font-mono text-xs text-muted-foreground lg:shrink-0 lg:justify-end lg:pb-1.5">
          <span>
            <b className="font-semibold text-foreground">{formatCount(meta?.total_n)}</b> respondents
          </span>
          <span>
            <b className="font-semibold text-foreground">{design?.items ?? "—"}</b> benefit statements
          </span>
          <span>
            <b className="font-semibold text-foreground">{design?.screens ?? "—"}</b> screens ×{" "}
            {design?.items_per_screen ?? "—"} shown
          </span>
          <span>
            <b className="font-semibold text-foreground">{meta?.markets.length ?? "—"}</b> markets
          </span>
        </div>
      </div>
    </header>
      {shown.length > 0 && (
        <div className="-mt-3 mb-6 flex flex-wrap items-center gap-1.5 rounded-sm border border-red-200 bg-red-50 px-3 py-2 font-mono text-[11px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <span className="mr-1 uppercase tracking-[0.14em]">
            Selected countries
          </span>
          {shown.map((m) => (
            <span key={m.code} className="rounded-sm bg-red-100 px-1.5 py-0.5 dark:bg-red-900/40">
              {m.name}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
