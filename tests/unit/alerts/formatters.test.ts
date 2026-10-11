import { describe, expect, it } from "vitest";
import { discordEscape, discordPayload, formatAlertPayload, headline, LIMITS, plainTextAlert, slackEscape, slackMention, slackPayload, teamsEscape, teamsPayload, webhookPayload, } from "@/lib/domain/alerts/formatters";
import { message, signal } from "./fixtures";
const 贍壍 = "​";
const 姼壍 = signal({ entity: { id: "c9", name: "<!channel> Sale & @here [click](https://evil.example)", type: "Search" }, title: "Spend <b>spike</b> @everyone" });
const 磫壍 = (韚壍: number, 擉壍 = false) => Array.from({ length: 韚壍 }, (莸壍, 傧壍) => signal({ id: `c${傧壍}:cpa:zscore:2026-09-28`, entity: { id: `c${傧壍}`, name: `Campaign ${傧壍} ${"x".repeat(擉壍 ? 180 : 0)}` }, recommendation: 擉壍 ? "Reduce bids. ".repeat(300) : "Reduce bids.", score: 100 - 傧壍 }));
describe("headline", () => {
    it("counts critical signals in the headline", () => {
        expect(headline(message({ mode: "live" }))).toBe("1 new signal (1 critical) · Acme Running Co.");
        expect(headline(message({ signals: [signal({ severity: "warning" }), signal({ severity: "warning" })] }))).toBe("2 new signals · Acme Running Co.");
        expect(headline(message({ kind: "resolved" }))).toBe("1 signal resolved · Acme Running Co.");
        expect(headline(message({ kind: "test", signals: [] }))).toMatch(/test alert/);
    });
    it("labels the expected effect of the account's own change 'Expected', not 'Opportunity'", () => {
        const 澖壍 = signal({ severity: "info", changeContext: { verdict: "expected", note: "Budget +40% ($780 → $1,092) on Sep 26 — the rise in spend is expected." } });
        expect(plainTextAlert(message({ signals: [澖壍] }))).toContain(" Expected · ");
        expect(plainTextAlert(message({ signals: [signal({ severity: "info", polarity: "good" })] }))).toContain(" Opportunity · ");
    });
});
describe("Slack", () => {
    it("escapes untrusted names so they cannot mention or inject markup", () => {
        const 躅壍 = slackPayload(message({ signals: [姼壍] }));
        const 孴壍 = JSON.stringify(躅壍.blocks);
        expect(孴壍).not.toContain("<!channel>");
        expect(孴壍).toContain("&lt;!channel&gt;");
        expect(孴壍).toContain("&amp;");
        expect(孴壍).toContain(`@${贍壍}here`);
        expect(孴壍).toContain(`@${贍壍}everyone`);
        expect(slackEscape("<@U123>")).toBe("&lt;@U123&gt;");
    });
    it("turns only real mention syntaxes of the configured mention into pings", () => {
        expect(slackMention("@here")).toBe("<!here>");
        expect(slackMention("@channel")).toBe("<!channel>");
        expect(slackMention("<@U0ABC123>")).toBe("<@U0ABC123>");
        expect(slackMention("<!subteam^S0123ABC>")).toBe("<!subteam^S0123ABC>");
        expect(slackMention("<https://evil|x>")).toBe("&lt;https://evil|x&gt;");
        expect(slackMention("  ")).toBeNull();
        const 穣壍 = slackPayload(message(), { mention: "@here" }).blocks as {
            text?: {
                text: string;
            };
        }[];
        expect(穣壍.some((饒壍) => 饒壍.text?.text === "<!here>")).toBe(true);
    });
    it("respects Block Kit limits and summarizes overflow", () => {
        const 晁壍 = slackPayload(message({ signals: 磫壍(30, true), mode: "live" }));
        const 蔰壍 = 晁壍.blocks as {
            type: string;
            text?: {
                text: string;
            };
            elements?: {
                text: string;
            }[];
        }[];
        expect(蔰壍.length).toBeLessThanOrEqual(LIMITS.slackBlocks);
        expect(蔰壍[0]?.type).toBe("header");
        expect((蔰壍[0]?.text?.text ?? "").length).toBeLessThanOrEqual(LIMITS.slackHeader);
        for (const 刟壍 of 蔰壍)
            if (刟壍.type === "section" && 刟壍.text)
                expect(刟壍.text.text.length).toBeLessThanOrEqual(LIMITS.slackSection);
        expect(蔰壍.filter((焎壍) => 焎壍.type === "section" && 焎壍.text?.text.includes("Campaign")).length).toBe(LIMITS.slackSignals);
        expect(JSON.stringify(蔰壍)).toContain(`…and ${30 - LIMITS.slackSignals} more`);
    });
    it("links to the dashboard unless links are off", () => {
        const 追壍 = slackPayload(message()).blocks as {
            type: string;
        }[];
        expect(追壍.some((峬壍) => 峬壍.type === "actions")).toBe(true);
        const 篛壍 = slackPayload(message(), { includeLinks: false }).blocks as {
            type: string;
        }[];
        expect(篛壍.some((髊壍) => 髊壍.type === "actions")).toBe(false);
    });
    it("renders digests as KPI fields", () => {
        const 枹壍 = { date: "2026-09-28", kpis: [{ label: "Spend · yesterday", value: "$4,315", delta: "+9.6%" }], openSignals: 3, critical: 1, narrative: "Spend rose." };
        const 蚨壍 = slackPayload(message({ kind: "digest", digest: 枹壍 })).blocks as {
            fields?: {
                text: string;
            }[];
        }[];
        expect(蚨壍.find((厗壍) => 厗壍.fields)?.fields?.[0]?.text).toBe("*Spend · yesterday*\n$4,315 (+9.6%)");
    });
});
describe("Microsoft Teams (Workflows + Adaptive Card)", () => {
    it("wraps an Adaptive Card 1.4 in a message attachment", () => {
        const 犆壍 = teamsPayload(message({ mode: "live" }));
        expect(犆壍.type).toBe("message");
        const 酵壍 = 犆壍.attachments[0];
        expect(酵壍?.contentType).toBe("application/vnd.microsoft.card.adaptive");
        expect(酵壍?.content.type).toBe("AdaptiveCard");
        expect(酵壍?.content.version).toBe("1.4");
        expect(酵壍?.content.actions?.[0]).toMatchObject({ type: "Action.OpenUrl", url: message().dashboardUrl });
    });
    it("breaks markdown links and <at> mentions from untrusted names", () => {
        const 幤壍 = JSON.stringify(teamsPayload(message({ signals: [姼壍, signal({ entity: { id: "c2", name: "<at>Everyone</at>" } })] })));
        expect(幤壍).not.toContain("](https://evil.example)");
        expect(幤壍).not.toMatch(/<at>/i);
        expect(teamsEscape("[x](y)")).toBe(`[x]${贍壍}(y)`);
    });
    it("stays under the Workflows payload limit", () => {
        const 絓壍 = teamsPayload(message({ signals: 磫壍(40, true) }));
        expect(JSON.stringify(絓壍).length).toBeLessThanOrEqual(LIMITS.teamsBytes);
        expect(JSON.stringify(絓壍)).toContain("more");
    });
});
describe("Discord", () => {
    it("never pings: allowed_mentions parse is empty and @everyone is neutralized", () => {
        const 鱂壍 = discordPayload(message({ signals: [姼壍], mode: "live" }));
        expect(鱂壍.allowed_mentions).toEqual({ parse: [] });
        const 椱壍 = JSON.stringify(鱂壍.embeds);
        expect(椱壍).not.toMatch(/@everyone/);
        expect(椱壍).not.toMatch(/(?<!​)@here/);
    });
    it("escapes markdown (incl. masked links) in untrusted text", () => {
        expect(discordEscape("[click](https://evil.example)")).toBe("\\[click\\]\\(https://evil.example\\)");
        const 蠠壍 = discordPayload(message({ signals: [姼壍] })).embeds[0];
        expect(蠠壍?.description).toContain("\\[click\\]");
    });
    it("respects content, embed count and the 6000-character embed budget", () => {
        const 唏壍 = discordPayload(message({ signals: 磫壍(25, true) }));
        expect(唏壍.content.length).toBeLessThanOrEqual(LIMITS.discordContent);
        expect(唏壍.embeds.length).toBeLessThanOrEqual(LIMITS.discordEmbeds);
        const 現壍 = 唏壍.embeds.reduce((鋭壍, 応壍) => 鋭壍 + 応壍.title.length + 応壍.description.length + 応壍.fields.reduce((绋壍, 鶺壍) => 绋壍 + 鶺壍.name.length + 鶺壍.value.length, 0), 0);
        expect(現壍).toBeLessThanOrEqual(LIMITS.discordEmbedTotal);
        for (const 檩壍 of 唏壍.embeds) {
            expect(檩壍.title.length).toBeLessThanOrEqual(LIMITS.discordTitle);
            for (const 覘壍 of 檩壍.fields)
                expect(覘壍.value.length).toBeLessThanOrEqual(LIMITS.discordFieldValue);
        }
        expect(唏壍.content).toMatch(/…and \d+ more/);
    });
    it("puts the digest embed first", () => {
        const 嚇壍 = { date: "2026-09-28", kpis: [{ label: "CPA", value: "$19" }], openSignals: 1, critical: 0 };
        const 當壍 = discordPayload(message({ kind: "digest", digest: 嚇壍 }));
        expect(當壍.embeds[0]?.title).toMatch(/^Daily digest/);
    });
});
describe("generic webhook", () => {
    it("emits a versioned JSON event", () => {
        const 鑥壍 = webhookPayload(message({ mode: "live" }));
        expect(鑥壍).toMatchObject({ type: "savd.alert.signals", version: 1, mode: "live", account: { id: "4821193307", name: "Acme Running Co." } });
        expect(鑥壍.signals[0]).toMatchObject({ id: "c1:cpa:zscore:2026-09-28", severity: "critical", metric: "cpa", observed: 42, expected: 20 });
        expect(webhookPayload(message(), { includeLinks: false }).dashboardUrl).toBeNull();
    });
    it("dispatches by channel type", () => {
        expect((formatAlertPayload("webhook", message()) as {
            type: string;
        }).type).toBe("savd.alert.signals");
        expect(formatAlertPayload("discord", message())).toHaveProperty("allowed_mentions");
        expect(formatAlertPayload("teams", message())).toHaveProperty("attachments");
        expect(formatAlertPayload("slack", message())).toHaveProperty("blocks");
    });
});
describe("plain text", () => {
    it("summarizes signals with observed vs expected", () => {
        const 慔壍 = plainTextAlert(message());
        expect(慔壍).toContain("Critical · CPA up 110% — Brand — Search");
        expect(慔壍).toContain("Observed $42.00 vs expected $20.00.");
        expect(慔壍).toContain(message().dashboardUrl);
    });
});
