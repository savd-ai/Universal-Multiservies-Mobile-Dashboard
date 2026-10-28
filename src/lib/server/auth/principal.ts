import "server-only";
import { cookies } from "next/headers";
import { AGENCY_WORKSPACE, isAgencyRole, workspaceFor } from "@/lib/domain/auth/roles";
import { resolveGoogleAds } from "../datasource/resolver";
import { authConfig } from "../env/config";
import { LOCAL_PRINCIPAL, type Principal, type RequestScope } from "../scope";
import { getGlobalStore, getWorkspaceStore } from "../store";
import { listClientRecords } from "./clients";
import type { SessionRecord, UserRecord } from "./records";
import { bearerToken, readCookie, SESSION_COOKIE, validateSession } from "./sessions";
import { requiresMfa } from "./users";
export const ACCOUNT_HEADER = "x-savd-account";
export const ACCOUNT_COOKIE = "savd-acct";
export function toPrincipal(user: UserRecord, session: SessionRecord | null): Principal {
    return {
        kind: "user",
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        clientId: user.clientId,
        sessionId: session?.id ?? null,
        mfaSetupRequired: requiresMfa(user) && !user.mfa,
    };
}
export async function principalFromToken(token: string | null): Promise<Principal | null> {
    if (authConfig().mode === "off")
        return LOCAL_PRINCIPAL;
    const hit = await validateSession(token);
    return hit ? toPrincipal(hit.user, hit.session) : null;
}
export async function principalFromRequest(req: Request): Promise<Principal | null> {
    // The mobile app sends its session token as a bearer token; browsers use the HttpOnly cookie.
    return principalFromToken(bearerToken(req.headers.get("authorization")) ?? readCookie(req.headers.get("cookie"), SESSION_COOKIE));
}
export async function principalFromCookies(): Promise<Principal | null> {
    const jar = await cookies();
    return principalFromToken(jar.get(SESSION_COOKIE)?.value ?? null);
}
export function requestedAccount(req?: Request): {
    id: string;
    explicit: boolean;
} | null {
    if (!req)
        return null;
    const h = req.headers.get(ACCOUNT_HEADER);
    if (h)
        return { id: h.replace(/\D/g, ""), explicit: true };
    const c = readCookie(req.headers.get("cookie"), ACCOUNT_COOKIE);
    return c ? { id: c.replace(/\D/g, ""), explicit: false } : null;
}
export async function lastAccountOf(principal: Principal): Promise<string | null> {
    if (!principal.userId)
        return null;
    return (await getGlobalStore().users.get(principal.userId))?.lastAccountId ?? null;
}
async function likelyAccount(principal: Principal, hint: string | null): Promise<string | null> {
    try {
        const { source } = await resolveGoogleAds();
        const listed = (await source.listAccounts()).map((a) => a.id);
        const wanted = hint ?? (await lastAccountOf(principal)) ?? (await getWorkspaceStore(AGENCY_WORKSPACE).settings.get()).activeAccountId ?? source.defaultAccountId();
        if (listed.includes(wanted))
            return wanted;
        return listed.includes(source.defaultAccountId()) ? source.defaultAccountId() : (listed[0] ?? null);
    }
    catch {
        return hint;
    }
}
export async function scopeFor(principal: Principal, accountHint: string | null): Promise<RequestScope> {
    const clients = await listClientRecords();
    if (!isAgencyRole(principal.role))
        return { principal, workspaceId: workspaceFor(principal, clients, null) };
    return { principal, workspaceId: workspaceFor(principal, clients, await likelyAccount(principal, accountHint)) };
}
