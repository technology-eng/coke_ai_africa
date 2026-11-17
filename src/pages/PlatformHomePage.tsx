import { Info } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { TopNav } from "@/components/TopNav";
import { cn } from "@/lib/utils";
import { getHomeMarket, getHomeSummary } from "@/services/api";
import type {
  HomeMarketResponse,
  MarketCagr,
  MarketEnds,
} from "@/types/maxdiff";

/**
 * ASP home, laid out as the "Benefit platforms: size and share" mockup, on
 * Euromonitor platform sizing (/home/market, retail value in USD million).
 *
 *   Size      value of the categories serving a platform's opportunity spaces
 *   Coca-Cola value of Coca-Cola's brands in those spaces (the solid bar)
 *   Headroom  size minus Coca-Cola (the faded bar)
 *   Share     size as % of the total across the view
 *
 * Platform view ranks platforms, split by country / category / brand; country
 * view ranks countries, split by platform / category / brand. Category and
 * brand splits carry no Coca-Cola detail, so their bars are size only.
 *
 * Year selector: actual and forecast years. Brand rows (so Coca-Cola value and
 * headroom) exist for one year only; other years show size only. CAGR is
 * (Σto / Σfrom)^(1/n) − 1 over the rows making each total, per window the
 * backend lists (history, forecast); never across the 2025 to 2026 price break.
 */

type View = "platform" | "country";
type Dim = "total" | "country" | "platform" | "category" | "brand";
type SplitDim = Exclude<Dim, "total">;
type Metric = "size" | "share";
type Mode = "abs" | "cmp";

/** A value with Coca-Cola's part; `coke` null where the source has no brand detail. `ends` per CAGR window. */
type Part = { size: number; coke: number | null; ends?: MarketEnds };

interface Model {
  ents: string[]; // ranked by size
  tot: Record<string, Part>;
  items: Partial<Record<SplitDim, string[]>>;
  parts: Partial<Record<SplitDim, Record<string, Part[]>>>;
}

// Current palette: Coca-Cola red, then the neutrals; "Other" is the light grey.
const COL = [
  "#F40009",
  "#A2000A",
  "#1A1A1A",
  "#6B6B6B",
  "#9A9A9A",
  "#F7A3A6",
  "#4A4A4A",
];
const OTHER_COL = "#C8C8C8";
const BL = "#F40009"; // first entity, and Coca-Cola
const OR = "#4A4A4A"; // second entity in a comparison
const txtc = (c: string) =>
  c === OTHER_COL || c === "#F7A3A6" || c === "#9A9A9A" ? "#1A1A1A" : "#fff";
const TOP_CATEGORIES = 7;
const TOP_BRANDS = 6;
const OTHER_CATS = "Other categories";
const OTHER_BRANDS = "Other brands";
const COKE = "Coca-Cola";

const DIMS: Record<View, [Dim, string][]> = {
  platform: [
    ["total", "Total"],
    ["country", "Country"],
    ["category", "Category"],
    ["brand", "Brand"],
  ],
  country: [
    ["total", "Total"],
    ["platform", "Platform"],
    ["category", "Category"],
    ["brand", "Brand"],
  ],
};

/** Source values are USD million: $1,000M and up reads in billions (2 decimals under $10B). */
const amount = (n: number) => {
  const a = Math.abs(n);
  if (a < 1000) return `${Math.round(a).toLocaleString("en-US")}M`;
  const v = a / 1000;
  return `${v.toLocaleString("en-US", { maximumFractionDigits: v < 10 ? 2 : 1 })}B`;
};
const fmt = (n: number | null | undefined) =>
  n == null ? "—" : `${n < 0 ? "−" : ""}$${amount(n)}`;
const sg = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}$${amount(n)}`;
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const cokeOf = (p: Part) => (p.coke == null ? null : Math.min(p.coke, p.size));
const headOf = (p: Part) =>
  p.coke == null ? null : Math.max(0, p.size - p.coke);
/** Signed % with 1 decimal. */
const gfmt = (g: number | null) =>
  g == null ? "—" : `${g < 0 ? "−" : "+"}${Math.abs(g * 100).toFixed(1)}%`;
/** CAGR of [value at from, value at to] over the window; null when the start is not positive. */
const growth = (e: [number, number] | undefined, w: MarketCagr) =>
  !e || w.to <= w.from || e[0] <= 0
    ? null
    : (e[1] / e[0]) ** (1 / (w.to - w.from)) - 1;
const wlabel = (w: MarketCagr) => `${w.label}${w.forecast ? " (F)" : ""}`;
/** "2023-25 +3.1% · 2026-30 (F) +4.2%", or "" when the part has no CAGR at all. */
const cagrLine = (ws: MarketCagr[], p: Part) => {
  const g = ws.map((w, i) => growth(p.ends?.[i], w));
  return g.every((x) => x == null)
    ? ""
    : ws.map((w, i) => `${wlabel(w)} ${gfmt(g[i])}`).join(" · ");
};
const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);
const rank = (t: Record<string, number>) =>
  Object.keys(t).sort((x, y) => t[y] - t[x]);

function build(d: HomeMarketResponse, view: View): Model {
  const mname = (code: number) =>
    d.markets.find((m) => m.code === code)?.name ?? String(code);
  const entOf = (platform: string, market: number) =>
    view === "platform" ? platform : mname(market);
  const cross: SplitDim = view === "platform" ? "country" : "platform";
  const crossOf = (platform: string, market: number) =>
    view === "platform" ? mname(market) : platform;
  // No brand rows (a year without brand detail): Coca-Cola and headroom stay null, not 0.
  const k0 = d.brands.length ? 0 : null;
  const nw = d.cagr?.length ?? 0;
  const zeros = (): MarketEnds => Array.from({ length: nw }, () => [0, 0]);
  const add = (
    rec: Record<string, Part>,
    k: string,
    v: number,
    coke: boolean,
    ends?: MarketEnds,
  ) => {
    const p = (rec[k] ??= { size: 0, coke: k0, ends: zeros() });
    if (coke) p.coke = (p.coke ?? 0) + v;
    else p.size += v;
    ends?.slice(0, nw).forEach((x, i) => {
      p.ends![i][0] += x[0];
      p.ends![i][1] += x[1];
    });
  };

  // Split items are shared by every row: the biggest categories and non-Coca-Cola brands overall.
  const catTot: Record<string, number> = {};
  const platTot: Record<string, number> = {};
  for (const r of d.rows) {
    catTot[r.category] = (catTot[r.category] ?? 0) + r.value;
    platTot[r.platform] = (platTot[r.platform] ?? 0) + r.value;
  }
  const cats = rank(catTot);
  const topCats = cats.slice(0, TOP_CATEGORIES);
  const brandTot: Record<string, number> = {};
  for (const b of d.brands)
    if (!b.coke) brandTot[b.brand] = (brandTot[b.brand] ?? 0) + b.value;
  const topBrands = rank(brandTot).slice(0, TOP_BRANDS);

  const tot: Record<string, Part> = {};
  const cell: Record<SplitDim, Record<string, Record<string, Part>>> = {
    country: {},
    platform: {},
    category: {},
    brand: {},
  };
  const at = (dim: SplitDim, e: string) => (cell[dim][e] ??= {});

  for (const r of d.rows) {
    const e = entOf(r.platform, r.market);
    add(tot, e, r.value, false, r.ends);
    add(at(cross, e), crossOf(r.platform, r.market), r.value, false, r.ends);
    add(
      at("category", e),
      topCats.includes(r.category) ? r.category : OTHER_CATS,
      r.value,
      false,
      r.ends,
    );
  }
  for (const b of d.brands) {
    const e = entOf(b.platform, b.market);
    if (!tot[e]) continue;
    if (b.coke) {
      add(tot, e, b.value, true);
      add(at(cross, e), crossOf(b.platform, b.market), b.value, true);
      add(at("brand", e), COKE, b.value, false);
    } else if (topBrands.includes(b.brand))
      add(at("brand", e), b.brand, b.value, false);
  }

  const ents = rank(
    Object.fromEntries(Object.entries(tot).map(([k, p]) => [k, p.size])),
  );
  const items: Model["items"] = {
    [cross]: view === "platform" ? d.markets.map((m) => m.name) : rank(platTot),
    category: cats.length > TOP_CATEGORIES ? [...topCats, OTHER_CATS] : topCats,
    brand: [COKE, ...topBrands, OTHER_BRANDS],
  };
  const parts: Model["parts"] = { [cross]: {}, category: {}, brand: {} };
  for (const e of ents) {
    parts[cross]![e] = items[cross]!.map(
      (it) => cell[cross][e]?.[it] ?? { size: 0, coke: k0, ends: zeros() },
    );
    parts.category![e] = items.category!.map((it) => ({
      size: cell.category[e]?.[it]?.size ?? 0,
      coke: null,
      ends: cell.category[e]?.[it]?.ends ?? zeros(),
    }));
    // "Other brands" is everything outside Coca-Cola and the top brands.
    const listed = [COKE, ...topBrands].map(
      (it) => cell.brand[e]?.[it]?.size ?? 0,
    );
    parts.brand![e] = [...listed, Math.max(0, tot[e].size - sum(listed))].map(
      (size) => ({ size, coke: null }),
    );
  }
  return { ents, tot, items, parts };
}

function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "mb-2 flex overflow-hidden rounded-lg border border-foreground/30",
        className,
      )}
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className={cn(
            "flex-1 px-0.5 py-2 text-[13px] transition-colors",
            v === value
              ? "bg-primary font-medium text-primary-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

type Piece = {
  v: number;
  color: string;
  fade?: boolean;
  label?: string;
  title?: string;
};

/** One bar of pieces, `width` % of the row (the mockup's .track). */
function Track({ pieces, width }: { pieces: Piece[]; width: number }) {
  return (
    <div
      className="mb-[3px] flex h-[18px] gap-[2px]"
      style={{ width: `${Math.max(width, 1)}%` }}
    >
      {pieces.map((p, i) => (
        <div
          key={i}
          title={p.title}
          className={cn(
            "flex h-full items-center justify-center overflow-hidden whitespace-nowrap text-[11px]",
            pieces.length === 1
              ? "rounded"
              : i === 0
                ? "rounded-l"
                : i === pieces.length - 1
                  ? "rounded-r"
                  : "rounded-[2px]",
          )}
          style={{
            flex: `${p.v} 1 0`,
            background: p.color,
            opacity: p.fade ? 0.3 : 1,
            color: txtc(p.color),
          }}
        >
          {p.label}
        </div>
      ))}
    </div>
  );
}

/** Solid Coca-Cola then faded headroom when the part has brand detail, else one solid bar. */
const sizePieces = (p: Part, color: string, title: string): Piece[] =>
  p.coke == null
    ? [{ v: p.size, color, title }]
    : [
        { v: cokeOf(p) ?? 0, color, title },
        { v: headOf(p) ?? 0, color, fade: true, title },
      ];

function Lg({
  color,
  fade,
  children,
}: {
  color: string;
  fade?: boolean;
  children: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className="h-2.5 w-2.5 flex-none rounded-[2px]"
        style={{ background: color, opacity: fade ? 0.3 : 1 }}
      />
      {children}
    </div>
  );
}

function Row({
  name,
  sub,
  right,
  children,
}: {
  name: string;
  sub?: string;
  right: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between gap-2 text-[13px]">
        <span
          className="truncate"
          title={sub ? `${name}\nCAGR ${sub}` : undefined}
        >
          {name}
          {sub && (
            <span className="ml-2 hidden text-[11px] text-muted-foreground sm:inline">
              CAGR {sub}
            </span>
          )}
        </span>
        <span className="shrink-0 text-right tabular-nums">{right}</span>
      </div>
      {children}
    </div>
  );
}

function Kc({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted px-3 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

/**
 * ASP top 5 prioritised benefit platforms, as on the client's summary slide.
 * The five platforms, their groups and "TCCC ownable technology" are the
 * client's fixed choices, not ranked from the data. Sizing rows come from the
 * same build() as the explorer below, always on the default (latest actual,
 * brand) year whatever year the explorer shows; desirability from /home/summary.
 */
const SLIDE_GROUPS: { label: string; platforms: string[] }[] = [
  { label: "Engine", platforms: ["Sensorials"] },
  {
    label: "3 Newly Prioritized benefit platforms",
    platforms: [
      "Sustained Invigoration",
      "Weight & Strength Balance",
      "Next Gen Hydration",
    ],
  },
  { label: "Wildcard", platforms: ["Beauty"] },
];
const SLIDE_PLATFORMS = SLIDE_GROUPS.flatMap((g) => g.platforms);
const OWNABLE: Record<string, string> = Object.fromEntries(
  SLIDE_PLATFORMS.map((p) => [p, "Y"]),
);
const bn = (n: number | null | undefined) =>
  n == null ? "—" : (n / 1000).toFixed(1);

/**
 * "How it's calculated" icon. The popup is position: fixed so the table's
 * overflow-x wrapper can't clip it; hover, focus or tap opens it.
 */
function InfoTip({ text }: { text: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(r.left - 8, window.innerWidth - 328)),
      y: r.bottom + 6,
    });
  };
  const hide = () => setPos(null);
  return (
    <>
      <button
        type="button"
        aria-label={`How it is calculated: ${text}`}
        onMouseEnter={(e) => show(e.currentTarget)}
        onMouseLeave={hide}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={hide}
        onClick={(e) => show(e.currentTarget)}
        className="ml-1 inline-flex cursor-help align-[-2px] text-muted-foreground hover:text-foreground focus:text-foreground focus:outline-none"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {pos && (
        <span
          role="tooltip"
          style={{ left: pos.x, top: pos.y }}
          className="pointer-events-none fixed z-50 w-80 whitespace-normal rounded-md border bg-background p-2.5 text-[12.5px] font-normal leading-snug text-foreground shadow-lg"
        >
          {text}
        </span>
      )}
    </>
  );
}

// Platform names as two-line column headers, so the five columns stay narrow.
const TWO_LINE: Record<string, string[]> = {
  "Sustained Invigoration": ["Sustained", "Invigoration"],
  "Weight & Strength Balance": ["Weight & Strength", "Balance"],
  "Next Gen Hydration": ["Next Gen", "Hydration"],
};

function SlideSummary() {
  const mq = useQuery({
    queryKey: ["home", "market", "latest"],
    queryFn: () => getHomeMarket(undefined),
    staleTime: 30 * 60_000,
  });
  const [market, setMarket] = useState<number | null>(null); // null = all ASP markets
  const sq = useQuery({
    queryKey: ["home", "summary", market ?? "all"],
    queryFn: () => getHomeSummary(market ?? undefined),
    staleTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });
  const d = mq.data;
  const mk = d?.markets.find((x) => x.code === market) ?? null;
  // One market: the same sizing over that market's rows only.
  const fd = useMemo(
    () =>
      d && mk
        ? {
            ...d,
            rows: d.rows.filter((r) => r.market === mk.code),
            brands: d.brands.filter((b) => b.market === mk.code),
            category_totals: d.category_totals.filter(
              (t) => t.market === mk.code,
            ),
          }
        : d,
    [d, mk],
  );
  const m = useMemo(
    () => (fd && fd.rows.length ? build(fd, "platform") : null),
    [fd],
  );
  const scope = mk ? mk.name : "total ASP";
  const over = mk ? `in ${mk.name}` : "summed over the five markets";
  if (mq.isLoading || sq.isLoading)
    return (
      <div
        className="mb-6 h-64 animate-pulse rounded-lg bg-muted"
        aria-busy="true"
      />
    );
  if (!m || !d) return null;

  const fi = (d.cagr ?? []).findIndex((w) => w.forecast);
  const fw = fi >= 0 ? d.cagr![fi] : null;
  const des = Object.fromEntries(
    (sq.data?.platforms ?? []).map((p) => [p.platform, p]),
  );
  const part = (p: string): Part | undefined => m.tot[p];
  const yr = d.year ?? "";
  type R = {
    group?: string;
    label: string;
    how: string;
    cell: (p: string) => string;
    tone: "dark" | "mid" | "light";
  };
  const rows: R[] = [
    {
      group: "Consumer desirability",
      label: `% of respondents, ${scope}`,
      how: `Respondents who said yes at M3 (would want a product delivering the benefit) for at least one of the platform's benefits, divided by all ${mk ? mk.name : "ASP"} respondents. Each person counts once per platform. Unweighted.`,
      tone: "dark",
      cell: (p) =>
        des[p]?.share == null ? "—" : `${Math.round(des[p].share!)}%`,
    },
    {
      label: "Projected interested population (M)*",
      how: mk
        ? `The share of ${mk.name} respondents counted in the row above, times ${mk.name}'s population, in millions.`
        : "Market by market: the share of that market's respondents counted in the row above, times the market's population. Summed over the five markets, in millions.",
      tone: "dark",
      cell: (p) =>
        des[p]?.projected == null ? "—" : (des[p].projected! / 1e6).toFixed(1),
    },
    {
      group: "Technical know-how",
      label: "TCCC ownable technology",
      how: "TCCC's own assessment, as shown on the client slide. Not calculated from survey or Euromonitor data.",
      tone: "light",
      cell: (p) => OWNABLE[p] ?? "—",
    },
    {
      group: "Industry opportunity",
      label: `${yr} industry value ($B)`,
      how: `Euromonitor retail value in ${yr} of the categories mapped to the platform, ${over}.`,
      tone: "mid",
      cell: (p) => bn(part(p)?.size),
    },
    {
      label: `${yr} TCCC value`,
      how: `The Coca-Cola Company's own ${yr} retail value in the categories mapped to the platform (Euromonitor), ${over}.`,
      tone: "mid",
      cell: (p) => bn(part(p)?.coke ?? undefined),
    },
    {
      label: `${yr} TCCC value headroom ($B)`,
      how: `${yr} industry value minus The Coca-Cola Company's own value in those categories (Euromonitor), floored at zero.`,
      tone: "mid",
      cell: (p) => {
        const x = part(p);
        return x ? bn(headOf(x)) : "—";
      },
    },
    ...(fw
      ? ([
          {
            label: `${fw.from}-${fw.to} industry CAGR`,
            how: `Compound annual growth of the industry value from ${fw.from} to ${fw.to} (Euromonitor forecast): (value ${fw.to} / value ${fw.from})^(1/${fw.to - fw.from}) − 1.`,
            tone: "mid",
            cell: (p) => {
              const g = growth(part(p)?.ends?.[fi], fw);
              return g == null ? "—" : `${(g * 100).toFixed(1)}%`;
            },
          },
          {
            label: `${fw.to} industry value ($B)`,
            how: `Euromonitor forecast retail value for ${fw.to}, ${over}.`,
            tone: "mid",
            cell: (p) => bn(part(p)?.ends?.[fi]?.[1]),
          },
        ] as R[])
      : []),
  ];
  const toneCls = {
    dark: "bg-coke-red text-white font-medium",
    mid: "bg-[#F7A3A6] text-[#1A1A1A]",
    light: "bg-[#FBE3E4] text-[#1A1A1A]",
  };

  return (
    <section aria-labelledby="asp-top5">
      <div className="mx-auto w-fit max-w-full">
        <h1 id="asp-top5" className="mb-0.5 text-[22px] font-medium">
          ASP top 5 prioritised benefit platforms
        </h1>
        <p className="mb-2 text-[13px] text-muted-foreground">
          {mk ? mk.name : "All five ASP markets"}. Platforms and groups as
          prioritised by TCCC.
        </p>
        {d.markets.length > 1 && (
          <Seg
            className="divide-x divide-foreground/30"
            label="Market"
            value={mk ? String(mk.code) : "all"}
            options={[
              ["all", "All ASP"],
              ...d.markets.map((x): [string, string] => [
                String(x.code),
                x.name,
              ]),
            ]}
            onChange={(v) => setMarket(v === "all" ? null : Number(v))}
          />
        )}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-border text-[13px]">
            <thead>
              <tr>
                <th colSpan={2} className="border-r border-border" />
                {SLIDE_GROUPS.map((g) => (
                  <th
                    key={g.label}
                    colSpan={g.platforms.length}
                    className="border-b-2 border-r border-b-coke-red border-r-border px-2 pb-0.5 text-center text-[13px] font-semibold"
                  >
                    {g.label}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-border">
                <th colSpan={2} className="border-r border-border" />
                {SLIDE_PLATFORMS.map((p) => (
                  <th
                    key={p}
                    className="w-[112px] border-r border-border px-2 py-1.5 text-center align-bottom text-[13px] font-semibold leading-tight"
                  >
                    {(TWO_LINE[p] ?? [p]).map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                let span = 0;
                if (r.group)
                  for (
                    span = 1;
                    i + span < rows.length && !rows[i + span].group;
                    span++
                  );
                return (
                  <tr
                    key={r.label}
                    className={cn("border-b border-border/70", toneCls[r.tone])}
                  >
                    {r.group && (
                      <th
                        scope="rowgroup"
                        rowSpan={span}
                        className="whitespace-nowrap border-r border-border bg-background px-3 text-left align-middle font-semibold leading-tight text-foreground"
                      >
                        {r.group}
                      </th>
                    )}
                    <th
                      scope="row"
                      className="whitespace-nowrap border-r border-border/70 px-3 py-2 text-left align-middle font-medium leading-tight"
                    >
                      {r.label}
                      <InfoTip text={r.how} />
                    </th>
                    {SLIDE_PLATFORMS.map((p) => (
                      <td
                        key={p}
                        className="border-r border-border/70 px-2 py-2 text-center tabular-nums"
                      >
                        {r.cell(p)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11.5px] leading-snug text-muted-foreground">
          % of respondents: {sq.data?.measure ?? "share of respondents"} Base n=
          {sq.data?.base_n?.toLocaleString() ?? "—"}.
          <br />* Projected onto{" "}
          {sq.data?.population_source ?? "total population"}, market by market.
          <br />
          Sources: {d.source}; APAC Functional Benefits MaxDiff study.
        </p>
      </div>
    </section>
  );
}

/** ASP only: the top-5 prioritised benefit platforms summary, on its own tab. */
export function TopPlatformsPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav title="Top 5 prioritised benefit platforms" />
      <main className="w-full px-6 pb-4 pt-4 lg:px-10">
        <SlideSummary />
      </main>
    </div>
  );
}

export function PlatformHomePage() {
  const [year, setYear] = useState<number>(); // undefined: the backend's default (latest actual)
  const q = useQuery({
    queryKey: ["home", "market", year ?? "latest"],
    queryFn: () => getHomeMarket(year),
    staleTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });
  const [view, setView] = useState<View>("platform");
  const [dim, setDim] = useState<Dim>("total");
  const [met, setMet] = useState<Metric>("size");
  const [mode, setMode] = useState<Mode>("abs");
  const [pa, setPa] = useState(0);
  const [pb, setPb] = useState(1);
  const [market, setMarket] = useState<number | null>(null); // platform view only; null = all countries

  const d = q.data;
  const country =
    view === "platform" && d?.markets.some((x) => x.code === market)
      ? market
      : null;
  // One country: the same model over that country's rows only.
  const fd = useMemo(
    () =>
      d && country != null
        ? {
            ...d,
            rows: d.rows.filter((r) => r.market === country),
            brands: d.brands.filter((b) => b.market === country),
            category_totals: d.category_totals.filter(
              (t) => t.market === country,
            ),
          }
        : d,
    [d, country],
  );
  const m = useMemo(
    () => (fd && fd.rows.length ? build(fd, view) : null),
    [fd, view],
  );
  const windows = d?.cagr ?? [];
  const hasBrands = !!d?.brands.length;
  const years = d?.years ?? [];
  const isForecast = years.some((y) => y.year === d?.year && y.forecast);

  const E = m?.ents ?? [];
  const last = Math.max(0, E.length - 1);
  const a = Math.min(pa, last);
  // Never compare an entity with itself.
  const b =
    E.length > 1 && Math.min(pb, last) === a
      ? (a + 1) % E.length
      : Math.min(pb, last);
  const dims = DIMS[view].filter(
    ([x]) =>
      (hasBrands || x !== "brand") && (country == null || x !== "country"),
  );
  const dd: Dim = dims.some(([x]) => x === dim) ? dim : "total";

  let kpi: ReactNode = null;
  let kpi2: ReactNode = null;
  let chart: ReactNode = null;
  let note = "";

  if (m && E.length) {
    const GS = sum(E.map((e) => m.tot[e].size));
    const GH = hasBrands ? sum(E.map((e) => headOf(m.tot[e]) ?? 0)) : null;
    const tip = (name: string, p: Part) =>
      [
        name,
        `Size ${fmt(p.size)}`,
        p.coke != null
          ? `Coca-Cola ${fmt(cokeOf(p))} · Headroom ${fmt(headOf(p))}`
          : "",
        cagrLine(windows, p) && `CAGR ${cagrLine(windows, p)}`,
      ]
        .filter(Boolean)
        .join("\n");
    const mx = Math.max(...E.map((e) => m.tot[e].size));

    if (mode === "abs") {
      const top = E[0];
      // Same rows as the total above: the sum over every entity.
      const GE = windows.map((_, i): [number, number] => [
        sum(E.map((e) => m.tot[e].ends?.[i]?.[0] ?? 0)),
        sum(E.map((e) => m.tot[e].ends?.[i]?.[1] ?? 0)),
      ]);
      kpi2 = windows.map((w, i) => (
        <Kc key={w.label} label={`CAGR ${wlabel(w)}`}>
          <div className="text-[19px] font-medium">
            {gfmt(growth(GE[i], w))}
          </div>
        </Kc>
      ));
      kpi = (
        <>
          <Kc label="Size, total">
            <div className="text-[19px] font-medium">{fmt(GS)}</div>
          </Kc>
          <Kc label="Headroom">
            <div className="text-[19px] font-medium">{fmt(GH)}</div>
          </Kc>
          <Kc label="Largest">
            <div className="truncate text-[19px] font-medium" title={top}>
              {top} {pct(m.tot[top].size, GS)}%
            </div>
          </Kc>
        </>
      );
      if (dd === "total") {
        chart = (
          <>
            <div className="mb-2.5 flex gap-3.5">
              <Lg color={BL}>
                {met === "size"
                  ? hasBrands
                    ? "Coca-Cola today"
                    : "Size"
                  : "Share of total size"}
              </Lg>
              {met === "size" && hasBrands && (
                <Lg color={BL} fade>
                  Headroom
                </Lg>
              )}
            </div>
            {E.map((e) => {
              const p = m.tot[e];
              return met === "size" ? (
                <Row
                  key={e}
                  name={e}
                  sub={cagrLine(windows, p)}
                  right={
                    hasBrands
                      ? `${fmt(cokeOf(p))} + ${fmt(headOf(p))}`
                      : fmt(p.size)
                  }
                >
                  <Track
                    width={(100 * p.size) / mx}
                    pieces={sizePieces(p, BL, tip(e, p))}
                  />
                </Row>
              ) : (
                <Row
                  key={e}
                  name={e}
                  sub={cagrLine(windows, p)}
                  right={`${pct(p.size, GS)}%`}
                >
                  <Track
                    width={(100 * p.size) / mx}
                    pieces={[{ v: 1, color: BL, title: tip(e, p) }]}
                  />
                </Row>
              );
            })}
          </>
        );
      } else {
        const items = m.items[dd] ?? [];
        const colors = items.map((it, i) =>
          it === OTHER_CATS || it === OTHER_BRANDS
            ? OTHER_COL
            : COL[i % COL.length],
        );
        chart = (
          <>
            <div className="mb-2.5 flex flex-wrap gap-x-3.5 gap-y-1.5">
              {items.map((it, i) => (
                <Lg key={it} color={colors[i]}>
                  {it}
                </Lg>
              ))}
            </div>
            {E.map((e) => {
              const s = m.tot[e].size;
              const ps = m.parts[dd]![e];
              return met === "size" ? (
                <Row
                  key={e}
                  name={e}
                  sub={cagrLine(windows, m.tot[e])}
                  right={fmt(s)}
                >
                  <Track
                    width={(100 * s) / mx}
                    pieces={ps.map((p, j) => ({
                      v: p.size,
                      color: colors[j],
                      title: tip(`${e} · ${items[j]}`, p),
                    }))}
                  />
                </Row>
              ) : (
                <Row
                  key={e}
                  name={e}
                  sub={cagrLine(windows, m.tot[e])}
                  right={`${pct(s, GS)}% of total`}
                >
                  <Track
                    width={100}
                    pieces={ps.map((p, j) => ({
                      v: p.size,
                      color: colors[j],
                      label:
                        s && p.size / s >= 0.12 ? `${pct(p.size, s)}%` : "",
                      title: tip(`${e} · ${items[j]}`, p),
                    }))}
                  />
                </Row>
              );
            })}
          </>
        );
      }
      note =
        `All ${E.length} ${view === "platform" ? "platforms" : "countries"}, ranked by size, USD. ` +
        (met === "share"
          ? dd === "total"
            ? "Share = % of total size."
            : "Each bar = 100% of that row."
          : dd === "brand"
            ? `Coca-Cola, the top ${TOP_BRANDS} other brands, and the rest of the market.`
            : dd === "category"
              ? `Top ${TOP_CATEGORIES} categories; the rest grouped.`
              : hasBrands
                ? "Headroom = market value not yet held by Coca-Cola's brands."
                : "Size only: no Coca-Cola brand detail for this year.");
    } else {
      const A = m.tot[E[a]];
      const B = m.tot[E[b]];
      const two = (x: string, y: string) => (
        <>
          <div
            className="truncate text-[13px] font-medium"
            style={{ color: BL }}
          >
            {E[a]} {x}
          </div>
          <div
            className="truncate text-[13px] font-medium"
            style={{ color: OR }}
          >
            {E[b]} {y}
          </div>
        </>
      );
      kpi = (
        <>
          <Kc label="Size">{two(fmt(A.size), fmt(B.size))}</Kc>
          <Kc label="Headroom">{two(fmt(headOf(A)), fmt(headOf(B)))}</Kc>
          <Kc label="Share of total">
            {two(`${pct(A.size, GS)}%`, `${pct(B.size, GS)}%`)}
          </Kc>
        </>
      );
      kpi2 = windows.map((w, i) => (
        <Kc key={w.label} label={`CAGR ${wlabel(w)}`}>
          {two(gfmt(growth(A.ends?.[i], w)), gfmt(growth(B.ends?.[i], w)))}
        </Kc>
      ));
      const labels = dd === "total" ? ["All"] : (m.items[dd] ?? []);
      const get = (e: string, i: number): [Part, number] =>
        dd === "total" ? [m.tot[e], GS] : [m.parts[dd]![e][i], m.tot[e].size];
      const val = ([p, base]: [Part, number]) =>
        met === "size" ? p.size : pct(p.size, base);
      const cmx = Math.max(
        1,
        ...labels.flatMap((_, i) => [val(get(E[a], i)), val(get(E[b], i))]),
      );
      chart = (
        <>
          <div className="mb-2.5 flex flex-wrap gap-x-3.5 gap-y-1.5">
            <Lg color={BL}>{E[a]}</Lg>
            <Lg color={OR}>{E[b]}</Lg>
            {met === "size" && hasBrands && (
              <Lg color="#9A9A9A" fade>
                Headroom (faded)
              </Lg>
            )}
          </div>
          {labels.map((l, i) => {
            const x = get(E[a], i);
            const y = get(E[b], i);
            const hx = headOf(x[0]);
            const hy = headOf(y[0]);
            const gap =
              met === "size"
                ? `Size ${sg(x[0].size - y[0].size)}${hx != null && hy != null ? ` · Headroom ${sg(hx - hy)}` : ""}`
                : `Share ${sg(val(x) - val(y))} pt`;
            return (
              <Row key={l} name={l} right={gap}>
                {(
                  [
                    [x, BL, E[a]],
                    [y, OR, E[b]],
                  ] as const
                ).map(([z, c, n]) =>
                  met === "size" ? (
                    <Track
                      key={c}
                      width={(100 * z[0].size) / cmx}
                      pieces={sizePieces(z[0], c, tip(`${n} · ${l}`, z[0]))}
                    />
                  ) : (
                    <Track
                      key={c}
                      width={Math.max(8, (100 * val(z)) / cmx)}
                      pieces={[
                        {
                          v: 1,
                          color: c,
                          label: `${val(z)}%`,
                          title: tip(`${n} · ${l}`, z[0]),
                        },
                      ]}
                    />
                  ),
                )}
              </Row>
            );
          })}
        </>
      );
      note =
        met === "size"
          ? `Gap = ${E[a]} minus ${E[b]}, USD. Positive means ${E[a]} is larger.`
          : `${dd === "total" ? `Share = % of total size across all ${E.length}.` : "Share = % of each one's own size."} Gap in percentage points.`;
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav title="Benefit platforms — size and share" />
      <main className="mx-auto max-w-[720px] px-4 pb-10 pt-5">
        <h2 className="mb-1 text-[22px] font-medium">
          Benefit platforms: size and share
        </h2>
        <p className="mb-3 text-[13px] text-muted-foreground">
          Euromonitor {d?.year ?? ""}
          {isForecast ? " (forecast)" : ""} retail value, USD. Switch year,
          view, split and metric to explore.
        </p>
        {years.length > 1 && (
          <div className="mb-3.5">
            <Seg
              label="Year"
              value={String(year ?? d?.year ?? "")}
              options={years.map((y) => [
                String(y.year),
                `${y.year}${y.forecast ? "F" : ""}`,
              ])}
              onChange={(v) => {
                setYear(Number(v));
                setPa(0);
                setPb(1);
              }}
            />
            {!hasBrands && d?.brand_year != null && (
              <p className="text-xs text-muted-foreground">
                Coca-Cola value and headroom are available for {d.brand_year}{" "}
                only.
              </p>
            )}
          </div>
        )}

        {q.isLoading ? (
          <div
            className="animate-pulse space-y-2"
            aria-busy="true"
            aria-label="Loading"
          >
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-muted" />
              ))}
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-9 rounded-lg bg-muted" />
            ))}
          </div>
        ) : q.isError ? (
          <div className="rounded-lg border border-coke-red/40 p-4 text-sm">
            Could not load platform sizing. Try again later.
          </div>
        ) : !m ? (
          <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            {d?.warning ?? "No market sizing has been loaded yet."}
          </div>
        ) : (
          <div
            className={cn(
              q.isPlaceholderData && "opacity-60 transition-opacity",
            )}
          >
            <div
              className={cn("grid grid-cols-3 gap-2", kpi2 ? "mb-2" : "mb-3.5")}
            >
              {kpi}
            </div>
            {kpi2 && (
              <div className="mb-3.5 grid grid-cols-2 gap-2">{kpi2}</div>
            )}

            <Seg<View>
              label="View"
              value={view}
              options={[
                ["platform", "Platform view"],
                ["country", "Country view"],
              ]}
              onChange={(v) => {
                setView(v);
                if (dim === "country" && v === "country") setDim("platform");
                else if (dim === "platform" && v === "platform")
                  setDim("country");
                setPa(0);
                setPb(1);
              }}
            />
            {view === "platform" && (d?.markets.length ?? 0) > 1 && (
              <Seg
                label="Country"
                value={country == null ? "all" : String(country)}
                options={[
                  ["all", "All countries"],
                  ...(d?.markets ?? []).map((x): [string, string] => [
                    String(x.code),
                    x.name,
                  ]),
                ]}
                onChange={(v) => {
                  setMarket(v === "all" ? null : Number(v));
                  setPa(0);
                  setPb(1);
                }}
              />
            )}
            <Seg<Dim>
              label="Split"
              value={dd}
              options={dims}
              onChange={setDim}
            />
            <Seg<Metric>
              label="Metric"
              value={met}
              options={[
                ["size", "Size"],
                ["share", "Share"],
              ]}
              onChange={setMet}
            />
            <Seg<Mode>
              label="Mode"
              value={mode}
              options={[
                ["abs", "Absolute"],
                ["cmp", "Compare two"],
              ]}
              onChange={setMode}
            />
            {mode === "cmp" && (
              <div className="mb-2 grid grid-cols-2 gap-2">
                {(
                  [
                    [a, setPa, "First"],
                    [b, setPb, "Second"],
                  ] as const
                ).map(([v, set, label]) => (
                  <select
                    key={label}
                    aria-label={label}
                    value={v}
                    onChange={(e) => set(Number(e.target.value))}
                    className="w-full rounded-lg border border-foreground/30 bg-background p-2 text-sm"
                  >
                    {E.map((n, i) => (
                      <option key={n} value={i}>
                        {n}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            )}
            <div className="h-2" />
            {chart}
            <div className="mt-1 text-xs text-muted-foreground/80">{note}</div>
            {windows.length > 0 && (
              <div className="mt-1 text-xs text-muted-foreground/80">
                Historic CAGR is in current prices, forecast CAGR (F) in
                constant 2026 prices; not comparable across the two.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
