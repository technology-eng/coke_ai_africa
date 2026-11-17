import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The numbered dark banner that opens each analysis part.
 *
 * Each part gets its own ground colour so the eye can tell, while scrolling,
 * which method produced the panels below it — the tables all look alike.
 */
// Every section sits on Coke black. Sections used to each get their own hue,
// which meant three non-brand colours on a Coca-Cola deliverable; the numeral
// and the red rule do the distinguishing instead, which is how the brand's own
// material reads.
const TONES = {
  maxdiff: "bg-coke-black",
  latent: "bg-coke-black",
  assoc: "bg-coke-black",
  turf: "bg-coke-black",
} as const;

export function PartBar({
  index,
  name,
  method,
  children,
  tone = "maxdiff",
}: {
  index: string;
  name: string;
  method: string;
  children: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <div
      className={cn(
        "mt-10 flex items-start gap-5 rounded-lg px-6 py-5 text-white first:mt-0",
        TONES[tone]
      )}
    >
      {/* The numeral in Coke red against black, with a red rule beside it, is
          what separates one section from the next now that they share a
          ground. */}
      <div className="flex shrink-0 items-stretch gap-4 self-stretch">
        <div className="w-[3px] rounded-full bg-coke-red" />
        <div className="font-mono text-3xl font-semibold leading-none text-coke-red">
          {index}
        </div>
      </div>
      {/* Title on its own line, description beneath it running the full width
          of the bar — no measure cap. Set larger than the panel copy below it
          because it is read once, at speed, on the way into the section. */}
      <div className="min-w-0 flex-1">
        <div className="mb-2 text-2xl font-bold tracking-tight">
          {name}{" "}
          <span className="text-base font-normal tracking-normal opacity-70">· {method}</span>
        </div>
        <p className="text-[15px] leading-relaxed opacity-90">{children}</p>
      </div>
    </div>
  );
}
