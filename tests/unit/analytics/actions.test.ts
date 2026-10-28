import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReadOnlyAlternatives } from "@/lib/domain/contracts/actions";
import { MetricRegistry } from "@/lib/domain/metrics/registry";
import { emptyDims, type EntityDims } from "@/lib/domain/schema/facts";
import type { AccountInfo } from "@/lib/domain/types";
import { simulateAction } from "@/lib/server/actions/simulate";
import type { RequestContext } from "@/lib/server/context";
import type { GoogleAdsSource } from "@/lib/server/datasource/types";
import { errorResponse } from "@/lib/server/http/api";
import { AppError } from "@/lib/server/http/errors";
import { campaign, resetServerState, restoreServerState } from "./helpers";
function liveContext(): RequestContext {
    const dims: EntityDims = emptyDims();
    dims.campaigns.set("1234567890", campaign("1234567890", { name: "Brand — Core Terms", budget_daily: 420 }));
    dims.campaigns.set("2222222222", campaign("2222222222", { name: "Generic — Running Shoes", budget_daily: 780 }));
    dims.adGroups.set("555", { id: "555", campaign_id: "1234567890", name: "Brand — Exact", status: "Enabled" });
    const account: AccountInfo = { id: "9998887777", name: "Live account", currency: "USD", timezone: "America/New_York", isManager: false, mode: "live" };
    const unused = () => {
        throw new Error("not used");
    };
    const source: GoogleAdsSource = {
        mode: "live",
        reason: null,
        apiVersion: "v25",
        listAccounts: async () => [account],
        manager: async () => null,
        defaultAccountId: () => account.id,
        account: async () => account,
        today: async () => "2026-09-29",
        dataThrough: async () => "2026-09-28",
        getDims: async () => dims,
        getTable: unused,
        getChangeEvents: async () => [],
        getGoogleEstimates: async () => ({ simulations: [], recommendations: [], warnings: [] }),
        coverage: async () => null,
        invalidate: async () => undefined,
    };
    return { resolved: { source, health: null }, source, accountId: account.id, account, accounts: [account], today: "2026-09-29", dataThrough: "2026-09-28", registry: new MetricRegistry() };
}
async function readOnlyError(p: Promise<unknown>): Promise<AppError> {
    try {
        await p;
    }
    catch (err) {
        if (err instanceof AppError)
            return err;
        throw err;
    }
    throw new Error("expected READ_ONLY_LIVE");
}
describe("read-only guard (live mode)", () => {
    beforeEach(() => resetServerState());
    afterEach(() => restoreServerState());
    it("refuses to pause in live mode and offers deep links, a change list and an Editor CSV", async () => {
        const err = await readOnlyError(simulateAction(liveContext(), { type: "campaign.pause", campaignIds: ["1234567890"] }));
        expect(err.code).toBe("READ_ONLY_LIVE");
        expect(err.status).toBe(409);
        expect(err.message).toBe("This dashboard is read-only for Google Ads");
        const alt = err.details as ReadOnlyAlternatives;
        expect(alt.deepLinks[0]?.url).toContain("campaignId=1234567890");
        expect(alt.deepLinks[0]?.url).toContain("ocid=9998887777");
        expect(alt.changeList).toEqual(["Pause campaign 'Brand — Core Terms'"]);
        expect(alt.editorCsv.split("\r\n")[0]).toBe("Campaign,Campaign ID,Budget,Budget type,Campaign status");
        expect(alt.editorCsv).toContain("Brand — Core Terms,1234567890,420.00,Daily,Paused");
        const res = errorResponse(err, "req-1");
        expect(res.status).toBe(409);
        const body = (await res.json()) as {
            error: {
                code: string;
                details: ReadOnlyAlternatives;
            };
        };
        expect(body.error.code).toBe("READ_ONLY_LIVE");
        expect(body.error.details.changeList).toHaveLength(1);
    });
    it("budget and negative-keyword alternatives", async () => {
        const budget = await readOnlyError(simulateAction(liveContext(), { type: "campaign.set_budget", budgets: [{ campaignId: "1234567890", dailyBudget: 455 }] }));
        expect((budget.details as ReadOnlyAlternatives).changeList).toEqual(["Set daily budget of 'Brand — Core Terms' from $420.00 to $455.00 (+8.3%)"]);
        const negatives = await readOnlyError(simulateAction(liveContext(), { type: "keywords.add_negatives", negatives: [{ text: "free shoes", matchType: "Exact", campaignId: "1234567890", adGroupId: "555" }] }));
        const alt = negatives.details as ReadOnlyAlternatives;
        expect(alt.changeList[0]).toBe("Add negative keyword [free shoes] (Exact) to campaign 'Brand — Core Terms'");
        expect(alt.editorCsv).toContain("Brand — Core Terms,Brand — Exact,free shoes,Negative exact");
    });
});
