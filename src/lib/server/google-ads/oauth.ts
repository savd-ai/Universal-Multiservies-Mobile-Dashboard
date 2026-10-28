import "server-only";
import { createHash } from "node:crypto";
import { SingleFlight, singleton } from "../cache";
import { now } from "../clock";
import { log } from "../log";
import { GoogleAdsApiError, parseOAuthError, transportError } from "./errors";
import { isRecord } from "./json";
import { backoffDelay, MAX_RETRIES, sleep as realSleep, type Sleep } from "./retry";
export const TOKEN_URL = "https://oauth2.googleapis.com/token";
const EXPIRY_SKEW_MS = 60000;
const DEFAULT_TIMEOUT_MS = 30000;
export interface OAuthCredentials {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
}
export interface OAuthDeps {
    fetch?: typeof fetch;
    sleep?: Sleep;
    random?: () => number;
    timeoutMs?: number;
}
interface CachedToken {
    accessToken: string;
    expiresAt: number;
}
const state = () => singleton("gads:oauth", () => ({ tokens: new Map<string, CachedToken>(), flight: new SingleFlight<string>() }));
const keyOf = (c: OAuthCredentials): string => createHash("sha256").update(`${c.clientId}\u0000${c.clientSecret}\u0000${c.refreshToken}`).digest("hex").slice(0, 32);
export async function getAccessToken(creds: OAuthCredentials, deps: OAuthDeps = {}): Promise<string> {
    const s = state();
    const key = keyOf(creds);
    const cached = s.tokens.get(key);
    if (cached && cached.expiresAt - EXPIRY_SKEW_MS > now().getTime())
        return cached.accessToken;
    return s.flight.run(key, async () => {
        const token = await refresh(creds, deps);
        s.tokens.set(key, token);
        return token.accessToken;
    });
}
export function invalidateAccessToken(creds: OAuthCredentials): void {
    state().tokens.delete(keyOf(creds));
}
function parseToken(body: string): CachedToken | null {
    try {
        const json: unknown = JSON.parse(body);
        if (!isRecord(json) || typeof json.access_token !== "string" || json.access_token === "")
            return null;
        const expiresIn = typeof json.expires_in === "number" && json.expires_in > 0 ? json.expires_in : 3600;
        return { accessToken: json.access_token, expiresAt: now().getTime() + expiresIn * 1000 };
    }
    catch {
        return null;
    }
}
async function refresh(creds: OAuthCredentials, deps: OAuthDeps): Promise<CachedToken> {
    const doFetch = deps.fetch ?? globalThis.fetch;
    const wait = deps.sleep ?? realSleep;
    const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const body = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        refresh_token: creds.refreshToken,
    }).toString();
    for (let retry = 0;; retry++) {
        let error: GoogleAdsApiError;
        try {
            const res = await doFetch(TOKEN_URL, {
                method: "POST",
                headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
                body,
                cache: "no-store",
                signal: AbortSignal.timeout(timeoutMs),
            });
            const text = await res.text();
            const token = res.ok ? parseToken(text) : null;
            if (token)
                return token;
            error = res.ok
                ? new GoogleAdsApiError({ code: "AUTH_TOKEN_REFRESH_FAILED", message: "Google OAuth returned no access_token", httpStatus: res.status, category: "oauth" })
                : parseOAuthError(res.status, text);
        }
        catch (err) {
            error = transportError(err, timeoutMs, "TOKEN_ENDPOINT_UNAVAILABLE");
        }
        if (!error.retryable || retry >= MAX_RETRIES) {
            log.warn("Google OAuth token refresh failed", { code: error.code, status: error.httpStatus });
            throw error;
        }
        await wait(backoffDelay(retry, deps.random));
    }
}
