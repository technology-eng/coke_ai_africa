import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getRegion } from "@/lib/region";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Thousands-separated integer, or an em dash when there is nothing to show. */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString();
}

/**
 * A projected headcount, compact: 149.6m, 23.0m, 856k, 940.
 *
 * Compact because these sit inline beside percentages and a full
 * "133,309,451" would dominate the figure it is annotating — and the precision
 * would be false confidence anyway, since the projection applies a survey rate
 * to a population estimate. The exact value goes in a `title` where anyone who
 * wants to reconcile it can find it.
 *
 * Lower-case m/k deliberately: capital M reads as "Monsieur" in France and as a
 * Roman numeral elsewhere, and this dashboard is read in six markets.
 */
export function formatPeople(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const n = Math.abs(value);
  if (n >= 1e9) return `${(value / 1e9).toFixed(1)}bn`;
  if (n >= 1e6) return `${(value / 1e6).toFixed(1)}m`;
  // 100k-999k gains nothing from a decimal; below 100k one digit still reads.
  if (n >= 1e5) return `${Math.round(value / 1e3)}k`;
  if (n >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return value.toLocaleString();
}

/** Fixed-decimal number, em dash when absent. Never renders "NaN" or "-0". */
export function formatNumber(
  value: number | null | undefined,
  digits = 1
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  // Snap floating-point residue to a clean zero so deviations that sum to
  // ~1e-13 don't render as "−0.0".
  if (Math.abs(value) < 1e-9) value = 0;
  return value.toFixed(digits);
}

/** Signed number — used for deltas, where the sign is the whole point. */
export function formatSigned(
  value: number | null | undefined,
  digits = 1
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (Math.abs(value) < 1e-9) value = 0;
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

// Data-encoding colours. These mirror the `viz` palette in tailwind.config.ts;
// they live here as raw channels because the fills are alpha-interpolated per
// cell, which Tailwind classes cannot express.
//
// Coca-Cola Red and neutrals only — the brand is red, black and white, and the
// stills project already interpolates its heatmap toward this exact red. The
// "below" direction is deliberately achromatic: red owns every "more" meaning
// here, so the contrast that carries direction is chromatic-vs-grey rather
// than one hue against another.
// The protein dashboard swaps the red for its own violet (#6C14F2).
const BRAND = getRegion() === "PROTEIN" ? "108, 20, 242" : "244, 0, 9";
const POS = BRAND;        // brand colour — above the reference
const NEG = "74, 74, 74"; // charcoal — below the reference
const SEQ = BRAND;        // brand colour — single-direction intensity

export type Cell = { background: string; color: string };

/** Text stays legible once the fill passes roughly half opacity. */
function ink(alpha: number): string {
  return alpha > 0.45 ? "#FFFFFF" : "hsl(var(--foreground))";
}

/**
 * Diverging fill for a value compared against a reference (market share vs the
 * European average, class share vs the total sample).
 *
 * `span` is the deviation, in the value's own units, that saturates the colour.
 * It is passed in rather than derived from the data because a fixed span keeps
 * cells comparable when the filter changes the range — auto-scaling would make
 * a weak effect on a narrow filter look as strong as a real one.
 */
export function divergingCell(
  delta: number | null | undefined,
  span: number,
  maxAlpha = 0.8
): Cell {
  if (delta === null || delta === undefined || Number.isNaN(delta)) {
    return { background: "transparent", color: "hsl(var(--foreground))" };
  }
  const alpha = Math.min(Math.abs(delta) / span, 1) * maxAlpha;
  return {
    background: `rgba(${delta >= 0 ? POS : NEG}, ${alpha})`,
    color: ink(alpha),
  };
}

/**
 * Sequential fill for a value with no meaningful midpoint — association
 * percentages, which run 0..max and are only ever "more" or "less".
 */
export function sequentialCell(
  value: number | null | undefined,
  max: number,
  maxAlpha = 0.85
): Cell {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { background: "transparent", color: "hsl(var(--muted-foreground))" };
  }
  const alpha = max > 0 ? Math.min(value / max, 1) * maxAlpha : 0;
  return { background: `rgba(${SEQ}, ${alpha})`, color: ink(alpha) };
}

/**
 * Sequential fill for a BAR rather than a heatmap cell.
 *
 * Same Coke-red ramp as sequentialCell, scaled to the largest value in view so
 * the leader reads at full strength. It differs in one way that matters: it
 * floors the alpha. A heatmap cell fading to nothing is meaningful — an empty
 * cell says "no association" — but a bar fading to nothing just looks like a
 * rendering fault, and the smallest rows are still real answers that need to be
 * legible. So the ramp runs MIN_ALPHA..maxAlpha rather than 0..maxAlpha.
 *
 * The bar's LENGTH already carries the absolute percentage; the colour carries
 * rank within the panel. Scaling both to the same absolute 0-100 would leave
 * every bar washed out on a table whose leader sits at 42%.
 */
const BAR_MIN_ALPHA = 0.28;

export function sequentialBar(
  value: number | null | undefined,
  max: number,
  maxAlpha = 0.95
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "transparent";
  }
  const t = max > 0 ? Math.min(Math.max(value, 0) / max, 1) : 0;
  return `rgba(${SEQ}, ${BAR_MIN_ALPHA + t * (maxAlpha - BAR_MIN_ALPHA)})`;
}

/** Bar colour for a signed value — teal when positive, copper when negative. */
export function signColor(value: number): string {
  return value >= 0 ? "rgb(15, 110, 99)" : "rgb(176, 96, 42)";
}
