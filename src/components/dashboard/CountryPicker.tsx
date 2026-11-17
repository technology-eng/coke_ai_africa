import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn, formatCount } from "@/lib/utils";

type Country = { code: number; name: string; achieved_n: number };
type Unit = { code: string; label: string; markets: number[] };

/**
 * Searchable multi-select for the GLOBAL country filter. Empty selection
 * means every country, the same convention as the chips. Countries are listed
 * under their operating unit; the list stays in the sidebar's flow (no
 * portal) so the scroll container never clips it.
 */
export function CountryPicker({
  countries,
  units,
  value,
  onChange,
}: {
  countries: Country[];
  units: Unit[];
  value: number[];
  onChange: (next: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const byCode = useMemo(() => new Map(countries.map((c) => [c.code, c])), [countries]);
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const listed = new Set(units.flatMap((u) => u.markets));
    const all = [
      ...units.map((u) => ({ label: u.label, items: u.markets.map((m) => byCode.get(m)!).filter(Boolean) })),
      { label: "Other", items: countries.filter((c) => !listed.has(c.code)) },
    ];
    return all
      .map((g) => ({
        ...g,
        items: g.items.filter((c) => !q || c.name.toLowerCase().includes(q) || g.label.toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length);
  }, [units, countries, byCode, query]);

  const toggle = (code: number) =>
    onChange(value.includes(code) ? value.filter((v) => v !== code) : [...value, code]);

  const names = value.map((c) => byCode.get(c)?.name).filter(Boolean) as string[];
  const summary = !names.length
    ? "All countries"
    : names.length <= 2
      ? names.join(", ")
      : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;

  return (
    <div ref={root} className="w-full">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between rounded-sm border px-2.5 py-1.5 font-mono text-[11px]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          names.length ? "border-primary text-primary" : "border-input text-muted-foreground"
        )}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mt-1 rounded-sm border border-input bg-background shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-input px-2 py-1.5">
            <Search className="h-3 w-3 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries"
              className="w-full bg-transparent font-mono text-[11px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex justify-between border-b border-input px-2 py-1 font-mono text-[10px]">
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => onChange([...new Set([...value, ...groups.flatMap((g) => g.items.map((c) => c.code))])])}
            >
              {query ? "Select matches" : "Select all"}
            </button>
            <button type="button" className="text-muted-foreground hover:underline" onClick={() => onChange([])}>
              Clear
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="px-2 pb-0.5 pt-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  {g.label}
                </div>
                {g.items.map((c) => {
                  const on = value.includes(c.code);
                  return (
                    <button
                      key={c.code}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(c.code)}
                      title={`${c.name} — ${formatCount(c.achieved_n)} achieved`}
                      className="flex w-full items-center gap-2 px-2 py-1 text-left font-mono text-[11px] hover:bg-muted"
                    >
                      <span
                        className={cn(
                          "flex h-3 w-3 items-center justify-center rounded-[2px] border",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-input"
                        )}
                      >
                        {on && <Check className="h-2.5 w-2.5" />}
                      </span>
                      <span className="flex-1">{c.name}</span>
                      <span className="text-muted-foreground">{formatCount(c.achieved_n)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            {!groups.length && (
              <div className="px-2 py-2 font-mono text-[11px] text-muted-foreground">No match</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
