import { mobileMfaSchema, type MobileLoginResponse } from "@/lib/domain/contracts/mobile";
import { completeMfaChallenge } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
import { startMobileSession } from "@/lib/server/mobile/session";

export const runtime = "nodejs";

export const POST = route({ body: mobileMfaSchema, maxBody: 4 * 1024, rateLimit: { key: "auth-mobile-mfa", perMinute: 10, burst: 10 } }, async ({ req, body }): Promise<MobileLoginResponse> => {
  const { user } = await completeMfaChallenge(body.challenge, body.code);
  return startMobileSession(user, req, body.device, body.installId, "mobile app + 2FA");
});
