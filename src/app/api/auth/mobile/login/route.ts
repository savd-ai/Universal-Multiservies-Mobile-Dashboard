import { mobileLoginSchema, type MobileLoginResponse } from "@/lib/domain/contracts/mobile";
import { createMfaChallenge, verifyLogin } from "@/lib/server/auth/users";
import { authConfig } from "@/lib/server/env/config";
import { route } from "@/lib/server/http/api";
import { AppError } from "@/lib/server/http/errors";
import { startMobileSession } from "@/lib/server/mobile/session";

export const runtime = "nodejs";

/** Phone sign-in. Same checks and lockout as the web form; with 2FA on it answers a challenge for /api/auth/mobile/mfa. */
export const POST = route({ body: mobileLoginSchema, maxBody: 8 * 1024, rateLimit: { key: "auth-mobile-login", perMinute: 10, burst: 10 } }, async ({ req, body }): Promise<MobileLoginResponse> => {
  if (authConfig().mode === "off") throw new AppError("VALIDATION_ERROR", "Sign-in is turned off on this server (AUTH_MODE=off); the app needs a server with sign-in.");
  const user = await verifyLogin(body.email, body.password);
  if (user.mfa) return { ok: false, mfa: { challenge: await createMfaChallenge(user) } };
  return startMobileSession(user, req, body.device, body.installId, "mobile app");
});
