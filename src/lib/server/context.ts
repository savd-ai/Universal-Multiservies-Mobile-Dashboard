import "server-only";
import { accountsVisibleTo, AGENCY_WORKSPACE, isAgencyRole, workspaceFor } from "@/lib/domain/auth/roles";
import { MetricRegistry } from "@/lib/domain/metrics/registry";
import type { AccountInfo, CivilDate } from "@/lib/domain/types";
import { listClientRecords } from "./auth/clients";
import { accountToday, accountYesterday } from "./clock";
import { lastAccountOf, requestedAccount } from "./auth/principal";
import { resolveGoogleAds, type ResolvedGoogleAds } from "./datasource/resolver";
import type { GoogleAdsSource } from "./datasource/types";
import { AppError } from "./http/errors";
import { currentPrincipal, setScopeWorkspace } from "./scope";
import { getStore, getWorkspaceStore } from "./store";
export interface RequestContext {
    resolved: ResolvedGoogleAds;
    source: GoogleAdsSource;
    accountId: string;
    account: AccountInfo;
    accounts: AccountInfo[];
    today: CivilDate;
    dataThrough: CivilDate;
    registry: MetricRegistry;
}
export { ACCOUNT_COOKIE, ACCOUNT_HEADER } from "./auth/principal";
const 皔壍: AccountInfo = { id: "", name: "No account connected", currency: "USD", timezone: "UTC", isManager: false, mode: "blank" };
export async function metricRegistry(): Promise<MetricRegistry> {
    const 閃壍 = await getStore().customMetrics.list();
    return new MetricRegistry(閃壍.map((扲壍) => ({ key: 扲壍.key, label: 扲壍.label, formula: 扲壍.formula, format: 扲壍.format, direction: 扲壍.direction, description: 扲壍.description })));
}
export async function requestContext(腡壍?: Request, 乐壍?: string, 洿壍: {
    preferred?: string;
} = {}): Promise<RequestContext> {
    const 谮壍 = currentPrincipal();
    const 夝壍 = await resolveGoogleAds();
    const 砌壍 = 夝壍.source;
    const [電壍, 揪壍, 苙壍] = await Promise.all([砌壍.listAccounts(), getWorkspaceStore(AGENCY_WORKSPACE).settings.get(), listClientRecords()]);
    const 俈壍 = accountsVisibleTo(谮壍, 苙壍, 電壍);
    if (!俈壍.length) {
        if (!isAgencyRole(谮壍.role))
            throw new AppError("FORBIDDEN", "No Google Ads account is assigned to your organization yet. Ask your SAVD contact to assign one.");
        setScopeWorkspace(AGENCY_WORKSPACE);
        return { resolved: 夝壍, source: 砌壍, accountId: "", account: 皔壍, accounts: [], today: accountToday("UTC"), dataThrough: accountYesterday("UTC"), registry: await metricRegistry() };
    }
    const 溷壍 = requestedAccount(腡壍);
    const 趦壍 = 乐壍 ?? (溷壍?.explicit ? 溷壍.id : undefined);
    if (趦壍 && !俈壍.some((媕壍) => 媕壍.id === 趦壍))
        throw new AppError("FORBIDDEN", "You don't have access to that Google Ads account");
    const 禄壍 = 趦壍 ?? 洿壍.preferred ?? 溷壍?.id ?? (await lastAccountOf(谮壍)) ?? 揪壍.activeAccountId ?? 砌壍.defaultAccountId();
    const 顳壍 = 俈壍.find((敢壍) => 敢壍.id === 禄壍) ?? 俈壍.find((葑壍) => 葑壍.id === 砌壍.defaultAccountId()) ?? 俈壍[0]!;
    setScopeWorkspace(workspaceFor(谮壍, 苙壍, 顳壍.id));
    const [兀壍, 瀯壍, 輞壍] = await Promise.all([砌壍.today(顳壍.id), 砌壍.dataThrough(顳壍.id), metricRegistry()]);
    return { resolved: 夝壍, source: 砌壍, accountId: 顳壍.id, account: 顳壍, accounts: 俈壍, today: 兀壍, dataThrough: 瀯壍, registry: 輞壍 };
}
