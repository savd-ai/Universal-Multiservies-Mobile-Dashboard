import "server-only";
import { randomUUID } from "node:crypto";
import type { MobileDeviceInfo } from "@/lib/domain/contracts/history";
import type { MobileLoginResponse } from "@/lib/domain/contracts/mobile";
import { tokenHash } from "../auth/crypto";
import type { UserRecord } from "../auth/records";
import { bearerToken, createSession, revokeSession } from "../auth/sessions";
import { recordLogin } from "../auth/users";
import { now } from "../clock";
import { getHistory } from "../history";
import { log } from "../log";

/**
 * Phone sessions are ordinary sessions (same store, revocable from Account → Sessions) with method "mobile" and
 * longer limits (AUTH_MOBILE_*). The token goes back in the body and the app sends it as `Authorization: Bearer`,
 * so there is no cookie to steal cross-site. The device is recorded in the history database for notifications.
 */
export async function startMobileSession(user: UserRecord, req: Request, device: MobileDeviceInfo, installId: string | undefined, how: string): Promise<Extract<MobileLoginResponse, { ok: true }>> {
  const { token, session } = await createSession(user, req, "mobile");
  await recordLogin(user, how);
  let deviceId: string | null = null;
  const history = getHistory();
  if (history) {
    try {
      // Reuse the install's device row only when it belongs to the same person.
      const existing = installId ? history.device(installId) : null;
      const id = installId && (!existing || existing.userId === user.id) ? installId : randomUUID();
      deviceId = history.registerDevice({ id, userId: user.id, sessionId: session.id, info: device, at: now().toISOString() }).id;
    } catch (error) {
      log.warn("Could not record the mobile device", { error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { ok: true, token, expiresAt: session.expiresAt, deviceId, user: { name: user.name, email: user.email, role: user.role } };
}

export async function endMobileSession(req: Request): Promise<boolean> {
  const token = bearerToken(req.headers.get("authorization"));
  if (!token) return false;
  const sessionId = tokenHash(token);
  await revokeSession(sessionId);
  try {
    getHistory()?.signOutSession(sessionId, now().toISOString());
  } catch (error) {
    log.warn("Could not mark the mobile device signed out", { error: error instanceof Error ? error.message : String(error) });
  }
  return true;
}
