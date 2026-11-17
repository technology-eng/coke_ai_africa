import axios from "axios";
import { API_BASE_URL } from "@/ENV";
import { appBase, getRegion, operatingUnits, regionInfo } from "@/lib/region";
import { getToken, isLoggedIn, logout } from "@/lib/auth";
import type {
  AssociationAxis,
  AssociationResponse,
  AwarenessAxis,
  AwarenessResponse,
  BwResponse,
  HomeMarketResponse,
  HomeSummaryResponse,
  MarketsResponse,
  MetaResponse,
  RankingResponse,
  SegmentsResponse,
  TurfMetaResponse,
  TurfResponse,
  UtilityResponse,
} from "@/types/maxdiff";
import type { SurveyResponse } from "@/types/chat";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

/**
 * Identify the caller on every request with the signed token from login.
 * The backend resolves the account (and which regions it may read) from it,
 * so without it every endpoint 401s.
 */
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * A 401 means the stored account is gone or was never valid — the server has
 * rejected us, so the client-side "logged in" flag is a lie. Clear it and send
 * the user to sign in again rather than letting every panel render an error.
 *
 * Uses a hard location change instead of the router: interceptors live outside
 * React and have no navigate(). BASENAME is the router's, same as main.tsx.
 *
 * A 403 REGION_FORBIDDEN means signed in, but not for this region's study:
 * show the no-access page, which links to the regions the account does have.
 */
const BASENAME = appBase();
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && isLoggedIn()) {
      logout();
      window.location.href = `${BASENAME}/login`;
    } else if (
      axios.isAxiosError(error) &&
      error.response?.status === 403 &&
      error.response.data?.code === "REGION_FORBIDDEN" &&
      !window.location.pathname.endsWith("/no-access")
    ) {
      window.location.href = `${BASENAME}/no-access`;
    }
    return Promise.reject(error);
  }
);

/**
 * Query string for every endpoint.
 *
 * All values are pre-serialised strings — multi-valued filters arrive as
 * "1,2,3". The backend's Filters.from_query splits on commas, and sending
 * them this way avoids axios's default array encoding (`market[]=1`), which
 * Flask's request.args.getlist("market") would not see.
 */
export type ApiParams = Record<string, string>;

function withVariant(params: ApiParams): ApiParams {
  // Endpoints resolve the survey from ?variant= when no id is in the path,
  // so the dashboard never has to know a survey id.
  return { region: getRegion(), variant: regionInfo().variant, ...params };
}

/**
 * Survey metadata, including the chatoctopus session the chat panel talks to.
 *
 * Resolved from ?variant= like every other endpoint, so the chat page never
 * has to know a survey id either. The session is created lazily server-side on
 * first call, per account — `ai_survey` comes back null if that failed, and the
 * panel says so rather than hanging on a session that does not exist.
 */
export async function getSurvey(surveyId?: number): Promise<SurveyResponse> {
  const path = surveyId ? `/survey/${surveyId}` : "/survey";
  const { data } = await api.get(path, { params: withVariant({}) });
  return data;
}

export async function getMeta(params: ApiParams): Promise<MetaResponse> {
  const { data } = await api.get("/maxdiff/meta", { params: withVariant(params) });
  // Regrouped once here, so the unit chips and the country picker agree.
  return data?.subregions?.length ? { ...data, subregions: operatingUnits(data.subregions) } : data;
}

export async function getUtilities(params: ApiParams): Promise<UtilityResponse> {
  const { data } = await api.get("/maxdiff/utilities", { params: withVariant(params) });
  return data;
}

export async function getRanking(params: ApiParams): Promise<RankingResponse> {
  const { data } = await api.get("/maxdiff/ranking", { params: withVariant(params) });
  return data;
}

export async function getBw(params: ApiParams): Promise<BwResponse> {
  const { data } = await api.get("/maxdiff/bw", { params: withVariant(params) });
  return data;
}

export async function getMarkets(params: ApiParams): Promise<MarketsResponse> {
  const { data } = await api.get("/maxdiff/markets", { params: withVariant(params) });
  return data;
}

/**
 * Latent Class profiles.
 *
 * `k` picks which fitted class count to read. `refit` re-fits the mixture on
 * the filtered base instead of reporting the global classes — seconds of work
 * server-side, cached per filter signature, so it is opt-in rather than the
 * default. Without it, filtering selects which respondents you look at but
 * leaves the class definitions alone, which is what keeps cuts comparable.
 */
export async function getSegments(
  params: ApiParams,
  opts: { k?: number | null; refit?: boolean } = {}
): Promise<SegmentsResponse> {
  const extra: ApiParams = {};
  if (opts.k) extra.k = String(opts.k);
  if (opts.refit) extra.refit = "1";
  const { data } = await api.get("/maxdiff/segments", {
    params: withVariant({ ...params, ...extra }),
  });
  return data;
}

export async function getAssociation(
  axis: AssociationAxis,
  params: ApiParams
): Promise<AssociationResponse> {
  const { data } = await api.get(`/maxdiff/association/${axis}`, {
    params: withVariant(params),
  });
  return data;
}

/**
 * Prompted awareness — B2 (benefits) and M2 (ingredients).
 *
 * `ingredients` here is whole-base incidence, counting a person once across
 * every benefit they linked the ingredient to. The per-benefit breakdown is
 * getAssociation("ingredients"), which is a different question on a different
 * base.
 */
export async function getAwareness(
  axis: AwarenessAxis,
  params: ApiParams
): Promise<AwarenessResponse> {
  const { data } = await api.get(`/maxdiff/awareness/${axis}`, {
    params: withVariant(params),
  });
  return data;
}

/** Consumer desirability per benefit platform for the /home summary table. */
export async function getHomeSummary(market?: number): Promise<HomeSummaryResponse> {
  const { data } = await api.get("/home/summary", { params: withVariant(market != null ? { market: String(market) } : {}) });
  return data;
}

/** Euromonitor platform sizing for the /home page (rows as stored; the page aggregates). `year` defaults to the latest actual. */
export async function getHomeMarket(year?: number): Promise<HomeMarketResponse> {
  const { data } = await api.get("/home/market", { params: withVariant(year != null ? { year: String(year) } : {}) });
  return data;
}

/**
 * TURF — the best-reaching combination of benefits.
 *
 * `locked` pins benefits into the portfolio so the optimiser solves around
 * them; that is what makes clicking a benefit in the ranking interactive.
 * Sent as indices into the canonical item list, never as statements.
 */
export async function getTurf(
  params: ApiParams,
  opts: {
    size?: number;
    maxK?: number;
    locked?: number[];
    rule?: string;
    topN?: number;
    threshold?: number;
  } = {}
): Promise<TurfResponse> {
  const extra: ApiParams = {};
  if (opts.size) extra.size = String(opts.size);
  if (opts.maxK) extra.max_k = String(opts.maxK);
  if (opts.locked?.length) extra.locked = opts.locked.join(",");
  if (opts.rule) extra.rule = opts.rule;
  if (opts.topN) extra.top_n = String(opts.topN);
  if (opts.threshold !== undefined) extra.threshold = String(opts.threshold);
  const { data } = await api.get("/maxdiff/turf", {
    params: withVariant({ ...params, ...extra }),
  });
  return data;
}

export async function getTurfMeta(): Promise<TurfMetaResponse> {
  const { data } = await api.get("/maxdiff/turf/meta");
  return data;
}
