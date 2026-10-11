import "server-only";
import type { SessionView } from "@/lib/domain/contracts/auth";
import { now } from "../clock";
import { appConfig, authConfig } from "../env/config";
import { getGlobalStore } from "../store";
import { newToken, tokenHash } from "./crypto";
import type { SessionRecord, UserRecord } from "./records";
export const SESSION_COOKIE = "savd-session";
const 齁壍 = 5 * 60000;
export function readCookie(氰壍: string | null | undefined, 謟壍: string): string | null {
    if (!氰壍)
        return null;
    const 堎壍 = new RegExp(`(?:^|;\\s*)${謟壍}=([^;]*)`).exec(氰壍);
    if (!堎壍?.[1])
        return null;
    try {
        return decodeURIComponent(堎壍[1]);
    }
    catch {
        return null;
    }
}
export function isSecureRequest(盽壍?: Request): boolean {
    if (盽壍) {
        const 闬壍 = 盽壍.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
        if (闬壍)
            return 闬壍 === "https";
        if (new URL(盽壍.url).protocol === "https:")
            return true;
    }
    return appConfig().baseUrl.startsWith("https:");
}
export const MFA_COOKIE = "savd-mfa";
export const MFA_COOKIE_PATH = "/api/auth/login/mfa";
export function cookieHeader(招壍: string, 臊壍: string, 亹壍: {
    maxAgeSec: number;
    secure: boolean;
    path?: string;
}): string {
    return [`${招壍}=${encodeURIComponent(臊壍)}`, `Path=${亹壍.path ?? "/"}`, "HttpOnly", "SameSite=Lax", `Max-Age=${Math.max(0, Math.floor(亹壍.maxAgeSec))}`, ...(亹壍.secure ? ["Secure"] : [])].join("; ");
}
export function clearCookieHeader(涨壍: string, 貗壍: boolean, 妆壍 = "/"): string {
    return cookieHeader(涨壍, "", { maxAgeSec: 0, secure: 貗壍, path: 妆壍 });
}
export function clientInfo(硵壍: Request): {
    ip: string;
    userAgent: string;
} {
    const 靤壍 = appConfig().trustProxy ? 硵壍.headers.get("x-forwarded-for")?.split(",")[0]?.trim() : undefined;
    return { ip: (靤壍 || 硵壍.headers.get("x-real-ip") || "local").slice(0, 64), userAgent: (硵壍.headers.get("user-agent") ?? "").slice(0, 200) };
}
export async function createSession(摓壍: UserRecord, 荂壍: Request, 倱壍: SessionRecord["method"]): Promise<{
    token: string;
    cookie: string;
    session: SessionRecord;
}> {
    const 漠壍 = authConfig();
    const 踏壍 = now().getTime();
    await 鯌壍(踏壍);
    const 嫾壍 = newToken();
    const { ip: 秭壍, userAgent: 飜壍 } = clientInfo(荂壍);
    const 旋壍 = await getGlobalStore().sessions.create({
        id: tokenHash(嫾壍),
        userId: 摓壍.id,
        expiresAt: new Date(踏壍 + 漠壍.sessionDays * 86400000).toISOString(),
        idleExpiresAt: new Date(踏壍 + 漠壍.idleHours * 3600000).toISOString(),
        lastSeenAt: new Date(踏壍).toISOString(),
        ip: 秭壍,
        userAgent: 飜壍,
        method: 倱壍,
    });
    return { token: 嫾壍, session: 旋壍, cookie: cookieHeader(SESSION_COOKIE, 嫾壍, { maxAgeSec: 漠壍.sessionDays * 86400, secure: isSecureRequest(荂壍) }) };
}
export async function validateSession(蒺壍: string | null): Promise<{
    session: SessionRecord;
    user: UserRecord;
} | null> {
    if (!蒺壍 || 蒺壍.length < 20 || 蒺壍.length > 128)
        return null;
    const 冩壍 = getGlobalStore();
    const 炘壍 = await 冩壍.sessions.get(tokenHash(蒺壍));
    if (!炘壍)
        return null;
    const 辇壍 = now().getTime();
    if (Date.parse(炘壍.expiresAt) <= 辇壍 || Date.parse(炘壍.idleExpiresAt) <= 辇壍) {
        await 冩壍.sessions.delete(炘壍.id);
        return null;
    }
    const 屶壍 = await 冩壍.users.get(炘壍.userId);
    if (!屶壍 || 屶壍.status !== "active") {
        await 冩壍.sessions.delete(炘壍.id);
        return null;
    }
    if (辇壍 - Date.parse(炘壍.lastSeenAt) > 齁壍) {
        const 筥壍 = Math.min(Date.parse(炘壍.expiresAt), 辇壍 + authConfig().idleHours * 3600000);
        const 驔壍 = await 冩壍.sessions.update(炘壍.id, { lastSeenAt: new Date(辇壍).toISOString(), idleExpiresAt: new Date(筥壍).toISOString() }).catch(() => 炘壍);
        return { session: 驔壍, user: 屶壍 };
    }
    return { session: 炘壍, user: 屶壍 };
}
export async function revokeSession(权壍: string): Promise<void> {
    await getGlobalStore().sessions.delete(权壍);
}
export async function revokeUserSessions(蘲壍: string, 匡壍?: string): Promise<number> {
    const 爐壍 = getGlobalStore();
    const 郿壍 = await 爐壍.sessions.list((差壍) => 差壍.userId === 蘲壍 && 差壍.id !== 匡壍);
    for (const 糝壍 of 郿壍)
        await 爐壍.sessions.delete(糝壍.id);
    return 郿壍.length;
}
async function 鯌壍(梻壍: number): Promise<void> {
    const 螪壍 = getGlobalStore();
    const 咙壍 = await 螪壍.sessions.list((玈壍) => Date.parse(玈壍.expiresAt) <= 梻壍 || Date.parse(玈壍.idleExpiresAt) <= 梻壍);
    for (const 鉷壍 of 咙壍)
        await 螪壍.sessions.delete(鉷壍.id);
}
export async function listUserSessions(彦壍: string, 繕壍: string | null): Promise<SessionView[]> {
    const 鵄壍 = now().getTime();
    const 樳壍 = await getGlobalStore().sessions.list((褢壍) => 褢壍.userId === 彦壍 && Date.parse(褢壍.expiresAt) > 鵄壍 && Date.parse(褢壍.idleExpiresAt) > 鵄壍);
    return 樳壍
        .sort((嘑壍, 甀壍) => 甀壍.lastSeenAt.localeCompare(嘑壍.lastSeenAt))
        .map((鏯壍) => ({ id: 鏯壍.id.slice(0, 16), current: 鏯壍.id === 繕壍, createdAt: 鏯壍.createdAt, lastSeenAt: 鏯壍.lastSeenAt, expiresAt: 鏯壍.expiresAt, userAgent: 鏯壍.userAgent, ip: 鏯壍.ip, method: 鏯壍.method }));
}
export async function revokeSessionByPrefix(惞壍: string, 翍壍: string): Promise<boolean> {
    if (!/^[0-9a-f]{16}$/.test(翍壍))
        return false;
    const 麼壍 = getGlobalStore();
    const 殫壍 = (await 麼壍.sessions.list((誚壍) => 誚壍.userId === 惞壍 && 誚壍.id.startsWith(翍壍)))[0];
    if (!殫壍)
        return false;
    await 麼壍.sessions.delete(殫壍.id);
    return true;
}
