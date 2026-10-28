import { describe, expect, it } from "vitest";
import { discordEscape, discordPayload, formatAlertPayload, headline, LIMITS, plainTextAlert, slackEscape, slackMention, slackPayload, teamsEscape, teamsPayload, webhookPayload, } from "@/lib/domain/alerts/formatters";
import { message, signal } from "./fixtures";
const ZWSP = "​";
const hostile = signal({ entity: { id: "c9", name: "<!channel> Sale & @here [click](https://evil.example)", type: "Search" }, title: "Spend <b>spike</b> @everyone" });
const many = (n: number, long = false) => Array.from({ length: n }, (_, i) => signal({ id: `c${i}:cpa:zscore:2026-09-28`, entity: { id: `c${i}`, name: `Campaign ${i} ${"x".repeat(long ? 180 : 0)}` }, recommendation: long ? "Reduce bids. ".repeat(300) : "Reduce bids.", score: 100 - i }));
describe("headline", () => {
    it("counts critical signals in the headline", () => {
        expect(headline(message({ mode: "live" }))).toBe("1 new signal (1 critical) · Acme Running Co.");
        expect(headline(message({ signals: [signal({ severity: "warning" }), signal({ severity: "warning" })] }))).toBe("2 new signals · Acme Running Co.");
        expect(headline(message({ kind: "resolved" }))).toBe("1 signal resolved · Acme Running Co.");
        expect(headline(message({ kind: "test", signals: [] }))).toMatch(/test alert/);
    });
    it("labels the expected effect of the account's own change 'Expected', not 'Opportunity'", () => {
        const expected = signal({ severity: "info", changeContext: { verdict: "expected", note: "Budget +40% ($780 → $1,092) on Sep 26 — the rise in spend is expected." } });
        expect(plainTextAlert(message({ signals: [expected] }))).toContain(" Expected · ");
        expect(plainTextAlert(message({ signals: [signal({ severity: "info", polarity: "good" })] }))).toContain(" Opportunity · ");
    });
});
describe("Slack", () => {
    it("escapes untrusted names so they cannot mention or inject markup", () => {
        const out = slackPayload(message({ signals: [hostile] }));
        const text = JSON.stringify(out.blocks);
        expect(text).not.toContain("<!channel>");
        expect(text).toContain("&lt;!channel&gt;");
        expect(text).toContain("&amp;");
        expect(text).toContain(`@${ZWSP}here`);
        expect(text).toContain(`@${ZWSP}everyone`);
        expect(slackEscape("<@U123>")).toBe("&lt;@U123&gt;");
    });
    it("turns only real mention syntaxes of the configured mention into pings", () => {
        expect(slackMention("@here")).toBe("<!here>");
        expect(slackMention("@channel")).toBe("<!channel>");
        expect(slackMention("<@U0ABC123>")).toBe("<@U0ABC123>");
        expect(slackMention("<!subteam^S0123ABC>")).toBe("<!subteam^S0123ABC>");
        expect(slackMention("<https://evil|x>")).toBe("&lt;https://evil|x&gt;");
        expect(slackMention("  ")).toBeNull();
        const blocks = slackPayload(message(), { mention: "@here" }).blocks as {
            text?: {
                text: string;
            };
        }[];
        expect(blocks.some((b) => b.text?.text === "<!here>")).toBe(true);
    });
    it("respects Block Kit limits and summarizes overflow", () => {
        const out = slackPayload(message({ signals: many(30, true), mode: "live" }));
        const blocks = out.blocks as {
            type: string;
            text?: {
                text: string;
            };
            elements?: {
                text: string;
            }[];
        }[];
        expect(blocks.length).toBeLessThanOrEqual(LIMITS.slackBlocks);
        expect(blocks[0]?.type).toBe("header");
        expect((blocks[0]?.text?.text ?? "").length).toBeLessThanOrEqual(LIMITS.slackHeader);
        for (const b of blocks)
            if (b.type === "section" && b.text)
                expect(b.text.text.length).toBeLessThanOrEqual(LIMITS.slackSection);
        expect(blocks.filter((b) => b.type === "section" && b.text?.text.includes("Campaign")).length).toBe(LIMITS.slackSignals);
        expect(JSON.stringify(blocks)).toContain(`…and ${30 - LIMITS.slackSignals} more`);
    });
    it("links to the dashboard unless links are off", () => {
        const withLinks = slackPayload(message()).blocks as {
            type: string;
        }[];
        expect(withLinks.some((b) => b.type === "actions")).toBe(true);
        const noLinks = slackPayload(message(), { includeLinks: false }).blocks as {
            type: string;
        }[];
        expect(noLinks.some((b) => b.type === "actions")).toBe(false);
    });
    it("renders digests as KPI fields", () => {
        const digest = { date: "2026-09-28", kpis: [{ label: "Spend · yesterday", value: "$4,315", delta: "+9.6%" }], openSignals: 3, critical: 1, narrative: "Spend rose." };
        const blocks = slackPayload(message({ kind: "digest", digest })).blocks as {
            fields?: {
                text: string;
            }[];
        }[];
        expect(blocks.find((b) => b.fields)?.fields?.[0]?.text).toBe("*Spend · yesterday*\n$4,315 (+9.6%)");
    });
});
describe("Microsoft Teams (Workflows + Adaptive Card)", () => {
    it("wraps an Adaptive Card 1.4 in a message attachment", () => {
        const out = teamsPayload(message({ mode: "live" }));
        expect(out.type).toBe("message");
        const att = out.attachments[0];
        expect(att?.contentType).toBe("application/vnd.microsoft.card.adaptive");
        expect(att?.content.type).toBe("AdaptiveCard");
        expect(att?.content.version).toBe("1.4");
        expect(att?.content.actions?.[0]).toMatchObject({ type: "Action.OpenUrl", url: message().dashboardUrl });
    });
    it("breaks markdown links and <at> mentions from untrusted names", () => {
        const text = JSON.stringify(teamsPayload(message({ signals: [hostile, signal({ entity: { id: "c2", name: "<at>Everyone</at>" } })] })));
        expect(text).not.toContain("](https://evil.example)");
        expect(text).not.toMatch(/<at>/i);
        expect(teamsEscape("[x](y)")).toBe(`[x]${ZWSP}(y)`);
    });
    it("stays under the Workflows payload limit", () => {
        const out = teamsPayload(message({ signals: many(40, true) }));
        expect(JSON.stringify(out).length).toBeLessThanOrEqual(LIMITS.teamsBytes);
        expect(JSON.stringify(out)).toContain("more");
    });
});
describe("Discord", () => {
    it("never pings: allowed_mentions parse is empty and @everyone is neutralized", () => {
        const out = discordPayload(message({ signals: [hostile], mode: "live" }));
        expect(out.allowed_mentions).toEqual({ parse: [] });
        const text = JSON.stringify(out.embeds);
        expect(text).not.toMatch(/@everyone/);
        expect(text).not.toMatch(/(?<!​)@here/);
    });
    it("escapes markdown (incl. masked links) in untrusted text", () => {
        expect(discordEscape("[click](https://evil.example)")).toBe("\\[click\\]\\(https://evil.example\\)");
        const d = discordPayload(message({ signals: [hostile] })).embeds[0];
        expect(d?.description).toContain("\\[click\\]");
    });
    it("respects content, embed count and the 6000-character embed budget", () => {
        const out = discordPayload(message({ signals: many(25, true) }));
        expect(out.content.length).toBeLessThanOrEqual(LIMITS.discordContent);
        expect(out.embeds.length).toBeLessThanOrEqual(LIMITS.discordEmbeds);
        const total = out.embeds.reduce((s, e) => s + e.title.length + e.description.length + e.fields.reduce((a, f) => a + f.name.length + f.value.length, 0), 0);
        expect(total).toBeLessThanOrEqual(LIMITS.discordEmbedTotal);
        for (const e of out.embeds) {
            expect(e.title.length).toBeLessThanOrEqual(LIMITS.discordTitle);
            for (const f of e.fields)
                expect(f.value.length).toBeLessThanOrEqual(LIMITS.discordFieldValue);
        }
        expect(out.content).toMatch(/…and \d+ more/);
    });
    it("puts the digest embed first", () => {
        const digest = { date: "2026-09-28", kpis: [{ label: "CPA", value: "$19" }], openSignals: 1, critical: 0 };
        const out = discordPayload(message({ kind: "digest", digest }));
        expect(out.embeds[0]?.title).toMatch(/^Daily digest/);
    });
});
describe("generic webhook", () => {
    it("emits a versioned JSON event", () => {
        const out = webhookPayload(message({ mode: "live" }));
        expect(out).toMatchObject({ type: "savd.alert.signals", version: 1, mode: "live", account: { id: "4821193307", name: "Acme Running Co." } });
        expect(out.signals[0]).toMatchObject({ id: "c1:cpa:zscore:2026-09-28", severity: "critical", metric: "cpa", observed: 42, expected: 20 });
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
        const text = plainTextAlert(message());
        expect(text).toContain("Critical · CPA up 110% — Brand — Search");
        expect(text).toContain("Observed $42.00 vs expected $20.00.");
        expect(text).toContain(message().dashboardUrl);
    });
});
