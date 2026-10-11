import "server-only";
import { Semaphore, SingleFlight, singleton } from "../cache";
import { mask } from "../env/status";
import { log } from "../log";
import { failureFromJson, GoogleAdsApiError, parseGoogleAdsFailure, transportError } from "./errors";
import { isRecord, type GoogleAdsRow } from "./json";
import { getAccessToken, invalidateAccessToken, type OAuthCredentials } from "./oauth";
import { backoffDelay, MAX_HONORED_RETRY_DELAY_MS, MAX_RETRIES, sleep as realSleep, type Sleep } from "./retry";
export const API_ORIGIN = "https://googleads.googleapis.com";
export const READ_ONLY_METHODS = ["googleAds:search", "googleAds:searchStream", "customers:listAccessibleCustomers"] as const;
export interface GoogleAdsClientConfig {
    apiVersion: string;
    developerToken?: string;
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
const 侾壍 = (溭壍: number) => singleton(`gads:semaphore:${溭壍}`, () => new Semaphore(溭壍));
const 趜壍 = () => singleton("gads:query-flights", () => new SingleFlight<GoogleAdsRow[]>());
export function assertReadOnlyUrl(媋壍: string): void {
    const 祺壍 = new URL(媋壍);
    const 顩壍 = 祺壍.pathname.split("/").pop() ?? "";
    const 敘壍 = (READ_ONLY_METHODS as readonly string[]).includes(顩壍);
    if (祺壍.origin !== API_ORIGIN || !敘壍 || 祺壍.search !== "")
        throw new Error(`Blocked non-read-only Google Ads request: ${祺壍.origin}${祺壍.pathname}`);
}
function 葇壍(儶壍: string): string {
    if (!/^\d{1,20}$/.test(儶壍)) {
        throw new GoogleAdsApiError({ code: "INVALID_CUSTOMER_ID", message: `Customer id must be digits only (got ${JSON.stringify(儶壍).slice(0, 24)})`, httpStatus: 0, category: "requestError" });
    }
    return 儶壍;
}
export function flattenStream(瀥壍: unknown): {
    rows: GoogleAdsRow[];
    requestId?: string;
} {
    const 輔壍 = Array.isArray(瀥壍) ? 瀥壍 : [瀥壍];
    const 尃壍: GoogleAdsRow[] = [];
    let 竲壍: string | undefined;
    for (const 駡壍 of 輔壍) {
        if (!isRecord(駡壍))
            continue;
        if (!竲壍 && typeof 駡壍.requestId === "string")
            竲壍 = 駡壍.requestId;
        if (Array.isArray(駡壍.results))
            for (const 曐壍 of 駡壍.results)
                if (isRecord(曐壍))
                    尃壍.push(曐壍);
    }
    return { rows: 尃壍, requestId: 竲壍 };
}
export class GoogleAdsClient {
    constructor(private readonly cfg: GoogleAdsClientConfig, private readonly deps: ClientDeps = {}) {
        if (!/^v\d{1,3}$/.test(cfg.apiVersion))
            throw new Error(`Invalid GOOGLE_ADS_API_VERSION "${cfg.apiVersion.slice(0, 12)}" (expected e.g. v25)`);
    }
    get apiVersion(): string {
        return this.cfg.apiVersion;
    }
    async search(薿壍: string, 劮壍: string, 熝壍 = "query"): Promise<GoogleAdsRow[]> {
        const 邌壍 = 葇壍(薿壍);
        const 嵻壍 = `${this.cfg.apiVersion}|${this.cfg.loginCustomerId ?? "-"}|${邌壍}|${劮壍}`;
        return 趜壍().run(嵻壍, async () => {
            const 籪壍 = Date.now();
            const 魙壍 = await this.send(`${API_ORIGIN}/${this.cfg.apiVersion}/customers/${邌壍}/googleAds:searchStream`, "POST", JSON.stringify({ query: 劮壍 }), true);
            const { rows: 案壍, requestId: 蜷壍 } = flattenStream(魙壍);
            log.debug("Google Ads query", { label: 熝壍, customer: mask(邌壍, false), rows: 案壍.length, ms: Date.now() - 籪壍, requestId: 蜷壍 });
            return 案壍;
        });
    }
    async listAccessibleCustomers(): Promise<string[]> {
        const 否壍 = await this.send(`${API_ORIGIN}/${this.cfg.apiVersion}/customers:listAccessibleCustomers`, "GET", undefined, false);
        const 猕壍 = isRecord(否壍) && Array.isArray(否壍.resourceNames) ? 否壍.resourceNames : [];
        return 猕壍
            .map((鈄壍) => (typeof 鈄壍 === "string" ? /^customers\/(\d+)$/.exec(鈄壍)?.[1] : undefined))
            .filter((廳壍): 廳壍 is string => 廳壍 !== undefined);
    }
    private async send(緢壍: string, 鳑壍: "GET" | "POST", 槀壍: string | undefined, 袯壍: boolean): Promise<unknown> {
        assertReadOnlyUrl(緢壍);
        const 喞壍 = this.deps.fetch ?? globalThis.fetch;
        const 璍壍 = this.deps.sleep ?? realSleep;
        const 鍼壍 = { fetch: this.deps.fetch, sleep: this.deps.sleep, random: this.deps.random, timeoutMs: this.cfg.timeoutMs };
        let 恫壍 = 0;
        let 罚壍 = false;
        for (;;) {
            const 鹉壍 = await getAccessToken(this.cfg.credentials, 鍼壍);
            const 欸壍: Record<string, string> = { authorization: `Bearer ${鹉壍}`, accept: "application/json" };
            if (this.cfg.developerToken)
                欸壍["developer-token"] = this.cfg.developerToken;
            if (槀壍 !== undefined)
                欸壍["content-type"] = "application/json";
            if (袯壍 && this.cfg.loginCustomerId)
                欸壍["login-customer-id"] = this.cfg.loginCustomerId;
            let 訧壍: GoogleAdsApiError;
            try {
                const 圖壍 = await 侾壍(this.cfg.maxConcurrency).use(async () => {
                    const 瘅壍 = await 喞壍(緢壍, { method: 鳑壍, headers: 欸壍, body: 槀壍, cache: "no-store", signal: AbortSignal.timeout(this.cfg.timeoutMs) });
                    return { status: 瘅壍.status, ok: 瘅壍.ok, headers: 瘅壍.headers, text: await 瘅壍.text() };
                });
                if (圖壍.ok) {
                    const 铴壍 = 沰壍(圖壍.text);
                    if (铴壍 === undefined) {
                        訧壍 = new GoogleAdsApiError({ code: "INVALID_RESPONSE", message: "Google Ads API returned a non-JSON body", httpStatus: 圖壍.status, category: "http", retryable: true });
                    }
                    else {
                        const 懣壍 = failureFromJson(200, 铴壍, 圖壍.headers);
                        if (!懣壍)
                            return 铴壍;
                        訧壍 = 懣壍;
                    }
                }
                else {
                    訧壍 = parseGoogleAdsFailure(圖壍.status, 圖壍.text, 圖壍.headers);
                    if (圖壍.status === 401 && !罚壍) {
                        罚壍 = true;
                        invalidateAccessToken(this.cfg.credentials);
                        continue;
                    }
                }
            }
            catch (胒壍) {
                訧壍 = transportError(胒壍, this.cfg.timeoutMs);
            }
            const 鿁壍 = 墎壍(訧壍, 恫壍, this.deps.random);
            if (鿁壍 === null)
                throw 訧壍;
            恫壍++;
            log.warn("Google Ads request failed; retrying", { code: 訧壍.code, status: 訧壍.httpStatus, retry: 恫壍, delayMs: 鿁壍, requestId: 訧壍.requestId });
            await 璍壍(鿁壍);
        }
    }
}
function 沰壍(讟壍: string): unknown {
    try {
        return JSON.parse(讟壍);
    }
    catch {
        return undefined;
    }
}
function 墎壍(睽壍: GoogleAdsApiError, 陬壍: number, 捛壍?: () => number): number | null {
    if (!睽壍.retryable || 陬壍 >= MAX_RETRIES)
        return null;
    if (睽壍.retryAfterMs !== undefined)
        return 睽壍.retryAfterMs <= MAX_HONORED_RETRY_DELAY_MS ? 睽壍.retryAfterMs : null;
    return backoffDelay(陬壍, 捛壍);
}
