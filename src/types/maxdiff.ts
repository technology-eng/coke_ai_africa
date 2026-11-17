/**
 * Response shapes for the coke_eu MaxDiff API.
 *
 * Typed directly off python_services/admin_management/handler/maxdiff_handler.py
 * and handler/segmentation_refit.py. Controllers return the handler payload
 * unwrapped (ok_response passes the dict straight through), so these are the
 * literal bodies — there is no { data: ... } envelope.
 */

/** Echo of the filter the server applied. Present on every payload. */
export interface FilterEcho {
  market: number[];
  language: number[];
  gender: number[];
  gender_raw: number[];
  generation: number[];
  age: number[];
  income: number[];
  income_code: number[];
  area: number[];
  household_size: number[];
  children: number[];
  segment_k: number | null;
  segment: number | null;
  exclude_low_quality: boolean;
}

/**
 * The total population the current filter represents, so a share of people can
 * be read as a headcount.
 *
 * Post-stratified by market: each market's published population is scaled by
 * the share of THAT market's sample inside the filter, then summed. The sample
 * is ~1,000 per market by quota, so Germany is 17% of respondents but 26% of
 * the population — one sample-wide rate applied to the total would badly
 * over-weight the small markets.
 *
 * TOTAL population, all ages, while the sample is 18-54 (the screener
 * terminates under-18s and 55+). A headcount therefore projects a rate onto
 * ages nobody interviewed — it sizes a market rather than counting consumers.
 * `basis` carries that caveat in the payload; the server picks the basis, so
 * nothing here needs to change if it is switched back.
 *
 * It does NOT weight the analysis. Percentages stay unweighted exactly as
 * before; every `*_people` figure is the published percentage applied to
 * `filtered` afterwards, so the two always reconcile on screen.
 */
export interface PopulationBlock {
  /** Population of the markets in scope — filtered markets, or all six. */
  universe: number | null;
  /** Population the current filter projects onto. */
  filtered: number | null;
  by_market: {
    code: number;
    name: string;
    population: number | null;
    sample_n: number;
    filtered_n: number;
    projected: number | null;
  }[];
  unit: string;
  source: string;
  basis: string;
  /** Surveyed markets with no published figure — the projection undercounts. */
  markets_without_population: string[];
}

// ── GET /maxdiff/meta ───────────────────────────────────────────────────────

export interface MarketOption {
  code: number;
  name: string;
  language: number | string;
  achieved_n: number;
}

export interface SegmentOptionEntry {
  index: number;
  label: string;
  name: string;
  size_pct: number | null;
  top_by_share: string[];
  differentiation: number | null;
}

/** One fitted class count. The dashboard shows the BIC-best K by default. */
export interface SegmentOptionGroup {
  k: number;
  is_best_k: boolean;
  bic: number | null;
  segments: SegmentOptionEntry[];
}

/**
 * Provenance for the fit being served, from Survey.meta["estimation_runs"].
 * Null when the run predates provenance recording, or was never fitted.
 */
export interface RunMeta {
  fitted_at: string;
  variant: string;
  n_respondents: number;
  n_attributes: number;
  /** Non-null ⇒ fitted on a capped slice, so not representative. */
  limit: number | null;
  /** False ⇒ the convergence gate was not enforced. */
  strict: boolean;
  hb_diagnostics: {
    max_rhat: number;
    min_ess_bulk: number;
    divergences: number;
    max_treedepth_hits: number;
    ok: boolean;
  };
  stan_meta: {
    n_tasks: number;
    max_shown: number;
    set_sizes: Record<string, number>;
    skipped: Record<string, number>;
  };
  omega_summary: {
    max_abs_offdiag: number;
    mean_abs_offdiag: number;
    frac_above_0_2: number;
  };
  fit: {
    average_fit: number;
    median_fit: number;
    /** Chance RLH for this design: sqrt((1/k)·(1/(k−1))). */
    rlh_threshold: number;
    data_quality_pct: number;
    distribution: Record<string, number>;
    flagged_count: number;
  };
}

export interface MetaResponse {
  survey: {
    id: number;
    variant: string;
    title: string;
    job_number: string | null;
  };
  design: {
    items: number;
    items_per_screen: number;
    screens: number;
    min_exposures: number;
  };
  total_n: number;
  filtered_n: number;
  /** People behind `filtered_n`. Drives the headcounts on every panel. */
  population: PopulationBlock;
  markets: MarketOption[];
  /** GLOBAL only: sub-regions as groups of market codes. Empty for EU. */
  subregions?: { code: string; label: string; markets: number[] }[];
  /** GLOBAL only: benefit groupings for the Subcategory filter. Absent for EU. */
  subcategories?: { label: string; items: string[] }[];
  /** Distinct non-null codes actually present in the data, per column. */
  filter_values: {
    gender: number[];
    generation: number[];
    income: number[];
    area: number[];
    age: number[];
  };
  /** Markets with respondents but no income band; an income chip leaves them out. */
  income_missing_markets?: string[];
  segments: SegmentOptionGroup[];
  items: string[];
  has_utilities: boolean;
  estimation_run: string;
  run_meta: RunMeta | null;
  available_runs: string[];
}

// ── Shared error codes ──────────────────────────────────────────────────────

/**
 * Why a panel came back with base 0.
 *   EMPTY_FILTER  — the filter genuinely matched nobody. Widen it.
 *   NO_UTILITIES  — respondents matched, but no fit is stored for this run.
 */
export type EmptyCode = "EMPTY_FILTER" | "NO_UTILITIES";

// ── GET /maxdiff/utilities ──────────────────────────────────────────────────

export interface UtilityRow {
  rank: number;
  item: string;
  subcategory?: string | null;
  utility: number;
  lower_ci: number;
  upper_ci: number;
  preference_share: number;
  /** "+" / "−" vs the sample average at 95%, or "" when not significant. */
  sig_vs_total: string;
}

export interface UtilityResponse {
  base_n: number;
  method?: string;
  estimation_run?: string;
  filters: FilterEcho;
  thin_base?: boolean;
  rows: UtilityRow[];
  warning?: string;
  code?: EmptyCode;
  /** Respondents the filter matched, whether or not they have utilities. */
  matched_respondents?: number;
}

// ── GET /maxdiff/ranking ────────────────────────────────────────────────────

export interface RankingRow {
  item: string;
  subcategory?: string | null;
  preference_share: number;
  utility: number;
  rank: number;
}

export interface RankingResponse {
  base_n: number;
  thin_base: boolean;
  filters: FilterEcho;
  rows: RankingRow[];
  warning?: string;
  code?: EmptyCode;
  matched_respondents?: number;
}

// ── GET /maxdiff/bw ─────────────────────────────────────────────────────────

export interface BwRow {
  rank: number;
  item: string;
  subcategory?: string | null;
  times_shown: number;
  best_count: number;
  worst_count: number;
  best_pct: number;
  worst_pct: number;
  /** (best − worst) / shown, in [−1, +1]. */
  bw: number;
  /** BW rescaled to 0–100 across the items in view. */
  rui: number;
}

export interface BwResponse {
  base_n: number;
  filters: FilterEcho;
  rows: BwRow[];
}

// ── GET /maxdiff/markets ────────────────────────────────────────────────────

export interface MarketCell {
  preference_share: number;
  delta_vs_total: number;
  sig_vs_total: string;
}

export interface MarketsResponse {
  base_n: number;
  filters: FilterEcho;
  warning?: string;
  code?: EmptyCode;
  matched_respondents?: number;
  markets: { code: number; name: string; base_n: number; thin_base: boolean }[];
  /** Benefit statements, already ordered by total-sample utility. */
  items: string[];
  /** GLOBAL only: subcategory per benefit, keyed like cells/total_share. */
  item_subcategory?: Record<string, string | null>;
  total_share: Record<string, number>;
  /** cells[itemStatement][marketCode] */
  cells: Record<string, Record<string, MarketCell>>;
}

// ── GET /maxdiff/segments ───────────────────────────────────────────────────

export interface SegmentProfile {
  segment: string;
  /** "Undifferentiated" for a class with no distinct profile, else null. */
  name?: string | null;
  size_pct: number;
  /**
   * pi_k, the mixture weight — a SIZE, not a separation measure. Its mean
   * across classes is exactly 1/K by construction, so it says nothing about
   * how well separated the classes are. Use `crispness` for that.
   */
  avg_membership: number;
  /**
   * Average posterior among this class's OWN members: 1.0 is a clean
   * partition, 1/K means argmax picked the class by a hair. Absent on
   * segmentations fitted before this metric existed.
   */
  crispness?: number;
  top_by_share: string[];
  /**
   * Highest-lift benefits. EMPTY for an undifferentiated class, deliberately:
   * when every share sits at ~100/J, lift reduces to −(total share) and this
   * list degenerates into the sample's least-liked benefits — the same three
   * at every K. The backend withholds it rather than let it read as a finding.
   */
  defining_attributes: string[];
  differentiation: number;
  /** Differentiation as a multiple of the total sample's own share spread. */
  differentiation_ratio?: number;
  /** True ⇒ no distinct profile; report as a residual, not a need-state. */
  is_undifferentiated?: boolean;
  /** Preference share per benefit within this class, 0–100. */
  shares: Record<string, number>;
  lift_vs_total: Record<string, number>;
  // Present only on a refit, where classes are permuted onto the global fit.
  refit_index?: number;
  aligned_to_global?: number;
}

export interface SegmentProfiles {
  K: number;
  bic: number;
  log_lik: number;
  segments: SegmentProfile[];
  /** Highest correlation between any two classes' share vectors. */
  max_class_correlation?: number;
  /** [classA, classB, r] for pairs telling the same story — K is over-split. */
  duplicate_pairs?: [string, string, number][];
  n_undifferentiated?: number;
  user_segment_mapping: Record<string, string>;
}

/** How well a refit's classes matched the global ones. */
export interface Alignment {
  mean_correlation?: number;
  min_correlation?: number;
  per_class?: number[];
  /** False ⇒ this subgroup's need-states genuinely differ from the population's. */
  reliable?: boolean;
  message?: string;
}

export interface SegmentsResponse {
  available: boolean;
  message?: string;
  refit: boolean;
  /** Set when a refit was asked for but the base was too thin to fit. */
  refit_declined?: {
    code: string;
    message: string;
    base_n: number;
  };
  k: number;
  /** The K actually served — chosen on actionability, NOT on BIC. */
  best_k?: number;
  /**
   * Why `best_k` was chosen. `clean: false` means it failed at least one
   * threshold and the deliverable needs the caveat stated.
   */
  recommendation?: { k: number; clean: boolean; reason: string } | null;
  /**
   * The K with the lowest BIC. Usually the top of the searched range and
   * usually NOT `best_k` — BIC's penalty grows with log(N) while the fit gain
   * does not, so it keeps falling past any actionable class count.
   */
  bic_best_k?: number | null;
  available_k?: number[];
  estimation_run?: string;
  requested_run?: string;
  /**
   * True when BIC was still falling at the largest K fitted. `best_k` is then
   * the ceiling of the search range, not a chosen optimum.
   */
  best_k_at_boundary?: boolean;
  /**
   * True when the stored segmentation came from a different run than the
   * utilities being displayed. Survey.meta holds ONE segmentation, not one per
   * run, so the latest fit wins and the two can drift apart.
   */
  run_mismatch?: boolean;
  bic_by_k?: Record<string, number>;
  log_lik_by_k?: Record<string, number>;
  /** Respondents per class WITHIN the current filter, keyed by class index. */
  segment_sizes: Record<string, number>;
  /** Same, across the whole survey — the reference the filtered count skews against. */
  segment_sizes_total?: Record<string, number>;
  /**
   * People per class, keyed by class index — the class's share of the filtered
   * base applied to `population.filtered`, so the three reconcile.
   */
  segment_populations?: Record<string, number | null>;
  population?: PopulationBlock;
  filtered_base_n?: number;
  total_base_n?: number;
  profiles: SegmentProfiles;
  filters: FilterEcho;

  // ── refit only ──
  cached?: boolean;
  base_n?: number;
  runtime_seconds?: number;
  alignment?: Alignment;
  bic?: number;
  log_lik?: number;
  bic_note?: string;
  n_iter?: number;
  /** The global fit, so a refit can be read against it. */
  global?: {
    best_k: number;
    bic_by_k: Record<string, number>;
    profiles: SegmentProfiles;
  };
}

// ── GET /maxdiff/association/{ingredients|categories} ───────────────────────

export interface AssociationRow {
  item: string;
  subcategory?: string | null;
  /** This benefit's OWN base — M2/M3 are piped to each respondent's top 5. */
  base_n: number;
  preference_share: number | null;
  thin_base: boolean;
}

export interface AssociationResponse {
  base_n: number;
  filters: FilterEcho;
  base_note: string;
  answers: string[];
  rows: AssociationRow[];
  /** cells[benefitStatement][answerLabel] */
  cells: Record<string, Record<string, { count: number; pct: number | null }>>;
}

export type AssociationAxis = "ingredients" | "categories";

// ── GET /maxdiff/awareness/{benefits|ingredients} ───────────────────────────

export interface AwarenessRow {
  rank: number;
  item: string;
  subcategory?: string | null;
  /** Respondents who selected it — counted once each, however many rows. */
  count: number;
  /** Share of the shared filtered base. Rows do NOT sum to 100. */
  pct: number | null;
  people: number | null;
}

/**
 * Prompted awareness: B2 for benefits, M2 for ingredients.
 *
 * Unlike AssociationResponse, every row shares ONE base — the filtered n — so
 * these percentages are directly comparable down the column. And unlike
 * preference share, they do not sum to 100: both questions are multi-select,
 * so a respondent appears in as many rows as they picked.
 */
export interface AwarenessResponse {
  base_n: number;
  thin_base: boolean;
  filters: FilterEcho;
  population: PopulationBlock;
  base_note: string;
  rows: AwarenessRow[];
  warning?: string;
  code?: EmptyCode;
}

export type AwarenessAxis = "benefits" | "ingredients" | "platforms";

// ── GET /maxdiff/turf ───────────────────────────────────────────────────────

/**
 * Benefits are identified by INDEX into `TurfResponse.items` — the canonical
 * survey order, the same list /maxdiff/meta publishes. Indices rather than
 * statements because a statement is free text that may contain the comma the
 * query string splits on.
 */
export type BenefitIndex = number;

export interface TurfCurvePoint {
  k: number;
  /** Percent of the base reached by the best portfolio of this size. */
  reach: number;
  /** `reach` as people, against population.filtered. */
  reach_people?: number | null;
  /** Points of reach gained over the best portfolio at k−1. */
  incremental: number;
  incremental_people?: number | null;
  /** Mean portfolio benefits per REACHED respondent — never per respondent. */
  frequency: number;
  /** False ⇒ greedy + swap repair, not proven optimal. */
  exhaustive: boolean;
  items: BenefitIndex[];
}

export interface TurfWaterfallRow {
  item_index: BenefitIndex;
  item: string;
  locked: boolean;
  cumulative_reach: number;
  cumulative_people?: number | null;
  /** New reach this benefit adds on top of everything above it. */
  incremental_reach: number;
  /** The same, as people — what a slot on the pack is actually buying. */
  incremental_people?: number | null;
  /** Reach this benefit achieves on its own, ignoring the rest. */
  own_reach: number;
  own_people?: number | null;
}

export interface TurfResponse {
  base_n: number;
  matched_respondents?: number;
  /** Respondents dropped for having an incomplete utility vector. */
  incomplete_dropped?: number;
  estimation_run?: string;
  filters: FilterEcho;
  /** Canonical benefit order. `locked` and every `*_index` point into this. */
  items: string[];
  /** GLOBAL only: benefit platform per item. Empty for EU. */
  item_subcategory?: Record<string, string | null>;
  thin_base?: boolean;
  rule: {
    rule: TurfRule;
    top_n: number;
    /**
     * Means a DIFFERENT quantity per rule: a position on a 0–100 rescaling of
     * the respondent's own utility range for `rescaled_gt`, a net count score
     * in percent for `count_score`. Never compare the two.
     */
    threshold: number;
    description: string;
    /** Benefits reaching the average respondent. High ⇒ the rule saturates. */
    mean_items_reaching: number;
  };
  size: number;
  max_k: number;
  locked: BenefitIndex[];
  curve: TurfCurvePoint[];
  /** People behind `base_n` — every *_people figure is a percentage of this. */
  population?: PopulationBlock;
  portfolio: {
    size: number;
    items: BenefitIndex[];
    reach: number;
    reach_people?: number | null;
    frequency: number;
    exhaustive: boolean;
    waterfall: TurfWaterfallRow[];
  } | null;
  /** The top-`size` benefits by preference share — what a reader would pick
   *  straight off the ranking, and what TURF is measured against. */
  baseline: {
    items: BenefitIndex[];
    labels: string[];
    reach: number;
    reach_people?: number | null;
  };
  /** Optimised reach − baseline reach. NEGATIVE when locks force a worse set. */
  gain_vs_baseline_pts: number;
  gain_vs_baseline_people?: number | null;
  swaps: { out: string[]; in: string[] };
  /** Last size that still added `knee_min_gain_pts`; null if never flattens. */
  knee: number | null;
  knee_min_gain_pts: number;
  overlap: {
    indices: BenefitIndex[];
    labels: string[];
    /** cells[a][b] = of those reached by a, the % also reached by b. */
    cells: (number | null)[][];
  };
  own_reach: Record<string, number>;
  own_reach_people?: Record<string, number | null>;
  warning?: string;
  code?: EmptyCode;
}

/**
 * What counts as "reached".
 *
 * `count_score` is the model-free one: each respondent's own MaxDiff count
 * score — (times best − times worst) / times shown — flagged yes at or above a
 * threshold, by default 50%. It is the convention earlier TURF deliverables
 * used, so it exists to make those reconcilable with this dashboard; the other
 * three read HB utilities.
 */
export type TurfRule = "top_n" | "positive" | "rescaled_gt" | "count_score";

export interface TurfRuleOption {
  value: TurfRule;
  label: string;
  note: string;
}

export interface TurfMetaResponse {
  rules: TurfRuleOption[];
  max_k: number;
  default_size: number;
  default_top_n: number;
  /** For rule="rescaled_gt". */
  default_threshold?: number;
  /** For rule="count_score" — a different scale, hence its own default. */
  default_count_threshold?: number;
  knee_min_gain_pts: number;
}

/** /home/market — Euromonitor platform sizing (USD million, retail value RSP). */
export type CategoryType = "Core" | "Adjacent" | "Stretch";

/** Per CAGR window (aligned with `cagr`): [value at `from`, value at `to`]; the same whatever year is selected. */
export type MarketEnds = [number, number][];

/** One category's value attributed to one opportunity space; platforms overlap across these. */
export interface MarketRow {
  market: number;
  category: string;
  type: CategoryType;
  platform: string;
  space: string;
  value: number;
  ends?: MarketEnds;
}

/** A category's own total (platform "Total" in the source), free of overlap. */
export interface MarketCategoryTotal {
  market: number;
  category: string;
  type: CategoryType;
  value: number;
  ends?: MarketEnds;
}

/** A top brand in one (market, opportunity space, category type); Coca-Cola's brands are all listed. */
export interface MarketBrandRow {
  market: number;
  platform: string;
  space: string;
  type: CategoryType;
  brand: string;
  supplier: string;
  coke: boolean;
  value: number;
}

/** A growth window. History is current prices, forecast is constant 2026 prices; never one across 2025 to 2026. */
export interface MarketCagr {
  label: string;
  from: number;
  to: number;
  forecast: boolean;
}

/** /home/summary: consumer desirability per benefit platform (M3 any-yes over all respondents). */
export interface HomeSummaryResponse {
  base_n: number;
  measure: string;
  population_source: string | null;
  population_basis: string;
  platforms: { platform: string; respondents: number; share: number | null; projected: number | null }[];
  warning?: string;
  code?: "NOT_AVAILABLE";
}

export interface HomeMarketResponse {
  /** The selected year (default: latest actual); `rows` and `category_totals` are for it. */
  year: number | null;
  /** Ascending: actual years, then forecast. */
  years?: { year: number; forecast: boolean }[];
  /** Brand rows exist for this year only; any other year has `brands` empty. */
  brand_year?: number | null;
  /** Empty for single-year data. */
  cagr?: MarketCagr[];
  unit: string;
  source: string;
  markets: { code: number; name: string }[];
  category_totals: MarketCategoryTotal[];
  rows: MarketRow[];
  brands: MarketBrandRow[];
  warning?: string;
  code?: "NOT_LOADED";
}
