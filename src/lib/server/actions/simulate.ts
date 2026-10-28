import "server-only";
import type { SimulateRequest, SimulatedAction } from "@/lib/domain/contracts/actions";
import type { RequestContext } from "../context";
import { AppError, notFound } from "../http/errors";
import { readOnlyAlternatives } from "./alternatives";
export async function simulateAction(ctx: RequestContext, input: SimulateRequest): Promise<never> {
    const dims = await ctx.source.getDims(ctx.accountId);
    throw new AppError("READ_ONLY_LIVE", "This dashboard is read-only for Google Ads", readOnlyAlternatives(ctx.accountId, dims.campaigns, input, ctx.account.currency, dims.adGroups));
}
export async function listActions(_ctx: RequestContext): Promise<SimulatedAction[]> {
    return [];
}
export async function revertAction(_ctx: RequestContext, _id: string): Promise<never> {
    throw notFound("Simulated action");
}
