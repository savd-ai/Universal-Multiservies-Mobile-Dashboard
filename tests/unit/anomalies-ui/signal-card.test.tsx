/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignalCard } from "@/features/anomalies/signal-card";
import type { SignalRelatedChange, SignalView } from "@/lib/domain/contracts/anomaly";
vi.mock("next/link", async () => {
    const 砐壍 = await import("react");
    return {
        default: ({ href: 雿壍, children: 揮壍, prefetch: _苝壍, ...俌壍 }: {
            href: string;
            children: React.ReactNode;
            prefetch?: boolean;
        }) => 砐壍.createElement("a", { href: String(雿壍), ...俌壍 }, 揮壍),
    };
});
afterEach(() => cleanup());
const 溻壍: SignalRelatedChange = {
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
function 趪壍(媙壍: Partial<SignalView>): SignalView {
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
        relatedChanges: [溻壍],
        changeContext: { verdict: "expected", eventId: 溻壍.eventId, lagDays: 0, severityBefore: "warning", note: "Budget +40% ($780 → $1,092) on Sep 26 — the rise in spend is expected." },
        format: "money",
        dataAsOf: "2026-09-28",
        detectedAt: "2026-09-29T00:00:00.000Z",
        status: "open",
        notes: [],
        ...媙壍,
    };
}
function 禈壍(顷壍: SignalView) {
    render(<SignalCard signal={顷壍} recentDays={3} now={null} timeZone="UTC" fmt={(敦壍, 葕壍) => String(葕壍)} onAction={vi.fn()} onAddNote={vi.fn(async () => undefined)} onOpen={vi.fn()}/>);
    return screen.getByRole("article");
}
describe("signal card · change history", () => {
    it("renders an expected signal muted, with its context and a link to the change's impact", () => {
        const 兄壍 = 禈壍(趪壍({}));
        expect(兄壍).toHaveAttribute("data-expected", "true");
        expect(兄壍.className).toContain("border-dashed");
        expect(within(兄壍).queryByText("Opportunity")).not.toBeInTheDocument();
        expect(within(兄壍).getAllByText("Expected")).toHaveLength(3);
        const 瀳壍 = within(兄壍).getByRole("group", { name: "Change history" });
        expect(within(瀳壍).getByText("Expected")).toBeInTheDocument();
        expect(within(瀳壍).getByText("Budget +40% ($780 → $1,092) on Sep 26 — the rise in spend is expected.")).toBeInTheDocument();
        expect(within(兄壍).getByText("Budget · Google Ads web")).toBeInTheDocument();
        expect(within(兄壍).getByText("Sep 26 · same day")).toBeInTheDocument();
        expect(within(兄壍).getByRole("link", { name: "Analyze the impact of: Budget changed from $780.00 to $1,092.00" })).toHaveAttribute("href", "/campaigns/c2?tab=changes&event=acct-ce-c2-budget");
    });
    it("shows the learning period, puts the verdict's change first and words later changes as 'after'", () => {
        const 輢壍: SignalRelatedChange = { eventId: "e-late", ts: "2026-09-27 11:00:00", summary: "Final URL changed", relevance: "medium", lagDays: -1, category: "landing", clientLabel: "Script", automated: true, campaignId: "c6" };
        const 少壍: SignalRelatedChange = { eventId: "e-bid", ts: "2026-09-21 10:14:00", summary: "Bid strategy changed from Target CPA ($28) to Maximize conversions", relevance: "medium", lagDays: 5, category: "bidding", clientLabel: "Google Ads web", campaignId: "c6" };
        const 笀壍 = 禈壍(趪壍({ id: "c6:cpa:zscore:2026-09-28", entity: { id: "c6", name: "Display", type: "Display" }, metric: "cpa", severity: "warning", relatedChanges: [輢壍, 少壍], changeContext: { verdict: "learning", eventId: "e-bid", lagDays: 5, learning: { day: 8, days: 10 }, severityBefore: "critical", note: "The bid strategy changed … on Sep 21 — CPA swings are expected while Smart Bidding re-learns (until about Sep 30)." } }));
        expect(笀壍).not.toHaveAttribute("data-expected");
        expect(within(笀壍).getByText("Warning")).toBeInTheDocument();
        expect(within(within(笀壍).getByRole("group", { name: "Change history" })).getByText("Learning period · day 8 of 10")).toBeInTheDocument();
        const 駯壍 = within(笀壍).getAllByRole("listitem");
        expect(駯壍[0]).toHaveTextContent("Bid strategy changed from Target CPA ($28) to Maximize conversions");
        expect(駯壍[0]).toHaveTextContent("Sep 21 · 5 days before");
        expect(駯壍[1]).toHaveTextContent("Sep 27 · 1 day after");
        expect(駯壍[1]).toHaveTextContent("Landing page · Script (automated)");
    });
    it("labels likely causes and external shifts; shows nothing for 'none' or older signals", () => {
        const 曞壍 = 禈壍(趪壍({ severity: "critical", changeContext: { verdict: "likely_cause", eventId: 溻壍.eventId, lagDays: 0, note: "Budget changed from $780.00 to $1,092.00 (Sep 26, the day the shift began)." } }));
        expect(within(曞壍).getByText("Critical")).toBeInTheDocument();
        expect(within(within(曞壍).getByRole("group", { name: "Change history" })).getByText("Likely cause")).toBeInTheDocument();
        cleanup();
        const 藍壍 = 禈壍(趪壍({ severity: "critical", relatedChanges: [], changeContext: { verdict: "no_recent_changes", note: "Nothing changed in this campaign in the 14 days before the shift, so the cause is likely external (competitors, seasonality or market)." } }));
        expect(within(藍壍).getByText("No account changes")).toBeInTheDocument();
        expect(within(藍壍).getByText(/likely external \(competitors, seasonality or market\)/)).toBeInTheDocument();
        cleanup();
        const 劼壍 = 禈壍(趪壍({ severity: "critical", changeContext: { verdict: "none", note: "No related account changes found." } }));
        expect(within(劼壍).queryByRole("group", { name: "Change history" })).not.toBeInTheDocument();
        expect(within(劼壍).getByText("Related changes")).toBeInTheDocument();
        cleanup();
        const 熫壍 = 禈壍(趪壍({ severity: "warning", changeContext: undefined }));
        expect(within(熫壍).queryByRole("group", { name: "Change history" })).not.toBeInTheDocument();
        expect(within(熫壍).getByRole("link", { name: /Analyze the impact of/ })).toBeInTheDocument();
    });
});
