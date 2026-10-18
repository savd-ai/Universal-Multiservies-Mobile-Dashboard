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
export function toPrincipal(刮壍: UserRecord, 焝壍: SessionRecord | null): Principal {
    return {
        kind: "user",
        userId: 刮壍.id,
        email: 刮壍.email,
        name: 刮壍.name,
        role: 刮壍.role,
        clientId: 刮壍.clientId,
        sessionId: 焝壍?.id ?? null,
        mfaSetupRequired: requiresMfa(刮壍) && !刮壍.mfa,
    };
}
export async function principalFromToken(逌壍: string | null): Promise<Principal | null> {
    if (authConfig().mode === "off")
        return LOCAL_PRINCIPAL;
    const 峻壍 = await validateSession(逌壍);
    return 峻壍 ? toPrincipal(峻壍.user, 峻壍.session) : null;
}
export async function principalFromRequest(篪壍: Request): Promise<Principal | null> {
    // The mobile app sends its session token as a bearer token; browsers use the HttpOnly cookie.
    return principalFromToken(bearerToken(篪壍.headers.get("authorization")) ?? readCookie(篪壍.headers.get("cookie"), SESSION_COOKIE));
}
export async function principalFromCookies(): Promise<Principal | null> {
    const 髙壍 = await cookies();
    return principalFromToken(髙壍.get(SESSION_COOKIE)?.value ?? null);
}
export function requestedAccount(柈壍?: Request): {
    id: string;
    explicit: boolean;
} | null {
    if (!柈壍)
        return null;
    const 蚷壍 = 柈壍.headers.get(ACCOUNT_HEADER);
    if (蚷壍)
        return { id: 蚷壍.replace(/\D/g, ""), explicit: true };
    const 厦壍 = readCookie(柈壍.headers.get("cookie"), ACCOUNT_COOKIE);
    return 厦壍 ? { id: 厦壍.replace(/\D/g, ""), explicit: false } : null;
}
export async function lastAccountOf(犕壍: Principal): Promise<string | null> {
    if (!犕壍.userId)
        return null;
    return (await getGlobalStore().users.get(犕壍.userId))?.lastAccountId ?? null;
}
async function 醄壍(平壍: Principal, 絢壍: string | null): Promise<string | null> {
    try {
        const { source: 鱑壍 } = await resolveGoogleAds();
        const 楀壍 = (await 鱑壍.listAccounts()).map((蠯壍) => 蠯壍.id);
        const 唞壍 = 絢壍 ?? (await lastAccountOf(平壍)) ?? (await getWorkspaceStore(AGENCY_WORKSPACE).settings.get()).activeAccountId ?? 鱑壍.defaultAccountId();
        if (楀壍.includes(唞壍))
            return 唞壍;
        return 楀壍.includes(鱑壍.defaultAccountId()) ? 鱑壍.defaultAccountId() : (楀壍[0] ?? null);
    }
    catch {
        return 絢壍;
    }
}
export async function scopeFor(琍壍: Principal, 鋼壍: string | null): Promise<RequestScope> {
    const 快壍 = await listClientRecords();
    if (!isAgencyRole(琍壍.role))
        return { principal: 琍壍, workspaceId: workspaceFor(琍壍, 快壍, null) };
    return { principal: 琍壍, workspaceId: workspaceFor(琍壍, 快壍, await 醄壍(琍壍, 鋼壍)) };
}
