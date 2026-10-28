import { mfaLoginSchema, safeNext, type LoginResponse } from "@/lib/domain/contracts/auth";
import { jsonWithCookies } from "@/lib/server/auth/respond";
import { clearCookieHeader, createSession, isSecureRequest, MFA_COOKIE, MFA_COOKIE_PATH, readCookie } from "@/lib/server/auth/sessions";
import { completeMfaChallenge, recordLogin } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
import { AppError } from "@/lib/server/http/errors";
export const runtime = "nodejs";
export const POST = route({ body: mfaLoginSchema, maxBody: 4 * 1024, rateLimit: { key: "auth-mfa", perMinute: 10, burst: 10 } }, async ({ req, body }) => {
    const challenge = body.challenge ?? readCookie(req.headers.get("cookie"), MFA_COOKIE);
    if (!challenge)
        throw new AppError("UNAUTHORIZED", "The sign-in expired. Start again.");
    const { user, next, method } = await completeMfaChallenge(challenge, body.code);
    const { cookie } = await createSession(user, req, method);
    await recordLogin(user, method === "google" ? "Google + 2FA" : "password + 2FA");
    return jsonWithCookies({ ok: true, next: safeNext(next) } satisfies LoginResponse, [cookie, clearCookieHeader(MFA_COOKIE, isSecureRequest(req), MFA_COOKIE_PATH)]);
});
