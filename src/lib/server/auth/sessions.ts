import "server-only";
import type { SessionView } from "@/lib/domain/contracts/auth";
import { now } from "../clock";
import { appConfig, authConfig } from "../env/config";
import { getGlobalStore } from "../store";
import { newToken, tokenHash } from "./crypto";
import type { SessionRecord, UserRecord } from "./records";
export const SESSION_COOKIE = "savd-session";
const TOUCH_EVERY_MS = 5 * 60000;
/** Session limits in ms: mobile app sessions (bearer tokens) live longer than browser cookies, see AUTH_MOBILE_*. */
function lifetimes(method: SessionRecord["method"]): { maxMs: number; idleMs: number } {
    const config = authConfig();
    return method === "mobile"
        ? { maxMs: config.mobileSessionDays * 86400000, idleMs: config.mobileIdleDays * 86400000 }
        : { maxMs: config.sessionDays * 86400000, idleMs: config.idleHours * 3600000 };
}
export function bearerToken(header: string | null | undefined): string | null {
    const match = /^Bearer\s+([A-Za-z0-9_-]{20,128})\s*$/.exec(header ?? "");
    return match?.[1] ?? null;
}
export function readCookie(header: string | null | undefined, name: string): string | null {
    if (!header)
        return null;
    const m = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(header);
    if (!m?.[1])
        return null;
    try {
        return decodeURIComponent(m[1]);
    }
    catch {
        return null;
    }
}
export function isSecureRequest(req?: Request): boolean {
    if (req) {
        const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
        if (proto)
            return proto === "https";
        if (new URL(req.url).protocol === "https:")
            return true;
    }
    return appConfig().baseUrl.startsWith("https:");
}
export const MFA_COOKIE = "savd-mfa";
export const MFA_COOKIE_PATH = "/api/auth/login/mfa";
export function cookieHeader(name: string, value: string, opts: {
    maxAgeSec: number;
    secure: boolean;
    path?: string;
}): string {
    return [`${name}=${encodeURIComponent(value)}`, `Path=${opts.path ?? "/"}`, "HttpOnly", "SameSite=Lax", `Max-Age=${Math.max(0, Math.floor(opts.maxAgeSec))}`, ...(opts.secure ? ["Secure"] : [])].join("; ");
}
export function clearCookieHeader(name: string, secure: boolean, path = "/"): string {
    return cookieHeader(name, "", { maxAgeSec: 0, secure, path });
}
export function clientInfo(req: Request): {
    ip: string;
    userAgent: string;
} {
    const fwd = appConfig().trustProxy ? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() : undefined;
    return { ip: (fwd || req.headers.get("x-real-ip") || "local").slice(0, 64), userAgent: (req.headers.get("user-agent") ?? "").slice(0, 200) };
}
export async function createSession(user: UserRecord, req: Request, method: SessionRecord["method"]): Promise<{
    token: string;
    cookie: string;
    session: SessionRecord;
}> {
    const cfg = lifetimes(method);
    const t = now().getTime();
    await pruneSessions(t);
    const token = newToken();
    const { ip, userAgent } = clientInfo(req);
    const session = await getGlobalStore().sessions.create({
        id: tokenHash(token),
        userId: user.id,
        expiresAt: new Date(t + cfg.maxMs).toISOString(),
        idleExpiresAt: new Date(t + cfg.idleMs).toISOString(),
        lastSeenAt: new Date(t).toISOString(),
        ip,
        userAgent,
        method,
    });
    return { token, session, cookie: cookieHeader(SESSION_COOKIE, token, { maxAgeSec: cfg.maxMs / 1000, secure: isSecureRequest(req) }) };
}
export async function validateSession(token: string | null): Promise<{
    session: SessionRecord;
    user: UserRecord;
} | null> {
    if (!token || token.length < 20 || token.length > 128)
        return null;
    const store = getGlobalStore();
    const session = await store.sessions.get(tokenHash(token));
    if (!session)
        return null;
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
        const idle = Math.min(Date.parse(session.expiresAt), t + lifetimes(session.method).idleMs);
        const touched = await store.sessions.update(session.id, { lastSeenAt: new Date(t).toISOString(), idleExpiresAt: new Date(idle).toISOString() }).catch(() => session);
        return { session: touched, user };
    }
    return { session, user };
}
export async function revokeSession(id: string): Promise<void> {
    await getGlobalStore().sessions.delete(id);
}
export async function revokeUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
    const store = getGlobalStore();
    const mine = await store.sessions.list((s) => s.userId === userId && s.id !== exceptSessionId);
    for (const s of mine)
        await store.sessions.delete(s.id);
    return mine.length;
}
async function pruneSessions(t: number): Promise<void> {
    const store = getGlobalStore();
    const dead = await store.sessions.list((s) => Date.parse(s.expiresAt) <= t || Date.parse(s.idleExpiresAt) <= t);
    for (const s of dead)
        await store.sessions.delete(s.id);
}
export async function listUserSessions(userId: string, currentId: string | null): Promise<SessionView[]> {
    const t = now().getTime();
    const rows = await getGlobalStore().sessions.list((s) => s.userId === userId && Date.parse(s.expiresAt) > t && Date.parse(s.idleExpiresAt) > t);
    return rows
        .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
        .map((s) => ({ id: s.id.slice(0, 16), current: s.id === currentId, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, expiresAt: s.expiresAt, userAgent: s.userAgent, ip: s.ip, method: s.method }));
}
export async function revokeSessionByPrefix(userId: string, prefix: string): Promise<boolean> {
    if (!/^[0-9a-f]{16}$/.test(prefix))
        return false;
    const store = getGlobalStore();
    const hit = (await store.sessions.list((s) => s.userId === userId && s.id.startsWith(prefix)))[0];
    if (!hit)
        return false;
    await store.sessions.delete(hit.id);
    return true;
}
