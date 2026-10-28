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
const options: AccountInfo = { id: "", name: "No account connected", currency: "USD", timezone: "UTC", isManager: false, mode: "blank" };
export async function metricRegistry(): Promise<MetricRegistry> {
    const custom = await getStore().customMetrics.list();
    return new MetricRegistry(custom.map((c) => ({ key: c.key, label: c.label, formula: c.formula, format: c.format, direction: c.direction, description: c.description })));
}
export async function requestContext(req?: Request, accountOverride?: string, opts: {
    preferred?: string;
} = {}): Promise<RequestContext> {
    const principal = currentPrincipal();
    const resolved = await resolveGoogleAds();
    const source = resolved.source;
    const [listed, legacy, clients] = await Promise.all([source.listAccounts(), getWorkspaceStore(AGENCY_WORKSPACE).settings.get(), listClientRecords()]);
    const accounts = accountsVisibleTo(principal, clients, listed);
    if (!accounts.length) {
        if (!isAgencyRole(principal.role))
            throw new AppError("FORBIDDEN", "No Google Ads account is assigned to your organization yet. Ask your SAVD contact to assign one.");
        setScopeWorkspace(AGENCY_WORKSPACE);
        return { resolved, source, accountId: "", account: options, accounts: [], today: accountToday("UTC"), dataThrough: accountYesterday("UTC"), registry: await metricRegistry() };
    }
    const asked = requestedAccount(req);
    const explicit = accountOverride ?? (asked?.explicit ? asked.id : undefined);
    if (explicit && !accounts.some((a) => a.id === explicit))
        throw new AppError("FORBIDDEN", "You don't have access to that Google Ads account");
    const wanted = explicit ?? opts.preferred ?? asked?.id ?? (await lastAccountOf(principal)) ?? legacy.activeAccountId ?? source.defaultAccountId();
    const account = accounts.find((a) => a.id === wanted) ?? accounts.find((a) => a.id === source.defaultAccountId()) ?? accounts[0]!;
    setScopeWorkspace(workspaceFor(principal, clients, account.id));
    const [today, dataThrough, registry] = await Promise.all([source.today(account.id), source.dataThrough(account.id), metricRegistry()]);
    return { resolved, source, accountId: account.id, account, accounts, today, dataThrough, registry };
}
