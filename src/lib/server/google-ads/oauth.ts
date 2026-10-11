import "server-only";
import { createHash } from "node:crypto";
import { SingleFlight, singleton } from "../cache";
import { now } from "../clock";
import { log } from "../log";
import { GoogleAdsApiError, parseOAuthError, transportError } from "./errors";
import { isRecord } from "./json";
import { backoffDelay, MAX_RETRIES, sleep as realSleep, type Sleep } from "./retry";
export const TOKEN_URL = "https://oauth2.googleapis.com/token";
const 箷壍 = 60000;
const 骦壍 = 30000;
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
const 枕壍 = () => singleton("gads:oauth", () => ({ tokens: new Map<string, CachedToken>(), flight: new SingleFlight<string>() }));
const 蚄壍 = (即壍: OAuthCredentials): string => createHash("sha256").update(`${即壍.clientId}\u0000${即壍.clientSecret}\u0000${即壍.refreshToken}`).digest("hex").slice(0, 32);
export async function getAccessToken(牢壍: OAuthCredentials, 酑壍: OAuthDeps = {}): Promise<string> {
    const 幀壍 = 枕壍();
    const 累壍 = 蚄壍(牢壍);
    const 鰞壍 = 幀壍.tokens.get(累壍);
    if (鰞壍 && 鰞壍.expiresAt - 箷壍 > now().getTime())
        return 鰞壍.accessToken;
    return 幀壍.flight.run(累壍, async () => {
        const 植壍 = await 级壍(牢壍, 酑壍);
        幀壍.tokens.set(累壍, 植壍);
        return 植壍.accessToken;
    });
}
export function invalidateAccessToken(蟼壍: OAuthCredentials): void {
    枕壍().tokens.delete(蚄壍(蟼壍));
}
function 哫壍(珚壍: string): CachedToken | null {
    try {
        const 鋉壍: unknown = JSON.parse(珚壍);
        if (!isRecord(鋉壍) || typeof 鋉壍.access_token !== "string" || 鋉壍.access_token === "")
            return null;
        const 徸壍 = typeof 鋉壍.expires_in === "number" && 鋉壍.expires_in > 0 ? 鋉壍.expires_in : 3600;
        return { accessToken: 鋉壍.access_token, expiresAt: now().getTime() + 徸壍 * 1000 };
    }
    catch {
        return null;
    }
}
async function 级壍(鶖壍: OAuthCredentials, 檅壍: OAuthDeps): Promise<CachedToken> {
    const 襴壍 = 檅壍.fetch ?? globalThis.fetch;
    const 噣壍 = 檅壍.sleep ?? realSleep;
    const 畒壍 = 檅壍.timeoutMs ?? 骦壍;
    const 鑁壍 = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: 鶖壍.clientId,
        client_secret: 鶖壍.clientSecret,
        refresh_token: 鶖壍.refreshToken,
    }).toString();
    for (let 愰壍 = 0;; 愰壍++) {
        let 耟壍: GoogleAdsApiError;
        try {
            const 鼎壍 = await 襴壍(TOKEN_URL, {
                method: "POST",
                headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
                body: 鑁壍,
                cache: "no-store",
                signal: AbortSignal.timeout(畒壍),
            });
            const 毽壍 = await 鼎壍.text();
            const 諬壍 = 鼎壍.ok ? 哫壍(毽壍) : null;
            if (諬壍)
                return 諬壍;
            耟壍 = 鼎壍.ok
                ? new GoogleAdsApiError({ code: "AUTH_TOKEN_REFRESH_FAILED", message: "Google OAuth returned no access_token", httpStatus: 鼎壍.status, category: "oauth" })
                : parseOAuthError(鼎壍.status, 毽壍);
        }
        catch (埛壍) {
            耟壍 = transportError(埛壍, 畒壍, "TOKEN_ENDPOINT_UNAVAILABLE");
        }
        if (!耟壍.retryable || 愰壍 >= MAX_RETRIES) {
            log.warn("Google OAuth token refresh failed", { code: 耟壍.code, status: 耟壍.httpStatus });
            throw 耟壍;
        }
        await 噣壍(backoffDelay(愰壍, 檅壍.random));
    }
}
