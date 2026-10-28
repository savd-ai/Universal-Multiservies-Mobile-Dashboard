import "server-only";
import type { AccountInfo } from "@/lib/domain/types";
import { mask } from "../env/status";
import { log } from "../log";
import type { GoogleAdsClient } from "./client";
import { asGoogleAdsError, GoogleAdsApiError } from "./errors";
import { toCustomerClient, toCustomerInfo, type CustomerInfo } from "./mappers";
import { customerClientsQuery, customerQuery } from "./queries";
export interface AccountDirectory {
    accounts: AccountInfo[];
    manager: {
        id: string;
        name: string;
    } | null;
    degraded?: boolean;
}
export const MAX_DIRECT_ACCOUNTS = 20;
export async function fetchCustomer(client: GoogleAdsClient, customerId: string): Promise<CustomerInfo> {
    const rows = await client.search(customerId, customerQuery(), "customer");
    const info = rows.map(toCustomerInfo).find((c): c is CustomerInfo => c !== null);
    if (!info)
        throw new GoogleAdsApiError({ code: "CUSTOMER_NOT_FOUND", message: `No customer row returned for ${mask(customerId, false)}`, httpStatus: 200, category: "authenticationError" });
    return info;
}
const toAccount = (c: CustomerInfo, parentId?: string): AccountInfo => ({
    id: c.id,
    name: c.name,
    currency: c.currency,
    timezone: c.timezone,
    isManager: false,
    parentId,
    mode: "live",
});
function ordered(accounts: AccountInfo[], defaultId: string): AccountInfo[] {
    const unique = [...new Map(accounts.map((a) => [a.id, a])).values()];
    return unique.sort((a, b) => (a.id === defaultId ? -1 : b.id === defaultId ? 1 : a.name.localeCompare(b.name)));
}
async function managerDirectory(client: GoogleAdsClient, defaultId: string, managerId: string): Promise<AccountDirectory> {
    const rows = await client.search(managerId, customerClientsQuery(), "customer_client");
    const clients = rows.map(toCustomerClient).filter((c) => c !== null);
    const self = clients.find((c) => c.level === 0);
    const accounts = clients.filter((c) => c.level === 1 && !c.isManager && !c.hidden && c.status === "ENABLED").map((c) => toAccount(c, managerId));
    if (self && !self.isManager)
        accounts.push(toAccount(self));
    if (!accounts.some((a) => a.id === defaultId)) {
        try {
            const own = await fetchCustomer(client, defaultId);
            if (!own.isManager)
                accounts.push(toAccount(own, managerId));
        }
        catch (err) {
            log.warn("Default Google Ads account is not reachable through the manager", { code: asGoogleAdsError(err).code });
        }
    }
    const manager = !self || self.isManager ? { id: managerId, name: self?.name ?? managerId } : null;
    return { accounts: ordered(accounts, defaultId), manager };
}
async function directDirectory(client: GoogleAdsClient, defaultId: string): Promise<AccountDirectory> {
    const ids = (await client.listAccessibleCustomers()).filter((id) => id !== defaultId).slice(0, MAX_DIRECT_ACCOUNTS - 1);
    const [own, ...others] = await Promise.all([
        fetchCustomer(client, defaultId),
        ...ids.map((id) => fetchCustomer(client, id).catch((err: unknown) => {
            log.debug("Skipping inaccessible Google Ads account", { customer: mask(id, false), code: asGoogleAdsError(err).code });
            return null;
        })),
    ]);
    const infos = [own, ...others].filter((c): c is CustomerInfo => c !== null && !c.isManager);
    return { accounts: ordered(infos.map((c) => toAccount(c)), defaultId), manager: null };
}
export async function loadAccountDirectory(client: GoogleAdsClient, opts: {
    defaultId: string;
    loginCustomerId?: string;
}): Promise<AccountDirectory> {
    try {
        return opts.loginCustomerId ? await managerDirectory(client, opts.defaultId, opts.loginCustomerId) : await directDirectory(client, opts.defaultId);
    }
    catch (err) {
        log.warn("Google Ads account list unavailable; using the default account only", { code: asGoogleAdsError(err).code });
        const own = await fetchCustomer(client, opts.defaultId);
        if (own.isManager)
            throw err;
        return { accounts: [toAccount(own, opts.loginCustomerId)], manager: opts.loginCustomerId ? { id: opts.loginCustomerId, name: opts.loginCustomerId } : null, degraded: true };
    }
}
