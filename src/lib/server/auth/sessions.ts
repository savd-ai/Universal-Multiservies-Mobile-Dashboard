import "server-only";
import type { SessionView } from "@/lib/domain/contracts/auth";
import { now } from "../clock";
import { appConfig, authConfig } from "../env/config";
import { getGlobalStore } from "../store";
import { newToken, tokenHash } from "./crypto";
import type { SessionRecord, UserRecord } from "./records";

// Database sessions: the cookie carries a random token, the store keeps only its SHA-256 (the record id), so a
// copied data directory can't be replayed. Absolute lifetime AUTH_SESSION_DAYS, idle timeout AUTH_IDLE_HOURS
// (refreshed at most every 5 minutes to keep writes rare). Cookies are HttpOnly, SameSite=Lax, Secure on https.

export const SESSION_COOKIE = "savd-session";
const TOUCH_EVERY_MS = 5 * 60_000;

export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(header);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

export function isSecureRequest(req?: Request): boolean {
  if (req) {
    const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (proto) return proto === "https";
    if (new URL(req.url).protocol === "https:") return true;
  }
  return appConfig().baseUrl.startsWith("https:");
}

/** The pending 2FA challenge after "Sign in with Google" (5 minutes, only sent to the 2FA endpoint). */
export const MFA_COOKIE = "savd-mfa";
export const MFA_COOKIE_PATH = "/api/auth/login/mfa";

export function cookieHeader(name: string, value: string, opts: { maxAgeSec: number; secure: boolean; path?: string }): string {
  return [`${name}=${encodeURIComponent(value)}`, `Path=${opts.path ?? "/"}`, "HttpOnly", "SameSite=Lax", `Max-Age=${Math.max(0, Math.floor(opts.maxAgeSec))}`, ...(opts.secure ? ["Secure"] : [])].join("; ");
}

export function clearCookieHeader(name: string, secure: boolean, path = "/"): string {
  return cookieHeader(name, "", { maxAgeSec: 0, secure, path });
}

export function clientInfo(req: Request): { ip: string; userAgent: string } {
  const fwd = appConfig().trustProxy ? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() : undefined;
  return { ip: (fwd || req.headers.get("x-real-ip") || "local").slice(0, 64), userAgent: (req.headers.get("user-agent") ?? "").slice(0, 200) };
}

export async function createSession(user: UserRecord, req: Request, method: SessionRecord["method"]): Promise<{ token: string; cookie: string; session: SessionRecord }> {
  const cfg = authConfig();
  const t = now().getTime();
  await pruneSessions(t);
  const token = newToken();
  const { ip, userAgent } = clientInfo(req);
  const session = await getGlobalStore().sessions.create({
    id: tokenHash(token),
    userId: user.id,
    expiresAt: new Date(t + cfg.sessionDays * 86_400_000).toISOString(),
    idleExpiresAt: new Date(t + cfg.idleHours * 3_600_000).toISOString(),
    lastSeenAt: new Date(t).toISOString(),
    ip,
    userAgent,
    method,
  });
  return { token, session, cookie: cookieHeader(SESSION_COOKIE, token, { maxAgeSec: cfg.sessionDays * 86_400, secure: isSecureRequest(req) }) };
}

/** The live session and its user for a cookie token, or null (expired, revoked, user disabled). */
export async function validateSession(token: string | null): Promise<{ session: SessionRecord; user: UserRecord } | null> {
  if (!token || token.length < 20 || token.length > 128) return null;
  const store = getGlobalStore();
  const session = await store.sessions.get(tokenHash(token));
  if (!session) return null;
  const t = now().getTime();
  if (Date.parse(session.expiresAt) <= t || Date.parse(session.idleExpiresAt) <= t) {
    await store.sessions.delete(session.id);
    return null;
  }
  const user = await store.users.get(session.userId);
  if (!user || user.status !== "active") {
    await store.sessions.delete(session.id);
    return null;
  }
  if (t - Date.parse(session.lastSeenAt) > TOUCH_EVERY_MS) {
    const idle = Math.min(Date.parse(session.expiresAt), t + authConfig().idleHours * 3_600_000);
    const touched = await store.sessions.update(session.id, { lastSeenAt: new Date(t).toISOString(), idleExpiresAt: new Date(idle).toISOString() }).catch(() => session);
    return { session: touched, user };
  }
  return { session, user };
}

export async function revokeSession(id: string): Promise<void> {
  await getGlobalStore().sessions.delete(id);
}

/** Sign a user out everywhere (password change, disable, role change), optionally keeping one session. */
export async function revokeUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const store = getGlobalStore();
  const mine = await store.sessions.list((s) => s.userId === userId && s.id !== exceptSessionId);
  for (const s of mine) await store.sessions.delete(s.id);
  return mine.length;
}

async function pruneSessions(t: number): Promise<void> {
  const store = getGlobalStore();
  const dead = await store.sessions.list((s) => Date.parse(s.expiresAt) <= t || Date.parse(s.idleExpiresAt) <= t);
  for (const s of dead) await store.sessions.delete(s.id);
}

export async function listUserSessions(userId: string, currentId: string | null): Promise<SessionView[]> {
  const t = now().getTime();
  const rows = await getGlobalStore().sessions.list((s) => s.userId === userId && Date.parse(s.expiresAt) > t && Date.parse(s.idleExpiresAt) > t);
  // the id is the token hash: expose only a short prefix so the list can't be used to rebuild anything
  return rows
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .map((s) => ({ id: s.id.slice(0, 16), current: s.id === currentId, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, expiresAt: s.expiresAt, userAgent: s.userAgent, ip: s.ip, method: s.method }));
}

export async function revokeSessionByPrefix(userId: string, prefix: string): Promise<boolean> {
  if (!/^[0-9a-f]{16}$/.test(prefix)) return false;
  const store = getGlobalStore();
  const hit = (await store.sessions.list((s) => s.userId === userId && s.id.startsWith(prefix)))[0];
  if (!hit) return false;
  await store.sessions.delete(hit.id);
  return true;
}
