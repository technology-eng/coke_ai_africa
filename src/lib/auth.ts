import axios from "axios";
import { API_BASE_URL } from "@/ENV";
import { queryClient } from "@/lib/queryClient";
import { getRegion } from "@/lib/region";

/**
 * Client-side auth: log in once, keep the signed token the server returns in
 * localStorage, send it as `Authorization: Bearer` on every request. The
 * server checks the signature and expiry and decides which regions the
 * account may read; the account id and regions kept here only drive the UI.
 *
 * Keys are namespaced per app so a shared browser running both the stills
 * workbench and this dashboard does not cross-authenticate.
 */
const AUTH_KEY = "coke-africa:auth";
const EMAIL_KEY = "coke-africa:auth-email";
const ACCOUNT_ID_KEY = "coke-africa:account-id";
const SURVEYS_KEY = "coke-africa:surveys";
const TOKEN_KEY = "coke-africa:token";
const REGIONS_KEY = "coke-africa:regions";

export interface AccountSurvey {
  id: number;
  variant: string;
  title: string;
  job_number: string | null;
}

export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  // A session from before tokens has no token; treat it as signed out.
  return window.localStorage.getItem(AUTH_KEY) === "1" && !!window.localStorage.getItem(TOKEN_KEY);
}

export function getAuthEmail(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(EMAIL_KEY);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

/** Region codes this account may open, cached from login (UI hint only). */
export function getRegions(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(REGIONS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getAccountId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCOUNT_ID_KEY);
}

/**
 * Accounts that still see the panels retired from the standard view: the HB
 * utility/CI table, best-minus-worst, the Latent Class need-states, and the
 * need-state filter that drives them.
 *
 * A VISIBILITY RULE, NOT AN ACCESS CONTROL — same caveat as the login above.
 * The endpoints behind those panels are open to any authenticated account and
 * this list ships in the browser bundle. It decides what the dashboard builds,
 * not who may read the numbers; genuine restriction belongs on the endpoints.
 *
 * It lives here rather than in the page because the FILTER STATE has to honour
 * it too. Gating only the rendering left `segment_k`/`segment` still parsed out
 * of the URL for everyone, so a link shared by an extended account would
 * silently filter a standard account's whole dashboard to one class, with no
 * chip on screen to explain it and no way to clear it.
 */
const EXTENDED_PANEL_ACCOUNTS = new Set([
  "2", // devanathan.srinivasan@brand-scapes.com
  "5", // jaeyoung.lee@coca-cola.com
]);

export function hasExtendedPanels(): boolean {
  return EXTENDED_PANEL_ACCOUNTS.has(getAccountId() ?? "");
}

/** Need-state segments (panel, filter chips and the segment URL params) are
 *  hidden outside EU (GLOBAL, ASP) for every account; EU keeps them for extended accounts. */
export function hasNeedStates(): boolean {
  return getRegion() === "EU" && hasExtendedPanels();
}

/** Dashboards this account owns, cached from login so the UI can decide
 *  whether to offer a variant picker without a round trip. */
export function getSurveys(): AccountSurvey[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SURVEYS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function login(email: string, password: string): Promise<string | null> {
  try {
    const { data } = await axios.post(`${API_BASE_URL}/login`, {
      email: email.trim().toLowerCase(),
      password,
    });
    // A server older than the token change answers without one; storing
    // "undefined" would 401 every call, so fail the sign-in instead.
    if (!data?.token) return "The server did not issue a session token. Is the backend up to date?";
    window.localStorage.setItem(AUTH_KEY, "1");
    window.localStorage.setItem(TOKEN_KEY, data.token);
    window.localStorage.setItem(REGIONS_KEY, JSON.stringify(data.regions ?? []));
    window.localStorage.setItem(EMAIL_KEY, data.email);
    window.localStorage.setItem(ACCOUNT_ID_KEY, String(data.account_id));
    window.localStorage.setItem(SURVEYS_KEY, JSON.stringify(data.surveys ?? []));
    // Anything cached under a previous account must not survive the switch.
    queryClient.clear();
    return null;
  } catch (err: unknown) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    if (status === 401) return "Invalid email or password.";
    if (status === 400) return "Enter both an email and a password.";
    if (status === 403) return "This account has no dashboard access yet. Ask an admin to grant a region.";
    if (status === undefined) return "Cannot reach the server. Is the API running?";
    return "Sign-in failed. Try again.";
  }
}

export function logout(): void {
  for (const k of [AUTH_KEY, EMAIL_KEY, ACCOUNT_ID_KEY, SURVEYS_KEY, TOKEN_KEY, REGIONS_KEY]) {
    window.localStorage.removeItem(k);
  }
  queryClient.clear();
}
