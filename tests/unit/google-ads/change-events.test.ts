import { describe, expect, it } from "vitest";
import { changeClient, parseChange } from "@/lib/domain/anomaly/changes";
import type { ChangeEvent } from "@/lib/domain/schema/facts";
import { maskEmail, toChangeEvent } from "@/lib/server/google-ads/change-events";
import { flattenStream } from "@/lib/server/google-ads/client";
import { fixture } from "./helpers";
const ctx = { accountId: "1234567890", currency: "USD", budgetCampaigns: new Map([["9001", ["111"]], ["9003", ["333", "555"]]]) };
const events = flattenStream(fixture("change-events.json")).rows.map((r) => toChangeEvent(r, ctx)).filter((e): e is ChangeEvent => e !== null);
const byType = (text: string, op?: string) => events.filter((e) => e.resource_type === text && (!op || e.operation === op));
describe("actor masking", () => {
    it("keeps the first letter and the domain", () => {
        expect(maskEmail("jane.doe@acme.example")).toBe("j•••@acme.example");
        expect(maskEmail("x")).toBe("x•••");
        expect(maskEmail("")).toBeUndefined();
        expect(maskEmail(undefined)).toBeUndefined();
    });
    it("never exposes a raw email", () => {
        for (const e of events)
            expect(JSON.stringify(e)).not.toMatch(/jane\.doe|mike@|api-bot/);
    });
});
describe("change events", () => {
    it("maps every row with timestamps in account time", () => {
        expect(events).toHaveLength(8);
        const budget = events[0]!;
        expect(budget).toMatchObject({
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
        const budget = byType("CAMPAIGN_BUDGET")[0]!;
        expect(budget.summary).toBe("Budget changed from $420.00 to $455.00");
        expect(budget.diffs).toEqual([{ field: "amount", before: 420, after: 455 }]);
        expect(budget.campaign_id).toBe("111");
    });
    it("summarizes bid strategy, status and target changes", () => {
        const campaign = byType("CAMPAIGN");
        expect(campaign.find((e) => e.campaign_id === "555")!.summary).toBe("Bid strategy changed from Target CPA to Maximize conversions");
        expect(campaign.find((e) => e.campaign_id === "333")!.summary).toBe("Campaign paused");
        expect(campaign.find((e) => e.campaign_id === "222")!.summary).toBe("Target ROAS changed from 350% to 400%");
        expect(campaign.find((e) => e.campaign_id === "111")!.summary).toBe("Campaign renamed to “Search | Brand”");
    });
    it("summarizes ad, keyword and asset changes", () => {
        const ad = byType("AD_GROUP_AD")[0]!;
        expect(ad).toMatchObject({ summary: "Final URL changed", campaign_id: "222", ad_group_id: "5001" });
        expect(ad.diffs[0]).toEqual({ field: "final_urls", before: "https://acme.example/shop", after: "https://acme.example/shop?promo=fall" });
        expect(byType("AD_GROUP_CRITERION", "create")[0]!.summary).toBe("Keyword “waterproof boots” added (Phrase match)");
        expect(byType("ASSET", "create")[0]!.summary).toBe("Account asset created");
    });
    it("drops rows without a usable timestamp", () => {
        expect(toChangeEvent({ changeEvent: { changeDateTime: "yesterday" } }, ctx)).toBeNull();
    });
});
describe("mapped events classify for change-history context", () => {
    it("parses category, action, effect and client from live diffs", () => {
        const parsed = events.map((e) => {
            const p = parseChange(e, "USD");
            return { summary: e.summary, category: p.category, action: p.action, effect: p.effect ?? null, client: p.client.label };
        });
        expect(parsed).toEqual([
            { summary: "Budget changed from $420.00 to $455.00", category: "budget", action: "raised", effect: "Budget +8% ($420 → $455)", client: "Google Ads web" },
            { summary: "Bid strategy changed from Target CPA to Maximize conversions", category: "bidding", action: "switched", effect: "Target CPA → Maximize conversions", client: "Google Ads web" },
            { summary: "Final URL changed", category: "landing", action: "updated", effect: "Final URL changed", client: "Editor" },
            { summary: "Keyword “waterproof boots” added (Phrase match)", category: "keywords", action: "added", effect: "Added", client: "API" },
            { summary: "Campaign paused", category: "status", action: "paused", effect: "Paused", client: "Editor" },
            { summary: "Target ROAS changed from 350% to 400%", category: "bid_target", action: "raised", effect: "Target ROAS +14% (350% → 400%)", client: "Google Ads web" },
            { summary: "Account asset created", category: "creative", action: "added", effect: "Added", client: "Google Ads web" },
            { summary: "Campaign renamed to “Search | Brand”", category: "other", action: "updated", effect: null, client: "Google Ads web" },
        ]);
        expect(changeClient(events.find((e) => e.client_type === "GOOGLE_ADS_API")?.client_type).automated).toBe(true);
    });
});
