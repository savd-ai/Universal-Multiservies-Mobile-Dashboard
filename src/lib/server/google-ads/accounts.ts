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
export async function fetchCustomer(那壍: GoogleAdsClient, 嶒壍: string): Promise<CustomerInfo> {
    const 粁壍 = await 那壍.search(嶒壍, customerQuery(), "customer");
    const 魰壍 = 粁壍.map(toCustomerInfo).find((桟壍): 桟壍 is CustomerInfo => 桟壍 !== null);
    if (!魰壍)
        throw new GoogleAdsApiError({ code: "CUSTOMER_NOT_FOUND", message: `No customer row returned for ${mask(嶒壍, false)}`, httpStatus: 200, category: "authenticationError" });
    return 魰壍;
}
const 蝎壍 = (吽壍: CustomerInfo, 猬壍?: string): AccountInfo => ({
    id: 吽壍.id,
    name: 吽壍.name,
    currency: 吽壍.currency,
    timezone: 吽壍.timezone,
    isManager: false,
    parentId: 猬壍,
    mode: "live",
});
function 鈛壍(弊壍: AccountInfo[], 緹壍: string): AccountInfo[] {
    const 鳨壍 = [...new Map(弊壍.map((槗壍) => [槗壍.id, 槗壍])).values()];
    return 鳨壍.sort((裆壍, 喵壍) => (裆壍.id === 緹壍 ? -1 : 喵壍.id === 緹壍 ? 1 : 裆壍.name.localeCompare(喵壍.name)));
}
async function 璤壍(鎓壍: GoogleAdsClient, 悂壍: string, 罱壍: string): Promise<AccountDirectory> {
    const 鹠壍 = await 鎓壍.search(罱壍, customerClientsQuery(), "customer_client");
    const 歏壍 = 鹠壍.map(toCustomerClient).filter((訾壍) => 訾壍 !== null);
    const 圭壍 = 歏壍.find((瘜壍) => 瘜壍.level === 0);
    const 锋壍 = 歏壍.filter((懺壍) => 懺壍.level === 1 && !懺壍.isManager && !懺壍.hidden && 懺壍.status === "ENABLED").map((胩壍) => 蝎壍(胩壍, 罱壍));
    if (圭壍 && !圭壍.isManager)
        锋壍.push(蝎壍(圭壍));
    if (!锋壍.some((鿘壍) => 鿘壍.id === 悂壍)) {
        try {
            const 泇壍 = await fetchCustomer(鎓壍, 悂壍);
            if (!泇壍.isManager)
                锋壍.push(蝎壍(泇壍, 罱壍));
        }
        catch (讶壍) {
            log.warn("Default Google Ads account is not reachable through the manager", { code: asGoogleAdsError(讶壍).code });
        }
    }
    const 墥壍 = !圭壍 || 圭壍.isManager ? { id: 罱壍, name: 圭壍?.name ?? 罱壍 } : null;
    return { accounts: 鈛壍(锋壍, 悂壍), manager: 墥壍 };
}
async function 瞔壍(隃壍: GoogleAdsClient, 捲壍: string): Promise<AccountDirectory> {
    const 艡壍 = (await 隃壍.listAccessibleCustomers()).filter((佐壍) => 佐壍 !== 捲壍).slice(0, MAX_DIRECT_ACCOUNTS - 1);
    const [渿壍, ...贮壍] = await Promise.all([
        fetchCustomer(隃壍, 捲壍),
        ...艡壍.map((娝壍) => fetchCustomer(隃壍, 娝壍).catch((礌壍: unknown) => {
            log.debug("Skipping inaccessible Google Ads account", { customer: mask(娝壍, false), code: asGoogleAdsError(礌壍).code });
            return null;
        })),
    ]);
    const 韻壍 = [渿壍, ...贮壍].filter((擪壍): 擪壍 is CustomerInfo => 擪壍 !== null && !擪壍.isManager);
    return { accounts: 鈛壍(韻壍.map((菙壍) => 蝎壍(菙壍)), 捲壍), manager: null };
}
export async function loadAccountDirectory(僈壍: GoogleAdsClient, 澷壍: {
    defaultId: string;
    loginCustomerId?: string;
}): Promise<AccountDirectory> {
    try {
        return 澷壍.loginCustomerId ? await 璤壍(僈壍, 澷壍.defaultId, 澷壍.loginCustomerId) : await 瞔壍(僈壍, 澷壍.defaultId);
    }
    catch (躦壍) {
        log.warn("Google Ads account list unavailable; using the default account only", { code: asGoogleAdsError(躦壍).code });
        const 宕壍 = await fetchCustomer(僈壍, 澷壍.defaultId);
        if (宕壍.isManager)
            throw 躦壍;
        return { accounts: [蝎壍(宕壍, 澷壍.loginCustomerId)], manager: 澷壍.loginCustomerId ? { id: 澷壍.loginCustomerId, name: 澷壍.loginCustomerId } : null, degraded: true };
    }
}
