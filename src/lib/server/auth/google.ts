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
const COOKIE_PATH = "/api/auth/google";
const ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
export function googleSignInEnabled(): boolean {
    const c = authConfig();
    return c.mode === "required" && !!c.googleClientId && !!c.googleClientSecret;
}
export function googleRedirectUri(): string {
    return `${appConfig().baseUrl.replace(/\/$/, "")}/api/auth/google/callback`;
}
const b64url = (buf: Buffer) => buf.toString("base64url");
export function startGoogleSignIn(req: Request, next: string | undefined): Response {
    const cfg = authConfig();
    if (!googleSignInEnabled() || !cfg.googleClientId)
        throw new AppError("NOT_FOUND", "Google sign-in is not configured");
    const state = newToken(16);
    const verifier = newToken(32);
    const nonce = newToken(16);
    const url = new URL(AUTH_URL);
    url.search = new URLSearchParams({
        client_id: cfg.googleClientId,
        redirect_uri: googleRedirectUri(),
        response_type: "code",
        scope: "openid email profile",
        state,
        nonce,
        code_challenge: b64url(createHash("sha256").update(verifier).digest()),
        code_challenge_method: "S256",
        prompt: "select_account",
    }).toString();
    const cookie = cookieHeader(OAUTH_COOKIE, JSON.stringify({ state, verifier, nonce, next: safeNext(next) }), { maxAgeSec: 600, secure: isSecureRequest(req), path: COOKIE_PATH });
    return new Response(null, { status: 302, headers: { Location: url.toString(), "Set-Cookie": cookie } });
}
export function clearOAuthCookie(req: Request): string {
    return clearCookieHeader(OAUTH_COOKIE, isSecureRequest(req), COOKIE_PATH);
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
function decodeIdToken(idToken: string): IdTokenClaims {
    const payload = idToken.split(".")[1];
    if (!payload)
        throw new AppError("UNAUTHORIZED", "Google returned an invalid sign-in token");
    try {
        return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as IdTokenClaims;
    }
    catch {
        throw new AppError("UNAUTHORIZED", "Google returned an invalid sign-in token");
    }
}
export async function finishGoogleSignIn(req: Request, deps: {
    fetch?: typeof fetch;
} = {}): Promise<{
    user: UserRecord;
    next: string;
}> {
    const cfg = authConfig();
    if (!googleSignInEnabled() || !cfg.googleClientId || !cfg.googleClientSecret)
        throw new AppError("NOT_FOUND", "Google sign-in is not configured");
    const url = new URL(req.url);
    if (url.searchParams.get("error"))
        throw new AppError("UNAUTHORIZED", "Google sign-in was cancelled");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    let saved: {
        state: string;
        verifier: string;
        nonce: string;
        next: string;
    };
    try {
        saved = JSON.parse(readCookie(req.headers.get("cookie"), OAUTH_COOKIE) ?? "");
    }
    catch {
        throw new AppError("UNAUTHORIZED", "The Google sign-in expired. Try again.");
    }
    if (!code || !state || !saved?.state || !safeEqual(state, saved.state))
        throw new AppError("UNAUTHORIZED", "The Google sign-in expired. Try again.");
    const res = await (deps.fetch ?? globalThis.fetch)(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: cfg.googleClientId, client_secret: cfg.googleClientSecret, redirect_uri: googleRedirectUri(), grant_type: "authorization_code", code_verifier: saved.verifier }).toString(),
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok)
        throw new AppError("UNAUTHORIZED", "Google didn't accept the sign-in. Try again.");
    const body = (await res.json()) as {
        id_token?: string;
    };
    const claims = decodeIdToken(body.id_token ?? "");
    const verified = claims.email_verified === true || claims.email_verified === "true";
    if (!claims.iss || !ISSUERS.has(claims.iss) || claims.aud !== cfg.googleClientId || !claims.exp || claims.exp * 1000 <= now().getTime() || !claims.nonce || !safeEqual(claims.nonce, saved.nonce)) {
        throw new AppError("UNAUTHORIZED", "Google returned an invalid sign-in token");
    }
    if (!claims.email || !verified)
        throw new AppError("UNAUTHORIZED", "Your Google account has no verified email");
    const email = claims.email.toLowerCase();
    let user = await findUserByEmail(email);
    const store = getGlobalStore();
    if (!user) {
        const domain = (claims.hd ?? "").toLowerCase();
        if (!domain || !cfg.googleDomains.includes(domain))
            throw new AppError("FORBIDDEN", `${email} has no access. Ask your admin for an invite.`);
        user = await store.users.create({
            email,
            name: claims.name?.slice(0, 80) || email,
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
        await audit({ actor: "system", action: "user.google_provision", target: email, summary: `${email} joined as an agency member via Google (${domain})` });
    }
    else if (user.status === "disabled") {
        throw new AppError("FORBIDDEN", "This account is disabled");
    }
    else if (user.status === "invited") {
        user = await store.users.update(user.id, { status: "active" });
    }
    return { user, next: saved.next };
}
