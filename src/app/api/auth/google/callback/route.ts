import { clearOAuthCookie, finishGoogleSignIn } from "@/lib/server/auth/google";
import { redirectWithCookies } from "@/lib/server/auth/respond";
import { cookieHeader, createSession, isSecureRequest, MFA_COOKIE, MFA_COOKIE_PATH } from "@/lib/server/auth/sessions";
import { createMfaChallenge, MFA_CHALLENGE_SECONDS, recordLogin } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

// Google redirects the browser here; errors go back to the login page as a message instead of a JSON body. People who
// turned on two-factor authentication still enter their code: the challenge waits in an HttpOnly cookie that only
// the 2FA endpoint receives.
export const GET = route({ rateLimit: { key: "auth-google", perMinute: 20 } }, async ({ req }) => {
  try {
    const { user, next } = await finishGoogleSignIn(req);
    if (user.mfa) {
      const challenge = await createMfaChallenge(user, next, "google");
      return redirectWithCookies("/login?step=2fa", [cookieHeader(MFA_COOKIE, challenge, { maxAgeSec: MFA_CHALLENGE_SECONDS, secure: isSecureRequest(req), path: MFA_COOKIE_PATH }), clearOAuthCookie(req)]);
    }
    const { cookie } = await createSession(user, req, "google");
    await recordLogin(user, "Google");
    return redirectWithCookies(next, [cookie, clearOAuthCookie(req)]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google sign-in failed";
    return redirectWithCookies(`/login?error=${encodeURIComponent(message)}`, [clearOAuthCookie(req)]);
  }
});
