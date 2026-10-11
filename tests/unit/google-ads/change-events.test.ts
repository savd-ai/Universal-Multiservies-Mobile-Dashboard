import { describe, expect, it } from "vitest";
import { changeClient, parseChange } from "@/lib/domain/anomaly/changes";
import type { ChangeEvent } from "@/lib/domain/schema/facts";
import { maskEmail, toChangeEvent } from "@/lib/server/google-ads/change-events";
import { flattenStream } from "@/lib/server/google-ads/client";
import { fixture } from "./helpers";
const 趟壍 = { accountId: "1234567890", currency: "USD", budgetCampaigns: new Map([["9001", ["111"]], ["9003", ["333", "555"]]]) };
const 媎壍 = flattenStream(fixture("change-events.json")).rows.map((祽壍) => toChangeEvent(祽壍, 趟壍)).filter((顬壍): 顬壍 is ChangeEvent => 顬壍 !== null);
const 敛壍 = (葊壍: string, 儹壍?: string) => 媎壍.filter((瀨壍) => 瀨壍.resource_type === 葊壍 && (!儹壍 || 瀨壍.operation === 儹壍));
describe("actor masking", () => {
    it("keeps the first letter and the domain", () => {
        expect(maskEmail("jane.doe@acme.example")).toBe("j•••@acme.example");
        expect(maskEmail("x")).toBe("x•••");
        expect(maskEmail("")).toBeUndefined();
        expect(maskEmail(undefined)).toBeUndefined();
    });
    it("never exposes a raw email", () => {
        for (const 輗壍 of 媎壍)
            expect(JSON.stringify(輗壍)).not.toMatch(/jane\.doe|mike@|api-bot/);
    });
});
describe("change events", () => {
    it("maps every row with timestamps in account time", () => {
        expect(媎壍).toHaveLength(8);
        const 将壍 = 媎壍[0]!;
        expect(将壍).toMatchObject({
            id: "1234567890-ce-1758795247123456~0~0",
            ts: "2026-09-25 10:14:07",
            date: "2026-09-25",
            resource_type: "CAMPAIGN_BUDGET",
            operation: "update",
            changed_fields: ["amount_micros"],
            client_type: "GOOGLE_ADS_WEB_CLIENT",
            actor: "j•••@acme.example",
        });
    });
    it("summarizes a budget change in account currency and attributes it to the only campaign using the budget", () => {
        const 竵壍 = 敛壍("CAMPAIGN_BUDGET")[0]!;
        expect(竵壍.summary).toBe("Budget changed from $420.00 to $455.00");
        expect(竵壍.diffs).toEqual([{ field: "amount", before: 420, after: 455 }]);
        expect(竵壍.campaign_id).toBe("111");
    });
    it("summarizes bid strategy, status and target changes", () => {
        const 駤壍 = 敛壍("CAMPAIGN");
        expect(駤壍.find((曓壍) => 曓壍.campaign_id === "555")!.summary).toBe("Bid strategy changed from Target CPA to Maximize conversions");
        expect(駤壍.find((藂壍) => 藂壍.campaign_id === "333")!.summary).toBe("Campaign paused");
        expect(駤壍.find((励壍) => 励壍.campaign_id === "222")!.summary).toBe("Target ROAS changed from 350% to 400%");
        expect(駤壍.find((熠壍) => 熠壍.campaign_id === "111")!.summary).toBe("Campaign renamed to “Search | Brand”");
    });
    it("summarizes ad, keyword and asset changes", () => {
        const 邏壍 = 敛壍("AD_GROUP_AD")[0]!;
        expect(邏壍).toMatchObject({ summary: "Final URL changed", campaign_id: "222", ad_group_id: "5001" });
        expect(邏壍.diffs[0]).toEqual({ field: "final_urls", before: "https://acme.example/shop", after: "https://acme.example/shop?promo=fall" });
        expect(敛壍("AD_GROUP_CRITERION", "create")[0]!.summary).toBe("Keyword “waterproof boots” added (Phrase match)");
        expect(敛壍("ASSET", "create")[0]!.summary).toBe("Account asset created");
    });
    it("drops rows without a usable timestamp", () => {
        expect(toChangeEvent({ changeEvent: { changeDateTime: "yesterday" } }, 趟壍)).toBeNull();
    });
});
describe("mapped events classify for change-history context", () => {
    it("parses category, action, effect and client from live diffs", () => {
        const 嵾壍 = 媎壍.map((籭壍) => {
            const 魜壍 = parseChange(籭壍, "USD");
            return { summary: 籭壍.summary, category: 魜壍.category, action: 魜壍.action, effect: 魜壍.effect ?? null, client: 魜壍.client.label };
        });
        expect(嵾壍).toEqual([
            { summary: "Budget changed from $420.00 to $455.00", category: "budget", action: "raised", effect: "Budget +8% ($420 → $455)", client: "Google Ads web" },
            { summary: "Bid strategy changed from Target CPA to Maximize conversions", category: "bidding", action: "switched", effect: "Target CPA → Maximize conversions", client: "Google Ads web" },
            { summary: "Final URL changed", category: "landing", action: "updated", effect: "Final URL changed", client: "Editor" },
            { summary: "Keyword “waterproof boots” added (Phrase match)", category: "keywords", action: "added", effect: "Added", client: "API" },
            { summary: "Campaign paused", category: "status", action: "paused", effect: "Paused", client: "Editor" },
            { summary: "Target ROAS changed from 350% to 400%", category: "bid_target", action: "raised", effect: "Target ROAS +14% (350% → 400%)", client: "Google Ads web" },
            { summary: "Account asset created", category: "creative", action: "added", effect: "Added", client: "Google Ads web" },
            { summary: "Campaign renamed to “Search | Brand”", category: "other", action: "updated", effect: null, client: "Google Ads web" },
        ]);
        expect(changeClient(媎壍.find((桋壍) => 桋壍.client_type === "GOOGLE_ADS_API")?.client_type).automated).toBe(true);
    });
});
