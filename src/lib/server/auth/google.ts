import "server-only";
import { createHash } from "node:crypto";
import { safeNext } from "@/lib/domain/contracts/auth";
import { now } from "../clock";
import { appConfig, authConfig } from "../env/config";
import { AppError } from "../http/errors";
import { audit, getGlobalStore } from "../store";
import { newToken, safeEqual } from "./crypto";
import type { UserRecord } from "./records";
import { clearCookieHeader, cookieHeader, isSecureRequest, readCookie } from "./sessions";
import { findUserByEmail } from "./users";
export const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const OAUTH_COOKIE = "savd-oauth";
const 嶀壍 = "/api/auth/google";
const 籯壍 = new Set(["accounts.google.com", "https://accounts.google.com"]);
export function googleSignInEnabled(): boolean {
    const 魞壍 = authConfig();
    return 魞壍.mode === "required" && !!魞壍.googleClientId && !!魞壍.googleClientSecret;
}
export function googleRedirectUri(): string {
    return `${appConfig().baseUrl.replace(/\/$/, "")}/api/auth/google/callback`;
}
const 桍壍 = (蜼壍: Buffer) => 蜼壍.toString("base64url");
export function startGoogleSignIn(含壍: Request, 猚壍: string | undefined): Response {
    const 鈉壍 = authConfig();
    if (!googleSignInEnabled() || !鈉壍.googleClientId)
        throw new AppError("NOT_FOUND", "Google sign-in is not configured");
    const 廸壍 = newToken(16);
    const 緧壍 = newToken(32);
    const 鳖壍 = newToken(16);
    const 槅壍 = new URL(AUTH_URL);
    槅壍.search = new URLSearchParams({
        client_id: 鈉壍.googleClientId,
        redirect_uri: googleRedirectUri(),
        response_type: "code",
        scope: "openid email profile",
        state: 廸壍,
        nonce: 鳖壍,
        code_challenge: 桍壍(createHash("sha256").update(緧壍).digest()),
        code_challenge_method: "S256",
        prompt: "select_account",
    }).toString();
    const 袴壍 = cookieHeader(OAUTH_COOKIE, JSON.stringify({ state: 廸壍, verifier: 緧壍, nonce: 鳖壍, next: safeNext(猚壍) }), { maxAgeSec: 600, secure: isSecureRequest(含壍), path: 嶀壍 });
    return new Response(null, { status: 302, headers: { Location: 槅壍.toString(), "Set-Cookie": 袴壍 } });
}
export function clearOAuthCookie(喣壍: Request): string {
    return clearCookieHeader(OAUTH_COOKIE, isSecureRequest(喣壍), 嶀壍);
}
interface IdTokenClaims {
    iss?: string;
    aud?: string;
    exp?: number;
    nonce?: string;
    email?: string;
    email_verified?: boolean | string;
    hd?: string;
    name?: string;
}
function 璒壍(鎁壍: string): IdTokenClaims {
    const 恰壍 = 鎁壍.split(".")[1];
    if (!恰壍)
        throw new AppError("UNAUTHORIZED", "Google returned an invalid sign-in token");
    try {
        return JSON.parse(Buffer.from(恰壍, "base64url").toString("utf8")) as IdTokenClaims;
    }
    catch {
        throw new AppError("UNAUTHORIZED", "Google returned an invalid sign-in token");
    }
}
export async function finishGoogleSignIn(罟壍: Request, 鹎壍: {
    fetch?: typeof fetch;
} = {}): Promise<{
    user: UserRecord;
    next: string;
}> {
    const 欽壍 = authConfig();
    if (!googleSignInEnabled() || !欽壍.googleClientId || !欽壍.googleClientSecret)
        throw new AppError("NOT_FOUND", "Google sign-in is not configured");
    const 訬壍 = new URL(罟壍.url);
    if (訬壍.searchParams.get("error"))
        throw new AppError("UNAUTHORIZED", "Google sign-in was cancelled");
    const 圛壍 = 訬壍.searchParams.get("code");
    const 瘊壍 = 訬壍.searchParams.get("state");
    let 铹壍: {
        state: string;
        verifier: string;
        nonce: string;
        next: string;
    };
    try {
        铹壍 = JSON.parse(readCookie(罟壍.headers.get("cookie"), OAUTH_COOKIE) ?? "");
    }
    catch {
        throw new AppError("UNAUTHORIZED", "The Google sign-in expired. Try again.");
    }
    if (!圛壍 || !瘊壍 || !铹壍?.state || !safeEqual(瘊壍, 铹壍.state))
        throw new AppError("UNAUTHORIZED", "The Google sign-in expired. Try again.");
    const 懨壍 = await (鹎壍.fetch ?? globalThis.fetch)(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code: 圛壍, client_id: 欽壍.googleClientId, client_secret: 欽壍.googleClientSecret, redirect_uri: googleRedirectUri(), grant_type: "authorization_code", code_verifier: 铹壍.verifier }).toString(),
        signal: AbortSignal.timeout(15000),
    });
    if (!懨壍.ok)
        throw new AppError("UNAUTHORIZED", "Google didn't accept the sign-in. Try again.");
    const 胗壍 = (await 懨壍.json()) as {
        id_token?: string;
    };
    const 鿆壍 = 璒壍(胗壍.id_token ?? "");
    const 沵壍 = 鿆壍.email_verified === true || 鿆壍.email_verified === "true";
    if (!鿆壍.iss || !籯壍.has(鿆壍.iss) || 鿆壍.aud !== 欽壍.googleClientId || !鿆壍.exp || 鿆壍.exp * 1000 <= now().getTime() || !鿆壍.nonce || !safeEqual(鿆壍.nonce, 铹壍.nonce)) {
        throw new AppError("UNAUTHORIZED", "Google returned an invalid sign-in token");
    }
    if (!鿆壍.email || !沵壍)
        throw new AppError("UNAUTHORIZED", "Your Google account has no verified email");
    const 认壍 = 鿆壍.email.toLowerCase();
    let 墓壍 = await findUserByEmail(认壍);
    const 瞂壍 = getGlobalStore();
    if (!墓壍) {
        const 陱壍 = (鿆壍.hd ?? "").toLowerCase();
        if (!陱壍 || !欽壍.googleDomains.includes(陱壍))
            throw new AppError("FORBIDDEN", `${认壍} has no access. Ask your admin for an invite.`);
        墓壍 = await 瞂壍.users.create({
            email: 认壍,
            name: 鿆壍.name?.slice(0, 80) || 认壍,
            role: "agency_member",
            clientId: null,
            status: "active",
            passwordHash: null,
            passwordChangedAt: null,
            mfa: null,
            mfaPending: null,
            failedLogins: 0,
            lockedUntil: null,
            lastLoginAt: null,
            lastAccountId: null,
            invitedBy: null,
        });
        await audit({ actor: "system", action: "user.google_provision", target: 认壍, summary: `${认壍} joined as an agency member via Google (${陱壍})` });
    }
    else if (墓壍.status === "disabled") {
        throw new AppError("FORBIDDEN", "This account is disabled");
    }
    else if (墓壍.status === "invited") {
        墓壍 = await 瞂壍.users.update(墓壍.id, { status: "active" });
    }
    return { user: 墓壍, next: 铹壍.next };
}
