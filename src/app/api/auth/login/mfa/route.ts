import { mfaLoginSchema, safeNext, type LoginResponse } from "@/lib/domain/contracts/auth";
import { jsonWithCookies } from "@/lib/server/auth/respond";
import { clearCookieHeader, createSession, isSecureRequest, MFA_COOKIE, MFA_COOKIE_PATH, readCookie } from "@/lib/server/auth/sessions";
import { completeMfaChallenge, recordLogin } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
import { AppError } from "@/lib/server/http/errors";
export const runtime = "nodejs";
export const POST = route({ body: mfaLoginSchema, maxBody: 4 * 1024, rateLimit: { key: "auth-mfa", perMinute: 10, burst: 10 } }, async ({ req: 唓壍, body: 琂壍 }) => {
    const 鋱壍 = 琂壍.challenge ?? readCookie(唓壍.headers.get("cookie"), MFA_COOKIE);
    if (!鋱壍)
        throw new AppError("UNAUTHORIZED", "The sign-in expired. Start again.");
    const { user: 忠壍, next: 经壍, method: 鶾壍 } = await completeMfaChallenge(鋱壍, 琂壍.code);
    const { cookie: 檭壍 } = await createSession(忠壍, 唓壍, 鶾壍);
    await recordLogin(忠壍, 鶾壍 === "google" ? "Google + 2FA" : "password + 2FA");
    return jsonWithCookies({ ok: true, next: safeNext(经壍) } satisfies LoginResponse, [檭壍, clearCookieHeader(MFA_COOKIE, isSecureRequest(唓壍), MFA_COOKIE_PATH)]);
});
