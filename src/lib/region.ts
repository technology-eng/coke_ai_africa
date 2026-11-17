/**
 * Coke Africa: one study, served at /coke-africa/.
 *   /coke-africa/... -> AFRICA_OU survey (Africa OU file, variant OU; no
 *                       operating units, so plain market chips)
 * Anything else (the dev server at /) is the same survey.
 * Forked from coke_eu_frontend; the other regions' helpers are kept so the
 * shared components compile unchanged.
 * Inside GLOBAL the operating units are ordinary market filters, driven by
 * meta.subregions and regrouped by operatingUnits().
 */
export type Region = "EU" | "GLOBAL" | "ASP_GLOBAL" | "PROTEIN" | "AFRICA_OU";

export const REGIONS: { id: Region; variant: string; title: string; short: string; tab: string; base: string; heading?: string }[] = [
  { id: "AFRICA_OU", variant: "OU", title: "Africa", short: "AF", tab: "Africa", base: "/coke-africa" },
];

function fromPath(): (typeof REGIONS)[number] | undefined {
  const path = typeof window === "undefined" ? "" : window.location.pathname.toLowerCase();
  return REGIONS.find((r) => path === r.base || path.startsWith(`${r.base}/`));
}

export function getRegion(): Region {
  return fromPath()?.id ?? "AFRICA_OU";
}

/** Router basename: the region folder the page was opened under, or "" in dev. */
export function appBase(): string {
  return fromPath()?.base ?? "";
}

/** Studies with a Benefits Platform Dashboard (benefits rolled up to TCCC platforms). */
export function hasPlatformDashboard(region: Region = getRegion()): boolean {
  return region === "ASP_GLOBAL" || region === "AFRICA_OU";
}

/** Benefits Platform Dashboard: every benefit axis is rolled up to benefit platforms. */
export function isPlatformView(): boolean {
  return hasPlatformDashboard() && typeof window !== "undefined" &&
    window.location.pathname.toLowerCase().replace(/\/+$/, "").endsWith("/platform-dashboard");
}

/** Column header for the item axis: platforms on the Benefits Platform Dashboard. */
export function itemHeader(): string {
  return isPlatformView() ? "Benefits Platform" : "Benefit";
}

/** ASP only: a benefit-platforms home page at /home in front of the dashboard. */
export function hasHome(region: Region = getRegion()): boolean {
  return region === "ASP_GLOBAL";
}

/** Awareness and the benefit association matrices need questions the protein
 *  survey never asked (it is a MaxDiff only), so those parts are left out. */
export function hasAwarenessAndAssociations(region: Region = getRegion()): boolean {
  return region !== "PROTEIN";
}

/** The brand colour's name, for on-screen copy that points at coloured marks. */
export function brandColorName(region: Region = getRegion()): string {
  return region === "PROTEIN" ? "violet" : "red";
}

export function regionInfo(region: Region = getRegion()) {
  return REGIONS.find((r) => r.id === region) ?? REGIONS[0];
}

/** The product name on the nav, login and chat headers. */
export function brandTitle(r: { id: Region; title: string } = regionInfo()): string {
  return r.id === "PROTEIN" ? "Your DietO" : `Coca-Cola ${r.title}`;
}

/** The chat assistant's name. */
export function aiName(region: Region = getRegion()): string {
  return region === "PROTEIN" ? "PulseAI" : "CokeAI";
}

/** The letters in the square logo mark. */
export function brandMark(region: Region = getRegion()): string {
  return region === "PROTEIN" ? "P" : "CE";
}

/** Protein has no filter rail: one market and no cuts worth offering. */
export function hasFilters(region: Region = getRegion()): boolean {
  return region !== "PROTEIN";
}

type Unit = { code: string; label: string; markets: number[] };

/** The client's operating units over the ingest's sub-regions: Japan and South
 *  Korea report as one unit (JSK OU). A sub-region missing here keeps its own
 *  code and label, so a new one still shows up rather than disappearing. */
const OPERATING_UNITS: { code: string; label: string; from: string[] }[] = [
  { code: "ASP", label: "ASP OU", from: ["ASP"] },
  { code: "GCM", label: "GCM OU", from: ["GCM", "CHINA"] },
  { code: "JSK", label: "JSK OU", from: ["JSK", "JAPAN", "KOREA"] },
  { code: "LATAM", label: "LATAM OU", from: ["LATAM"] },
];

export function operatingUnits(subregions: Unit[] = []): Unit[] {
  const byCode = new Map(subregions.map((s) => [s.code.toUpperCase(), s]));
  const used = new Set<string>();
  const units = OPERATING_UNITS.flatMap((u) => {
    const parts = u.from.map((c) => byCode.get(c)).filter((s): s is Unit => !!s);
    parts.forEach((s) => used.add(s.code.toUpperCase()));
    return parts.length ? [{ code: u.code, label: u.label, markets: parts.flatMap((s) => s.markets) }] : [];
  });
  return [...units, ...subregions.filter((s) => !used.has(s.code.toUpperCase()))];
}

/** A dashboard anyone can open without signing in; the server decides the same way. */
export function isPublic(region: Region = getRegion()): boolean {
  return region === "PROTEIN";
}
