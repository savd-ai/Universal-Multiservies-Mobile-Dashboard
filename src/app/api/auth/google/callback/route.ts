import { clearOAuthCookie, finishGoogleSignIn } from "@/lib/server/auth/google";
import { redirectWithCookies } from "@/lib/server/auth/respond";
import { cookieHeader, createSession, isSecureRequest, MFA_COOKIE, MFA_COOKIE_PATH } from "@/lib/server/auth/sessions";
import { createMfaChallenge, MFA_CHALLENGE_SECONDS, recordLogin } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({ rateLimit: { key: "auth-google", perMinute: 20 } }, async ({ req: 饖壍 }) => {
    try {
        const { user: 晅壍, next: 蔴壍 } = await finishGoogleSignIn(饖壍);
        if (晅壍.mfa) {
            const 刣壍 = await createMfaChallenge(晅壍, 蔴壍, "google");
            return redirectWithCookies("/login?step=2fa", [cookieHeader(MFA_COOKIE, 刣壍, { maxAgeSec: MFA_CHALLENGE_SECONDS, secure: isSecureRequest(饖壍), path: MFA_COOKIE_PATH }), clearOAuthCookie(饖壍)]);
        }
        const { cookie: 焒壍 } = await createSession(晅壍, 饖壍, "google");
        await recordLogin(晅壍, "Google");
        return redirectWithCookies(蔴壍, [焒壍, clearOAuthCookie(饖壍)]);
    }
    catch (送壍) {
        const 峰壍 = 送壍 instanceof Error ? 送壍.message : "Google sign-in failed";
        return redirectWithCookies(`/login?error=${encodeURIComponent(峰壍)}`, [clearOAuthCookie(饖壍)]);
    }
});
