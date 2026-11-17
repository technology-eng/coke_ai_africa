import { getRegion, isPlatformView } from "@/lib/region";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getAccountId, hasNeedStates } from "@/lib/auth";
import type { ApiParams } from "@/services/api";

/**
 * Where the last applied view is remembered between visits.
 *
 * Keyed per account, because dashboards are account-scoped: restoring one
 * client's market and segment selection into another client's view would be
 * both wrong and confusing on a shared browser. Versioned so a future change
 * to the query-string format can be ignored rather than half-read.
 */
const STORE_VERSION = "v1";
// Per region too: /cokeeu and /cokeglobal share an origin but not market codes.
// And per ASP tab: TURF pins are indices into benefits on one, platforms on the other.
const storeKey = () => {
  const region = getRegion() === "EU" ? "" : `:${getRegion()}`;
  const tab = isPlatformView() ? ":platform" : "";
  return `coke-eu:dashboard:${STORE_VERSION}${region}${tab}:${getAccountId() ?? "anon"}`;
};

function loadStored(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(storeKey());
  } catch {
    // Private mode, or storage disabled. Not being able to remember the last
    // view is a downgrade, not a failure.
    return null;
  }
}

function saveStored(qs: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storeKey(), qs);
  } catch {
    /* quota or disabled — ignore */
  }
}

/**
 * Dashboard state, held in the URL — but applied only on request.
 *
 * Two layers:
 *
 *   applied  the URL. Every query reads from here, so nothing refetches until
 *            it changes.
 *   draft    what the user is assembling. Controls render from this, so a
 *            click is acknowledged instantly without costing a round trip.
 *
 * The split exists because a cut is rarely one click. Picking "Poland, Gen Z,
 * high income" fires three requests under live filtering, two of which nobody
 * wanted, and the intermediate answers arrive out of order on a slow link.
 * Staging the whole cut and committing it once is both faster and easier to
 * reason about — and it makes the moment of asking the server explicit, which
 * matters on a page where some panels are genuinely expensive.
 *
 * The URL still ends up holding applied state, so a filtered view stays
 * shareable and survives a refresh; back/forward resync the draft.
 */
export const DEMO_KEYS = [
  "market",
  "gender",
  "generation",
  "age",
  "income",
  "area",
] as const;

export type DemoKey = (typeof DEMO_KEYS)[number];

export interface DashboardFilters {
  demo: Record<DemoKey, number[]>;
  /** GLOBAL only: benefit subcategories in view. Narrows benefits, not respondents. */
  subcategory: string[];
  /**
   * Which fitted class count the segments panel is reading.
   *
   * NOT a filter. The need-state class filter (segment_k + segment together)
   * was removed from the rail; this is only the K selector inside the segments
   * panel, which is restored for the accounts that still see it. It never goes
   * out in `params` — getSegments takes K as its own argument — so it selects
   * what that one panel displays and narrows nobody's base.
   */
  segmentK: number | null;
  /** 0-based class index, or null for "all respondents". Only the extended
   *  accounts can set this — the rail hides the chips for everyone else. */
  segmentIndex: number | null;
  excludeLowQuality: boolean;
  /** Refit the mixture on the filtered base rather than reusing global classes. */
  refit: boolean;
  /** Which estimation run to read. Null means the server default (hb_v1). */
  run: string | null;
  /** TURF portfolio controls. Staged and committed like everything else. */
  turf: {
    locked: number[];
    size: number;
    rule: string;
    topN: number;
    threshold: number;
  };
}

export const TURF_DEFAULT_SIZE = 5;
export const TURF_DEFAULT_TOP_N = 3;
export const TURF_DEFAULT_THRESHOLD = 60;
export const TURF_DEFAULT_COUNT_THRESHOLD = 50;

/**
 * `threshold` names a different quantity under each rule — a position on a
 * 0–100 rescaling of a respondent's utility range for `rescaled_gt`, a net
 * MaxDiff count score in percent for `count_score` — so the default belongs to
 * the rule. Mirrors default_threshold_for() in utils/maxdiff_turf.py; a single
 * shared default would apply 60 as a count-score cut, which is a materially
 * stricter analysis than the 50 earlier deliverables used.
 */
export function turfDefaultThreshold(rule: string): number {
  return rule === "count_score" ? TURF_DEFAULT_COUNT_THRESHOLD : TURF_DEFAULT_THRESHOLD;
}

function parseList(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v));
}

function parseStringList(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(",").map((v) => v.trim()).filter(Boolean);
}

function read(p: URLSearchParams): DashboardFilters {
  const demo = {} as Record<DemoKey, number[]>;
  for (const key of DEMO_KEYS) demo[key] = parseList(p.get(key));
  // Read the segment pair ONLY for accounts that have the need-state panel and
  // chips. For everyone else these stay null, which is what keeps a shared or
  // bookmarked URL carrying ?segment_k=&segment= from silently narrowing their
  // whole dashboard to a class they cannot see, name, or clear.
  const extended = hasNeedStates();
  const k = extended ? p.get("segment_k") : null;
  const seg = extended ? p.get("segment") : null;
  const rule = p.get("rule") || "top_n";
  return {
    demo,
    subcategory: parseStringList(p.get("subcategory")),
    segmentK: k ? Number(k) : null,
    segmentIndex: seg !== null && seg !== "" ? Number(seg) : null,
    excludeLowQuality: p.get("exclude_low_quality") === "1",
    refit: p.get("refit") === "1",
    run: p.get("run") || null,
    turf: {
      locked: parseList(p.get("locked")),
      size: Number(p.get("size")) || TURF_DEFAULT_SIZE,
      rule,
      topN: Number(p.get("top_n")) || TURF_DEFAULT_TOP_N,
      threshold: Number(p.get("threshold")) || turfDefaultThreshold(rule),
    },
  };
}

/** Order-independent identity, so ?market=1,2 and ?gender=1&market=1,2 with
 *  the same content compare equal and the button does not sit dirty forever. */
function signature(p: URLSearchParams): string {
  return [...p.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("&");
}

export function useDashboardFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * Last view, restored on a cold visit.
   *
   * Read synchronously in a lazy initialiser rather than in an effect, so the
   * very first render already has the restored filters and the panels fire one
   * round of requests instead of two — an effect-based restore would query the
   * unfiltered total sample first and immediately throw the answer away.
   *
   * A URL that carries anything of its own always wins: a link shared with a
   * colleague must show what the sender saw, not what the recipient last
   * looked at.
   */
  const [pendingRestore, setPendingRestore] = useState<URLSearchParams | null>(() => {
    if (typeof window === "undefined") return null;
    if (window.location.search.replace(/^\?/, "")) return null;
    const saved = loadStored();
    return saved ? new URLSearchParams(saved) : null;
  });

  // Until the router catches up, the restored params ARE the applied state.
  const effective = pendingRestore ?? searchParams;
  const appliedSig = signature(effective);

  useEffect(() => {
    if (!pendingRestore) return;
    setSearchParams(new URLSearchParams(pendingRestore), { replace: true });
    setPendingRestore(null);
  }, [pendingRestore, setSearchParams]);

  // Remember whatever is applied. Writing the empty string is correct and
  // deliberate: clearing the filters and applying should mean the next visit
  // opens clean, not that the previous view resurrects.
  useEffect(() => {
    if (pendingRestore) return;
    saveStored(searchParams.toString());
  }, [searchParams, pendingRestore]);

  const [draftParams, setDraftParams] = useState(() => new URLSearchParams(effective));

  // Resync the draft whenever applied state moves under us — our own apply(),
  // the back button, or a pasted link. Keyed on the signature rather than the
  // object so an unrelated re-render does not discard pending edits.
  useEffect(() => {
    setDraftParams(new URLSearchParams(appliedSig));
  }, [appliedSig]);

  const applied = useMemo(() => read(effective), [effective]);
  const draft = useMemo(() => read(draftParams), [draftParams]);
  const isDirty = signature(draftParams) !== appliedSig;

  const update = useCallback((mutate: (next: URLSearchParams) => void) => {
    setDraftParams((prev) => {
      const next = new URLSearchParams(prev);
      mutate(next);
      return next;
    });
  }, []);

  /** Commit the draft. This is the only thing that causes a refetch. */
  const apply = useCallback(() => {
    setSearchParams(new URLSearchParams(draftParams), { replace: false });
  }, [draftParams, setSearchParams]);

  const discard = useCallback(() => {
    setDraftParams(new URLSearchParams(searchParams));
  }, [searchParams]);

  const toggleDemo = useCallback(
    (key: DemoKey, value: number) => {
      update((next) => {
        const current = parseList(next.get(key));
        const after = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value].sort((a, b) => a - b);
        if (after.length) next.set(key, after.join(","));
        else next.delete(key);
      });
    },
    [update]
  );

  const toggleSubcategory = useCallback(
    (value: string) => {
      update((next) => {
        const current = parseStringList(next.get("subcategory"));
        const after = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value].sort();
        if (after.length) next.set("subcategory", after.join(","));
        else next.delete("subcategory");
      });
    },
    [update]
  );

  /** Replace one demographic list wholesale (a sub-region chip sets many markets). */
  const setDemo = useCallback(
    (key: DemoKey, values: number[]) => {
      update((next) => {
        const after = [...new Set(values)].sort((a, b) => a - b);
        if (after.length) next.set(key, after.join(","));
        else next.delete(key);
      });
    },
    [update]
  );

  const setSegment = useCallback(
    (k: number | null, index: number | null) => {
      update((next) => {
        if (k === null) next.delete("segment_k");
        else next.set("segment_k", String(k));
        if (index === null) next.delete("segment");
        else next.set("segment", String(index));
      });
    },
    [update]
  );

  /** Change the displayed class count on the segments panel, dropping any class
   *  selection made under the old K — index 2 of a 5-class fit is not index 2
   *  of a 3-class one. */
  const setSegmentK = useCallback(
    (k: number | null) => {
      update((next) => {
        if (k === null) next.delete("segment_k");
        else next.set("segment_k", String(k));
        next.delete("segment");
      });
    },
    [update]
  );

  const setFlag = useCallback(
    (name: "exclude_low_quality" | "refit", on: boolean) => {
      update((next) => {
        if (on) next.set(name, "1");
        else next.delete(name);
      });
    },
    [update]
  );

  const setRun = useCallback(
    (tag: string | null) => {
      update((next) => {
        if (tag) next.set("run", tag);
        else next.delete("run");
      });
    },
    [update]
  );

  /**
   * Pin or unpin a benefit in the TURF portfolio.
   *
   * Growing the portfolio to fit is deliberate: pinning a sixth benefit into a
   * five-slot portfolio would otherwise silently drop one the user had already
   * chosen.
   */
  const toggleLock = useCallback(
    (index: number) => {
      update((next) => {
        const current = parseList(next.get("locked"));
        const after = current.includes(index)
          ? current.filter((v) => v !== index)
          : [...current, index].sort((a, b) => a - b);
        if (after.length) next.set("locked", after.join(","));
        else next.delete("locked");

        const size = Number(next.get("size")) || TURF_DEFAULT_SIZE;
        if (after.length > size) next.set("size", String(after.length));
      });
    },
    [update]
  );

  const clearLocks = useCallback(() => {
    update((next) => next.delete("locked"));
  }, [update]);

  /** Portfolio size. Never below the number of pinned benefits. */
  const setTurfSize = useCallback(
    (size: number) => {
      update((next) => {
        const locked = parseList(next.get("locked"));
        const clamped = Math.max(size, locked.length, 1);
        if (clamped === TURF_DEFAULT_SIZE) next.delete("size");
        else next.set("size", String(clamped));
      });
    },
    [update]
  );

  /** Reach rule and its parameter. Locks survive: which benefits you are
   *  committed to carrying is independent of how "reached" is defined. */
  const setTurfRule = useCallback(
    (rule: string, opts: { topN?: number; threshold?: number } = {}) => {
      update((next) => {
        const previous = next.get("rule") || "top_n";
        if (rule === "top_n") next.delete("rule");
        else next.set("rule", rule);
        if (opts.topN !== undefined) {
          if (opts.topN === TURF_DEFAULT_TOP_N) next.delete("top_n");
          else next.set("top_n", String(opts.topN));
        }
        if (opts.threshold !== undefined) {
          if (opts.threshold === turfDefaultThreshold(rule)) next.delete("threshold");
          else next.set("threshold", String(opts.threshold));
        } else if (rule !== previous) {
          // Drop the old threshold when the rule changes. The two thresholds
          // are different quantities on different scales, so carrying 60 from
          // "above threshold" into "count score" would silently apply a much
          // stricter cut than the 50 that rule means by default.
          next.delete("threshold");
        }
      });
    },
    [update]
  );

  /** Clears the draft but KEEPS the run — which fit you are looking at is not
   *  something "clear filters" should silently change under you. Still needs
   *  applying, like every other edit. */
  const clearAll = useCallback(() => {
    setDraftParams(() => {
      const next = new URLSearchParams();
      const run = searchParams.get("run");
      if (run) next.set("run", run);
      return next;
    });
  }, [searchParams]);

  /**
   * The query string sent to every endpoint — built from APPLIED state only.
   *
   * Need-state was removed from the dashboard, so `segment_k`/`segment` are no
   * longer read from the URL or emitted here. The API still accepts them; a
   * stale bookmarked link simply stops filtering rather than silently narrowing
   * every panel to one class with nothing on screen to say so.
   */
  const params: ApiParams = useMemo(() => {
    const out: ApiParams = {};
    for (const key of DEMO_KEYS) {
      if (applied.demo[key].length) out[key] = applied.demo[key].join(",");
    }
    // Both halves or neither: a class index means nothing to the respondent
    // filter without the class count that defines it.
    if (applied.segmentIndex !== null && applied.segmentK) {
      out.segment_k = String(applied.segmentK);
      out.segment = String(applied.segmentIndex);
    }
    if (applied.excludeLowQuality) out.exclude_low_quality = "1";
    if (applied.run) out.run = applied.run;
    if (applied.subcategory.length) out.subcategory = applied.subcategory.join(",");
    return out;
  }, [applied]);

  /** Counted on the DRAFT, so the sidebar reflects what you are building. */
  const activeCount = useMemo(() => {
    let n = DEMO_KEYS.reduce((acc, k) => acc + draft.demo[k].length, 0);
    if (draft.segmentIndex !== null) n += 1;
    if (draft.excludeLowQuality) n += 1;
    n += draft.subcategory.length;
    if (draft.turf.locked.length) n += draft.turf.locked.length;
    return n;
  }, [draft]);

  /**
   * Whether the filter actually narrows the base a refit would run on.
   *
   * Mirrors the backend's Filters.is_total_sample, which counts demographics
   * and the quality flag.
   */
  const narrowsBase = useMemo(
    () => DEMO_KEYS.some((k) => applied.demo[k].length > 0) || applied.excludeLowQuality,
    [applied]
  );

  return {
    /** Applied state — what the panels on screen are actually showing. */
    filters: applied,
    /** Pending state — what the controls should render as selected. */
    draft,
    isDirty,
    apply,
    discard,
    params,
    activeCount,
    narrowsBase,
    toggleDemo,
    toggleSubcategory,
    setDemo,
    setSegment,
    setSegmentK,
    setFlag,
    setRun,
    clearAll,
    toggleLock,
    clearLocks,
    setTurfSize,
    setTurfRule,
  };
}
