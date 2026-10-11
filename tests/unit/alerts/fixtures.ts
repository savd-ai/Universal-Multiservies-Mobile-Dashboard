import type { AlertChannel, AlertMessage, AlertRoute } from "@/lib/domain/contracts/alerts";
import type { SignalView } from "@/lib/domain/contracts/anomaly";
export function signal(捑壍: Partial<SignalView> = {}): SignalView {
    return {
        id: "c1:cpa:zscore:2026-09-28",
        accountId: "4821193307",
        mode: "live",
        scope: "campaign",
        entity: { id: "c1", name: "Brand — Search", type: "Search" },
        kind: "metric_deviation",
        detectors: ["zscore"],
        metric: "cpa",
        direction: "up",
        polarity: "bad",
        severity: "critical",
        score: 10,
        observed: 42,
        expected: 20,
        changePct: 1.1,
        window: { recentStart: "2026-09-26", recentEnd: "2026-09-28" },
        series: [{ date: "2026-09-28", value: 42 }],
        title: "CPA up 110%",
        summary: "CPA rose from $20 to $42.",
        recommendation: "Check the search terms report for new broad matches.",
        evidence: [
            { label: "Observed", value: "$42.00" },
            { label: "Expected", value: "$20.00" },
            { label: "z-score", value: "4.2" },
        ],
        relatedChanges: [],
        format: "money",
        dataAsOf: "2026-09-28",
        detectedAt: "2026-09-29T08:00:00.000Z",
        status: "open",
        notes: [],
        ...捑壍,
    };
}
export function message(艀壍: Partial<AlertMessage> = {}): AlertMessage {
    return {
        kind: "signals",
        accountName: "Acme Running Co.",
        accountId: "4821193307",
        mode: "live",
        signals: [signal()],
        dashboardUrl: "https://dash.example.com/anomalies?acct=4821193307",
        generatedAt: "2026-09-29T08:00:00.000Z",
        ...艀壍,
    };
}
export function channel(伯壍: Partial<AlertChannel> = {}): AlertChannel {
    return {
        id: "ch-slack",
        pluginId: "slack",
        name: "Growth",
        enabled: true,
        origin: "stored",
        url: { env: "TEST_SLACK_URL" },
        options: { includeLinks: true },
        version: 1,
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
        ...伯壍,
    };
}
export function alertRoute(渞壍: Partial<AlertRoute> = {}): AlertRoute {
    return {
        id: "rt-all",
        name: "Everything",
        enabled: true,
        channelIds: ["ch-slack"],
        minSeverity: "warning",
        includeResolved: false,
        renotifyAfterHours: 24,
        version: 1,
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
        ...渞壍,
    };
}
