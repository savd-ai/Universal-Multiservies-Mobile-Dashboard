import "server-only";
import { Semaphore, SingleFlight, singleton } from "../cache";
import { mask } from "../env/status";
import { log } from "../log";
import { failureFromJson, GoogleAdsApiError, parseGoogleAdsFailure, transportError } from "./errors";
import { isRecord, type GoogleAdsRow } from "./json";
import { getAccessToken, invalidateAccessToken, type OAuthCredentials } from "./oauth";
import { backoffDelay, MAX_HONORED_RETRY_DELAY_MS, MAX_RETRIES, sleep as realSleep, type Sleep } from "./retry";

// READ-ONLY Google Ads REST client. It can reach exactly three endpoints — googleAds:search, googleAds:searchStream
// and customers:listAccessibleCustomers — and every URL is checked against that allowlist before it is fetched.
// Requests share a process-wide concurrency limit; identical in-flight queries are collapsed into one.

export const API_ORIGIN = "https://googleads.googleapis.com";
export const READ_ONLY_METHODS = ["googleAds:search", "googleAds:searchStream", "customers:listAccessibleCustomers"] as const;

export interface GoogleAdsClientConfig {
  apiVersion: string;
  /** legacy developer token — optional and ignored by Google since 2026-09-09; sent only when configured */
  developerToken?: string;
  /** manager id sent as login-customer-id (digits) */
  loginCustomerId?: string;
  timeoutMs: number;
  maxConcurrency: number;
  credentials: OAuthCredentials;
}

export interface ClientDeps {
  fetch?: typeof fetch;
  sleep?: Sleep;
  random?: () => number;
}

const semaphore = (limit: number) => singleton(`gads:semaphore:${limit}`, () => new Semaphore(limit));
const queryFlights = () => singleton("gads:query-flights", () => new SingleFlight<GoogleAdsRow[]>());

/** Throws unless `url` is one of the read-only Google Ads methods on the official host. */
export function assertReadOnlyUrl(url: string): void {
  const u = new URL(url);
  const method = u.pathname.split("/").pop() ?? "";
  const allowed = (READ_ONLY_METHODS as readonly string[]).includes(method);
  if (u.origin !== API_ORIGIN || !allowed || u.search !== "") throw new Error(`Blocked non-read-only Google Ads request: ${u.origin}${u.pathname}`);
}

function customerDigits(customerId: string): string {
  if (!/^\d{1,20}$/.test(customerId)) {
    throw new GoogleAdsApiError({ code: "INVALID_CUSTOMER_ID", message: `Customer id must be digits only (got ${JSON.stringify(customerId).slice(0, 24)})`, httpStatus: 0, category: "requestError" });
  }
  return customerId;
}

/** searchStream answers with a JSON array of batches `{results, fieldMask, requestId}`; search with one object. */
export function flattenStream(json: unknown): { rows: GoogleAdsRow[]; requestId?: string } {
  const batches = Array.isArray(json) ? json : [json];
  const rows: GoogleAdsRow[] = [];
  let requestId: string | undefined;
  for (const batch of batches) {
    if (!isRecord(batch)) continue;
    if (!requestId && typeof batch.requestId === "string") requestId = batch.requestId;
    if (Array.isArray(batch.results)) for (const r of batch.results) if (isRecord(r)) rows.push(r);
  }
  return { rows, requestId };
}

export class GoogleAdsClient {
  constructor(
    private readonly cfg: GoogleAdsClientConfig,
    private readonly deps: ClientDeps = {},
  ) {
    if (!/^v\d{1,3}$/.test(cfg.apiVersion)) throw new Error(`Invalid GOOGLE_ADS_API_VERSION "${cfg.apiVersion.slice(0, 12)}" (expected e.g. v25)`);
  }

  get apiVersion(): string {
    return this.cfg.apiVersion;
  }

  /** Run a GAQL query via googleAds:searchStream and return the flattened result rows. */
  async search(customerId: string, query: string, label = "query"): Promise<GoogleAdsRow[]> {
    const cid = customerDigits(customerId);
    const key = `${this.cfg.apiVersion}|${this.cfg.loginCustomerId ?? "-"}|${cid}|${query}`;
    return queryFlights().run(key, async () => {
      const started = Date.now();
      const json = await this.send(`${API_ORIGIN}/${this.cfg.apiVersion}/customers/${cid}/googleAds:searchStream`, "POST", JSON.stringify({ query }), true);
      const { rows, requestId } = flattenStream(json);
      log.debug("Google Ads query", { label, customer: mask(cid, false), rows: rows.length, ms: Date.now() - started, requestId });
      return rows;
    });
  }

  /** Customer ids the OAuth user can access directly (no login-customer-id involved). */
  async listAccessibleCustomers(): Promise<string[]> {
    const json = await this.send(`${API_ORIGIN}/${this.cfg.apiVersion}/customers:listAccessibleCustomers`, "GET", undefined, false);
    const names = isRecord(json) && Array.isArray(json.resourceNames) ? json.resourceNames : [];
    return names
      .map((n) => (typeof n === "string" ? /^customers\/(\d+)$/.exec(n)?.[1] : undefined))
      .filter((id): id is string => id !== undefined);
  }

  private async send(url: string, method: "GET" | "POST", body: string | undefined, withLogin: boolean): Promise<unknown> {
    assertReadOnlyUrl(url);
    const doFetch = this.deps.fetch ?? globalThis.fetch;
    const wait = this.deps.sleep ?? realSleep;
    const oauthDeps = { fetch: this.deps.fetch, sleep: this.deps.sleep, random: this.deps.random, timeoutMs: this.cfg.timeoutMs };
    let retries = 0;
    let refreshedToken = false;
    for (;;) {
      const token = await getAccessToken(this.cfg.credentials, oauthDeps);
      const headers: Record<string, string> = { authorization: `Bearer ${token}`, accept: "application/json" };
      if (this.cfg.developerToken) headers["developer-token"] = this.cfg.developerToken;
      if (body !== undefined) headers["content-type"] = "application/json";
      if (withLogin && this.cfg.loginCustomerId) headers["login-customer-id"] = this.cfg.loginCustomerId;

      let failure: GoogleAdsApiError;
      try {
        const res = await semaphore(this.cfg.maxConcurrency).use(async () => {
          const r = await doFetch(url, { method, headers, body, cache: "no-store", signal: AbortSignal.timeout(this.cfg.timeoutMs) });
          return { status: r.status, ok: r.ok, headers: r.headers, text: await r.text() };
        });
        if (res.ok) {
          const json = parseJson(res.text);
          if (json === undefined) {
            failure = new GoogleAdsApiError({ code: "INVALID_RESPONSE", message: "Google Ads API returned a non-JSON body", httpStatus: res.status, category: "http", retryable: true });
          } else {
            // A stream can fail mid-way: the array then ends with an `{error}` element.
            const streamError = failureFromJson(200, json, res.headers);
            if (!streamError) return json;
            failure = streamError;
          }
        } else {
          failure = parseGoogleAdsFailure(res.status, res.text, res.headers);
          if (res.status === 401 && !refreshedToken) {
            // Expired or revoked access token: refresh once, outside the retry budget.
            refreshedToken = true;
            invalidateAccessToken(this.cfg.credentials);
            continue;
          }
        }
      } catch (err) {
        failure = transportError(err, this.cfg.timeoutMs);
      }

      const delay = retryDelay(failure, retries, this.deps.random);
      if (delay === null) throw failure;
      retries++;
      log.warn("Google Ads request failed; retrying", { code: failure.code, status: failure.httpStatus, retry: retries, delayMs: delay, requestId: failure.requestId });
      await wait(delay);
    }
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function retryDelay(err: GoogleAdsApiError, retries: number, random?: () => number): number | null {
  if (!err.retryable || retries >= MAX_RETRIES) return null;
  if (err.retryAfterMs !== undefined) return err.retryAfterMs <= MAX_HONORED_RETRY_DELAY_MS ? err.retryAfterMs : null;
  return backoffDelay(retries, random);
}
