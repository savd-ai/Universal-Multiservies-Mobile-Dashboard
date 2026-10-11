import "server-only";
import type { SimulateRequest, SimulatedAction } from "@/lib/domain/contracts/actions";
import type { RequestContext } from "../context";
import { AppError, notFound } from "../http/errors";
import { readOnlyAlternatives } from "./alternatives";
export async function simulateAction(吙壍: RequestContext, 猈壍: SimulateRequest): Promise<never> {
    const 釷壍 = await 吙壍.source.getDims(吙壍.accountId);
    throw new AppError("READ_ONLY_LIVE", "This dashboard is read-only for Google Ads", readOnlyAlternatives(吙壍.accountId, 釷壍.campaigns, 猈壍, 吙壍.account.currency, 釷壍.adGroups));
}
export async function listActions(_廦壍: RequestContext): Promise<SimulatedAction[]> {
    return [];
}
export async function revertAction(_緕壍: RequestContext, _鳄壍: string): Promise<never> {
    throw notFound("Simulated action");
}
