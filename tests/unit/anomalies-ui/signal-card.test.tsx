/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignalCard } from "@/features/anomalies/signal-card";
import type { SignalRelatedChange, SignalView } from "@/lib/domain/contracts/anomaly";
vi.mock("next/link", async () => {
    const React2 = await import("react");
    return {
        default: ({ href, children, prefetch: _p, ...rest }: {
            href: string;
            children: React.ReactNode;
            prefetch?: boolean;
        }) => React2.createElement("a", { href: String(href), ...rest }, children),
    };
});
afterEach(() => cleanup());
const budgetRaise: SignalRelatedChange = {
    eventId: "acct-ce-c2-budget",
    ts: "2026-09-26 09:12:00",
    summary: "Budget changed from $780.00 to $1,092.00",
    relevance: "high",
    lagDays: 0,
    category: "budget",
    clientLabel: "Google Ads web",
    campaignId: "c2",
    effect: "Budget +40% ($780 → $1,092)",
};
function sig(p: Partial<SignalView>): SignalView {
    return {
        id: "c2:spend:zscore:2026-09-28",
        accountId: "acct",
        mode: "live",
        scope: "campaign",
        entity: { id: "c2", name: "Generic — Running Shoes", type: "Search" },
        kind: "metric_deviation",
        detectors: ["zscore"],
        metric: "spend",
        direction: "up",
        polarity: "bad",
        severity: "info",
        score: 1,
        observed: 981,
        expected: 731,
        changePct: 0.34,
        z: 4.1,
        window: { recentStart: "2026-09-26", recentEnd: "2026-09-28" },
        onsetDate: "2026-09-26",
        series: [],
        title: "Spend up 34%",
        summary: "Spend averaged $981/day.",
        recommendation: "Spend is up 34% because the daily budget was raised 40% ($780 → $1,092) on Sep 26 — the expected effect of the change, not an anomaly.",
        evidence: [],
        relatedChanges: [budgetRaise],
        changeContext: { verdict: "expected", eventId: budgetRaise.eventId, lagDays: 0, severityBefore: "warning", note: "Budget +40% ($780 → $1,092) on Sep 26 — the rise in spend is expected." },
        format: "money",
        dataAsOf: "2026-09-28",
        detectedAt: "2026-09-29T00:00:00.000Z",
        status: "open",
        notes: [],
        ...p,
    };
}
function renderCard(signal: SignalView) {
    render(<SignalCard signal={signal} recentDays={3} now={null} timeZone="UTC" fmt={(_f, v) => String(v)} onAction={vi.fn()} onAddNote={vi.fn(async () => undefined)} onOpen={vi.fn()}/>);
    return screen.getByRole("article");
}
describe("signal card · change history", () => {
    it("renders an expected signal muted, with its context and a link to the change's impact", () => {
        const card = renderCard(sig({}));
        expect(card).toHaveAttribute("data-expected", "true");
        expect(card.className).toContain("border-dashed");
        expect(within(card).queryByText("Opportunity")).not.toBeInTheDocument();
        expect(within(card).getAllByText("Expected")).toHaveLength(3);
        const context = within(card).getByRole("group", { name: "Change history" });
        expect(within(context).getByText("Expected")).toBeInTheDocument();
        expect(within(context).getByText("Budget +40% ($780 → $1,092) on Sep 26 — the rise in spend is expected.")).toBeInTheDocument();
        expect(within(card).getByText("Budget · Google Ads web")).toBeInTheDocument();
        expect(within(card).getByText("Sep 26 · same day")).toBeInTheDocument();
        expect(within(card).getByRole("link", { name: "Analyze the impact of: Budget changed from $780.00 to $1,092.00" })).toHaveAttribute("href", "/campaigns/c2?tab=changes&event=acct-ce-c2-budget");
    });
    it("shows the learning period, puts the verdict's change first and words later changes as 'after'", () => {
        const later: SignalRelatedChange = { eventId: "e-late", ts: "2026-09-27 11:00:00", summary: "Final URL changed", relevance: "medium", lagDays: -1, category: "landing", clientLabel: "Script", automated: true, campaignId: "c6" };
        const strategy: SignalRelatedChange = { eventId: "e-bid", ts: "2026-09-21 10:14:00", summary: "Bid strategy changed from Target CPA ($28) to Maximize conversions", relevance: "medium", lagDays: 5, category: "bidding", clientLabel: "Google Ads web", campaignId: "c6" };
        const card = renderCard(sig({ id: "c6:cpa:zscore:2026-09-28", entity: { id: "c6", name: "Display", type: "Display" }, metric: "cpa", severity: "warning", relatedChanges: [later, strategy], changeContext: { verdict: "learning", eventId: "e-bid", lagDays: 5, learning: { day: 8, days: 10 }, severityBefore: "critical", note: "The bid strategy changed … on Sep 21 — CPA swings are expected while Smart Bidding re-learns (until about Sep 30)." } }));
        expect(card).not.toHaveAttribute("data-expected");
        expect(within(card).getByText("Warning")).toBeInTheDocument();
        expect(within(within(card).getByRole("group", { name: "Change history" })).getByText("Learning period · day 8 of 10")).toBeInTheDocument();
        const items = within(card).getAllByRole("listitem");
        expect(items[0]).toHaveTextContent("Bid strategy changed from Target CPA ($28) to Maximize conversions");
        expect(items[0]).toHaveTextContent("Sep 21 · 5 days before");
        expect(items[1]).toHaveTextContent("Sep 27 · 1 day after");
        expect(items[1]).toHaveTextContent("Landing page · Script (automated)");
    });
    it("labels likely causes and external shifts; shows nothing for 'none' or older signals", () => {
        const likely = renderCard(sig({ severity: "critical", changeContext: { verdict: "likely_cause", eventId: budgetRaise.eventId, lagDays: 0, note: "Budget changed from $780.00 to $1,092.00 (Sep 26, the day the shift began)." } }));
        expect(within(likely).getByText("Critical")).toBeInTheDocument();
        expect(within(within(likely).getByRole("group", { name: "Change history" })).getByText("Likely cause")).toBeInTheDocument();
        cleanup();
        const quiet = renderCard(sig({ severity: "critical", relatedChanges: [], changeContext: { verdict: "no_recent_changes", note: "Nothing changed in this campaign in the 14 days before the shift, so the cause is likely external (competitors, seasonality or market)." } }));
        expect(within(quiet).getByText("No account changes")).toBeInTheDocument();
        expect(within(quiet).getByText(/likely external \(competitors, seasonality or market\)/)).toBeInTheDocument();
        cleanup();
        const none = renderCard(sig({ severity: "critical", changeContext: { verdict: "none", note: "No related account changes found." } }));
        expect(within(none).queryByRole("group", { name: "Change history" })).not.toBeInTheDocument();
        expect(within(none).getByText("Related changes")).toBeInTheDocument();
        cleanup();
        const old = renderCard(sig({ severity: "warning", changeContext: undefined }));
        expect(within(old).queryByRole("group", { name: "Change history" })).not.toBeInTheDocument();
        expect(within(old).getByRole("link", { name: /Analyze the impact of/ })).toBeInTheDocument();
    });
});
