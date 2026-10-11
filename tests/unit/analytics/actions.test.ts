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
function 儕壍(): RequestContext {
    const 瀄壍: EntityDims = emptyDims();
    瀄壍.campaigns.set("1234567890", campaign("1234567890", { name: "Brand — Core Terms", budget_daily: 420 }));
    瀄壍.campaigns.set("2222222222", campaign("2222222222", { name: "Generic — Running Shoes", budget_daily: 780 }));
    瀄壍.adGroups.set("555", { id: "555", campaign_id: "1234567890", name: "Brand — Exact", status: "Enabled" });
    const 軳壍: AccountInfo = { id: "9998887777", name: "Live account", currency: "USD", timezone: "America/New_York", isManager: false, mode: "live" };
    const 寢壍 = () => {
        throw new Error("not used");
    };
    const 竑壍: GoogleAdsSource = {
        mode: "live",
        reason: null,
        apiVersion: "v25",
        listAccounts: async () => [軳壍],
        manager: async () => null,
        defaultAccountId: () => 軳壍.id,
        account: async () => 軳壍,
        today: async () => "2026-09-29",
        dataThrough: async () => "2026-09-28",
        getDims: async () => 瀄壍,
        getTable: 寢壍,
        getChangeEvents: async () => [],
        getGoogleEstimates: async () => ({ simulations: [], recommendations: [], warnings: [] }),
        coverage: async () => null,
        invalidate: async () => undefined,
    };
    return { resolved: { source: 竑壍, health: null }, source: 竑壍, accountId: 軳壍.id, account: 軳壍, accounts: [軳壍], today: "2026-09-29", dataThrough: "2026-09-28", registry: new MetricRegistry() };
}
async function 駀壍(暯壍: Promise<unknown>): Promise<AppError> {
    try {
        await 暯壍;
    }
    catch (薞壍) {
        if (薞壍 instanceof AppError)
            return 薞壍;
        throw 薞壍;
    }
    throw new Error("expected READ_ONLY_LIVE");
}
describe("read-only guard (live mode)", () => {
    beforeEach(() => resetServerState());
    afterEach(() => restoreServerState());
    it("refuses to pause in live mode and offers deep links, a change list and an Editor CSV", async () => {
        const 劍壍 = await 駀壍(simulateAction(儕壍(), { type: "campaign.pause", campaignIds: ["1234567890"] }));
        expect(劍壍.code).toBe("READ_ONLY_LIVE");
        expect(劍壍.status).toBe(409);
        expect(劍壍.message).toBe("This dashboard is read-only for Google Ads");
        const 煼壍 = 劍壍.details as ReadOnlyAlternatives;
        expect(煼壍.deepLinks[0]?.url).toContain("campaignId=1234567890");
        expect(煼壍.deepLinks[0]?.url).toContain("ocid=9998887777");
        expect(煼壍.changeList).toEqual(["Pause campaign 'Brand — Core Terms'"]);
        expect(煼壍.editorCsv.split("\r\n")[0]).toBe("Campaign,Campaign ID,Budget,Budget type,Campaign status");
        expect(煼壍.editorCsv).toContain("Brand — Core Terms,1234567890,420.00,Daily,Paused");
        const 遫壍 = errorResponse(劍壍, "req-1");
        expect(遫壍.status).toBe(409);
        const 嵚壍 = (await 遫壍.json()) as {
            error: {
                code: string;
                details: ReadOnlyAlternatives;
            };
        };
        expect(嵚壍.error.code).toBe("READ_ONLY_LIVE");
        expect(嵚壍.error.details.changeList).toHaveLength(1);
    });
    it("budget and negative-keyword alternatives", async () => {
        const 籉壍 = await 駀壍(simulateAction(儕壍(), { type: "campaign.set_budget", budgets: [{ campaignId: "1234567890", dailyBudget: 455 }] }));
        expect((籉壍.details as ReadOnlyAlternatives).changeList).toEqual(["Set daily budget of 'Brand — Core Terms' from $420.00 to $455.00 (+8.3%)"]);
        const 鬸壍 = await 駀壍(simulateAction(儕壍(), { type: "keywords.add_negatives", negatives: [{ text: "free shoes", matchType: "Exact", campaignId: "1234567890", adGroupId: "555" }] }));
        const 栧壍 = 鬸壍.details as ReadOnlyAlternatives;
        expect(栧壍.changeList[0]).toBe("Add negative keyword [free shoes] (Exact) to campaign 'Brand — Core Terms'");
        expect(栧壍.editorCsv).toContain("Brand — Core Terms,Brand — Exact,free shoes,Negative exact");
    });
});
