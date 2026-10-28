/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { Tooltip } from "radix-ui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/toast";
import { HistoryScreen } from "@/features/anomalies/history-screen";
import { NotificationsScreen } from "@/features/anomalies/notifications-screen";
import { RulesScreen } from "@/features/anomalies/rules-screen";
import { SignalsScreen } from "@/features/anomalies/signals-screen";
import type { AlertChannelView, AlertDelivery, AlertRoute } from "@/lib/domain/contracts/alerts";
import type { SignalView } from "@/lib/domain/contracts/anomaly";
import fixtures from "./fixtures/api.json";
const nav = vi.hoisted(() => ({ pathname: "/anomalies", push: vi.fn() }));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: nav.push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
    usePathname: () => nav.pathname,
    useSearchParams: () => new URLSearchParams(),
}));
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
const EPOCH = "1970-01-01T00:00:00.000Z";
const SNOOZED_ID = "c5:ctr:zscore:2026-09-28";
const RESOLVED_ID = "c1:cpa:zscore:2026-09-28";
const feed = {
    ...(fixtures.feed as unknown as {
        signals: SignalView[];
    }),
    signals: (fixtures.feed.signals as unknown as SignalView[]).map((s): SignalView => s.id === SNOOZED_ID
        ? { ...s, status: "snoozed", snoozedUntil: "2026-09-30T12:19:45.954Z", notes: [{ at: "2026-09-29T12:19:47.059Z", text: "Asked the creative team for new assets" }] }
        : s.id === RESOLVED_ID
            ? { ...s, status: "resolved" }
            : { ...s, status: "open", snoozedUntil: undefined }),
};
const critical = feed.signals.find((s) => s.severity === "critical" && s.status === "open") as SignalView;
const snoozed = feed.signals.find((s) => s.status === "snoozed") as SignalView;
const CHANNELS: AlertChannelView[] = [
    { id: "env-slack", pluginId: "slack", name: "Slack (.env)", enabled: true, origin: "env", options: { includeLinks: true }, version: 1, createdAt: EPOCH, updatedAt: EPOCH, url: { hasValue: true, masked: "••••x9Qa", source: "env" }, signing: false },
    {
        id: "ch-ops",
        pluginId: "webhook",
        name: "Ops webhook",
        enabled: true,
        origin: "stored",
        options: { includeLinks: true },
        version: 2,
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
        url: { hasValue: true, masked: "••••hook", source: "stored" },
        signing: true,
        lastTest: { at: "2026-09-29T11:00:00.000Z", ok: false, status: 404, error: "HTTP 404 Not Found" },
    },
];
const ROUTES: AlertRoute[] = [
    {
        id: "rt-1",
        name: "Critical to Slack",
        enabled: true,
        channelIds: ["env-slack"],
        minSeverity: "critical",
        kinds: ["tracking_break"],
        quietHours: { start: "22:00", end: "07:00", tz: "America/New_York", behavior: "defer", criticalBypass: true },
        includeResolved: false,
        renotifyAfterHours: 24,
        digest: { enabled: true, time: "08:00", tz: "America/New_York" },
        version: 1,
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
    },
];
const DELIVERIES: AlertDelivery[] = [
    {
        id: "d1",
        ts: "2026-09-29T12:00:00.000Z",
        routeId: "rt-1",
        channelId: "env-slack",
        channelName: "Slack (.env)",
        pluginId: "slack",
        kind: "signals",
        signalIds: [critical.id],
        dedupeKey: "k1",
        dedupeKeys: [`rt-1:env-slack:${critical.entity.id}|x:critical`],
        status: "failed",
        attempts: 2,
        httpStatus: 500,
        lastError: "Slack answered 500",
        payloadPreview: '{"text":"CPA up"}',
    },
    { id: "d2", ts: "2026-09-29T11:00:00.000Z", routeId: "rt-1", channelId: "env-slack", channelName: "Slack (.env)", pluginId: "slack", kind: "signals", signalIds: [critical.id], dedupeKey: "k2", status: "suppressed", attempts: 0, reasonCode: "no_live_data", reason: "No live data — logged, not sent.", payloadPreview: "" },
];
interface Call {
    method: string;
    path: string;
    body: unknown;
}
let calls: Call[] = [];
function reply(method: string, url: URL, body: unknown): {
    status?: number;
    json: unknown;
} {
    const p = url.pathname;
    if (p === "/api/status")
        return { json: fixtures.status };
    if (p === "/api/anomalies" && method === "GET")
        return { json: { ...feed, preview: url.searchParams.size > 0 } };
    if (p === "/api/anomalies/settings")
        return { json: method === "PUT" ? { ...fixtures.settings, ...(body as object) } : fixtures.settings };
    if (p === "/api/anomalies/evaluate")
        return { json: { evaluatedAt: EPOCH, dataThrough: "2026-09-28", counts: { signals: 11, newOrEscalated: 2, resolved: 0 } } };
    if (p === "/api/anomalies/rules/preview")
        return { json: fixtures.rulePreview };
    if (p === "/api/anomalies/rules")
        return { json: method === "POST" ? { ...(body as object), id: "rule-1" } : { rules: [] } };
    if (/^\/api\/anomalies\/[^/]+\/notes$/.test(p))
        return { json: { signal: null, state: {} } };
    if (/^\/api\/anomalies\/[^/]+$/.test(p) && method === "PATCH")
        return { json: { signal: null, state: {} } };
    if (p === "/api/campaigns")
        return { json: fixtures.campaigns };
    if (p === "/api/metrics/custom")
        return { json: { metrics: [] } };
    if (p === "/api/alerts/channels" && method === "GET")
        return { json: CHANNELS };
    if (p === "/api/alerts/channels" && method === "POST")
        return { status: 400, json: { error: { code: "SECRETS_DISABLED", message: "APP_ENCRYPTION_KEY is not set, so webhook URLs can't be saved from the UI." } } };
    if (p === "/api/alerts/routes")
        return { json: ROUTES };
    if (p === "/api/alerts/deliveries")
        return { json: { items: DELIVERIES, nextCursor: null } };
    if (/^\/api\/alerts\/deliveries\/[^/]+\/retry$/.test(p))
        return { json: { ...DELIVERIES[0], status: "sent", attempts: 3, lastError: undefined } };
    if (p === "/api/alerts/run")
        return { json: { ...fixtures.dryRun, dryRun: !!(body as {
                    dryRun?: boolean;
                })?.dryRun } };
    if (p === "/api/alerts/digest/preview")
        return { json: fixtures.digest };
    return { status: 404, json: { error: { code: "NOT_FOUND", message: `No stub for ${method} ${p}` } } };
}
beforeEach(() => {
    calls = [];
    nav.push.mockReset();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input), "http://localhost");
        const method = init?.method ?? "GET";
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ method, path: url.pathname + url.search, body });
        const r = reply(method, url, body);
        return new Response(JSON.stringify(r.json), { status: r.status ?? 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() });
    Element.prototype.scrollIntoView = vi.fn();
    globalThis.ResizeObserver = class {
        observe() { }
        unobserve() { }
        disconnect() { }
    } as unknown as typeof ResizeObserver;
});
afterEach(() => cleanup());
function renderScreen(ui: React.ReactElement, pathname: string, search = "") {
    nav.pathname = pathname;
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const onUrlUpdate = vi.fn();
    render(<QueryClientProvider client={qc}>
      <NuqsTestingAdapter searchParams={search} hasMemory onUrlUpdate={onUrlUpdate}>
        <Tooltip.Provider>
          {ui}
          <Toaster />
        </Tooltip.Provider>
      </NuqsTestingAdapter>
    </QueryClientProvider>);
    return { qc, onUrlUpdate };
}
const sent = (method: string, path: string | RegExp) => calls.filter((c) => c.method === method && (typeof path === "string" ? c.path === path : path.test(c.path)));
describe("Signals", () => {
    it("lists open signals with tab and severity counts", async () => {
        renderScreen(<SignalsScreen />, "/anomalies");
        expect(await screen.findByText(critical.title)).toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Signal, before it becomes cost");
        expect(screen.queryByText(snoozed.title)).not.toBeInTheDocument();
        const open = screen.getByRole("tab", { name: /Open/ });
        expect(open).toHaveAttribute("aria-selected", "true");
        expect(within(open).getByText(String(feed.signals.filter((s) => s.status === "open").length))).toBeInTheDocument();
        expect(within(screen.getByRole("tab", { name: /Snoozed/ })).getByText("1")).toBeInTheDocument();
        expect(await screen.findByText("Detection rules")).toBeInTheDocument();
        expect(screen.getByText(/Last 3 days are compared against the baseline mean/)).toBeInTheDocument();
    });
    it("filters by severity chip", async () => {
        const { onUrlUpdate } = renderScreen(<SignalsScreen />, "/anomalies");
        await screen.findByText(critical.title);
        fireEvent.click(screen.getByRole("button", { name: /^Warning/ }));
        const warning = feed.signals.filter((s) => s.status === "open" && s.severity === "warning");
        await waitFor(() => expect(screen.queryByText(critical.title)).not.toBeInTheDocument());
        for (const s of warning)
            expect(screen.getByText(s.title)).toBeInTheDocument();
        await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
        expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toContain("sev=warning");
    });
    it("acknowledges optimistically and sends the action", async () => {
        renderScreen(<SignalsScreen />, "/anomalies");
        const title = await screen.findByText(critical.title);
        const card = title.closest("article") as HTMLElement;
        fireEvent.click(within(card).getByRole("button", { name: "Acknowledge" }));
        await waitFor(() => expect(sent("PATCH", `/api/anomalies/${encodeURIComponent(critical.id)}`)).toHaveLength(1));
        expect(sent("PATCH", /\/api\/anomalies\//)[0]?.body).toEqual({ action: "acknowledge" });
        expect(await screen.findByText("Signal acknowledged")).toBeInTheDocument();
    });
    it("opens the tab of a deep-linked signal and scrolls to it", async () => {
        renderScreen(<SignalsScreen />, "/anomalies", `?focus=${encodeURIComponent(snoozed.id)}`);
        expect(await screen.findByText(snoozed.title)).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /Snoozed/ })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByText(snoozed.notes[0]?.text ?? "")).toBeInTheDocument();
        await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    });
    it("previews quick-rule changes through query overrides and saves them", async () => {
        renderScreen(<SignalsScreen />, "/anomalies");
        await screen.findByText(critical.title);
        fireEvent.click(await screen.findByRole("radio", { name: "28 days" }));
        await waitFor(() => expect(sent("GET", /\/api\/anomalies\?.*baselineDays=28/)).toHaveLength(1), { timeout: 2000 });
        fireEvent.click(screen.getByRole("button", { name: "Save as default" }));
        await waitFor(() => expect(sent("PUT", "/api/anomalies/settings")).toHaveLength(1));
        expect(sent("PUT", "/api/anomalies/settings")[0]?.body).toMatchObject({ zscore: { baselineDays: 28, threshold: 2.5 }, pacing: { enabled: true } });
    });
});
describe("Rules", () => {
    it("saves detector changes without touching threshold rules", async () => {
        renderScreen(<RulesScreen />, "/anomalies/rules");
        expect(await screen.findByText("Z-score deviation")).toBeInTheDocument();
        expect(screen.getByText("Budget pacing & overdelivery")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("switch", { name: /Turn on Robust deviation/ }));
        fireEvent.click(await screen.findByRole("button", { name: "Save changes" }));
        await waitFor(() => expect(sent("PUT", "/api/anomalies/settings")).toHaveLength(1));
        const body = sent("PUT", "/api/anomalies/settings")[0]?.body as Record<string, unknown>;
        expect(body).toMatchObject({ robust: { enabled: true } });
        expect("thresholdRules" in body).toBe(false);
    });
    it("edits the change-history options (defaults filled in for settings saved before they existed)", async () => {
        renderScreen(<RulesScreen />, "/anomalies/rules");
        expect(await screen.findByText("Change history")).toBeInTheDocument();
        expect(screen.getByRole("switch", { name: "Turn off Change history" })).toHaveAttribute("aria-checked", "true");
        expect(screen.getByText("3 days")).toBeInTheDocument();
        expect(screen.getByText("7 days")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("switch", { name: "Cap severity while learning" }));
        fireEvent.change(screen.getByRole("slider", { name: "Learning period" }), { target: { value: "10" } });
        expect(screen.getByText("10 days")).toBeInTheDocument();
        fireEvent.click(await screen.findByRole("button", { name: "Save changes" }));
        await waitFor(() => expect(sent("PUT", "/api/anomalies/settings")).toHaveLength(1));
        expect(sent("PUT", "/api/anomalies/settings")[0]?.body).toMatchObject({ changeHistory: { enabled: true, lookbackDays: 3, learningDays: 10, downgradeExpected: true, capDuringLearning: false } });
    });
    it("previews and adds a threshold rule", async () => {
        renderScreen(<RulesScreen />, "/anomalies/rules");
        expect(await screen.findByText(/No threshold rules yet/)).toBeInTheDocument();
        const add = screen.getByRole("button", { name: "+ New rule" });
        await waitFor(() => expect(add).not.toBeDisabled());
        fireEvent.click(add);
        const drawer = await screen.findByRole("dialog");
        fireEvent.change(within(drawer).getByLabelText("Name"), { target: { value: "CPA ceiling" } });
        fireEvent.change(within(drawer).getByLabelText("Threshold"), { target: { value: "40" } });
        fireEvent.click(within(drawer).getByRole("button", { name: "Preview last 30 days" }));
        expect(await within(drawer).findByText(/Would have fired on/)).toBeInTheDocument();
        fireEvent.click(within(drawer).getByRole("button", { name: "Add rule" }));
        await waitFor(() => expect(sent("POST", "/api/anomalies/rules")).toHaveLength(1));
        expect(sent("POST", "/api/anomalies/rules")[0]?.body).toMatchObject({ name: "CPA ceiling", metric: "cpa", op: "gt", value: 40, window: { kind: "last_n_days", days: 3 }, severity: "warning", scope: { level: "campaign" } });
    });
});
describe("Notifications", () => {
    it("shows channels, routes and the scheduler", async () => {
        renderScreen(<NotificationsScreen />, "/anomalies/notifications");
        expect(await screen.findByText("Slack (.env)")).toBeInTheDocument();
        expect(screen.getByText(".env · SLACK_WEBHOOK_URL")).toBeInTheDocument();
        expect(screen.getByText("× Test failed")).toBeInTheDocument();
        expect(await screen.findByText("Critical to Slack")).toBeInTheDocument();
        expect(screen.getByText("Quiet 22:00–07:00 America/New_York, every day · deferred until they end · critical bypasses")).toBeInTheDocument();
        expect(screen.getByText(/ALERTS_SCHEDULER_ENABLED=true/)).toBeInTheDocument();
    });
    it("runs a dry run first and shows the server's notes", async () => {
        renderScreen(<NotificationsScreen />, "/anomalies/notifications");
        await screen.findByText("Slack (.env)");
        fireEvent.click(screen.getByRole("button", { name: "Run alerts now" }));
        await waitFor(() => expect(sent("POST", "/api/alerts/run")[0]?.body).toEqual({ dryRun: true }));
        const dialog = await screen.findByRole("dialog");
        const note = (fixtures.dryRun as {
            notes: string[];
        }).notes.at(-1) ?? "";
        expect(await within(dialog).findByText(note)).toBeInTheDocument();
        expect(within(dialog).getByText("Evaluated")).toBeInTheDocument();
    });
    it("explains SECRETS_DISABLED when adding a channel", async () => {
        renderScreen(<NotificationsScreen />, "/anomalies/notifications");
        await screen.findByText("Slack (.env)");
        fireEvent.click(screen.getByRole("button", { name: "+ Add channel" }));
        const dialog = await screen.findByRole("dialog");
        fireEvent.change(within(dialog).getByLabelText("Webhook URL"), { target: { value: "https://hooks.slack.com/services/T0/B0/abc" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Add channel" }));
        expect(await within(dialog).findByText(/Set APP_ENCRYPTION_KEY in \.env, or define SLACK_WEBHOOK_URL/)).toBeInTheDocument();
        expect(sent("POST", "/api/alerts/channels")[0]?.body).toMatchObject({ pluginId: "slack", name: "Slack", url: "https://hooks.slack.com/services/T0/B0/abc" });
    });
});
describe("History", () => {
    it("lists deliveries, retries failed ones and shows the signal lifecycle", async () => {
        renderScreen(<HistoryScreen />, "/anomalies/history");
        expect(await screen.findByText("Slack answered 500", { exact: false })).toBeInTheDocument();
        expect((await screen.findAllByText(critical.title)).length).toBeGreaterThan(0);
        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
        await waitFor(() => expect(sent("POST", "/api/alerts/deliveries/d1/retry")).toHaveLength(1));
        expect(await screen.findByText(snoozed.title)).toBeInTheDocument();
        expect(screen.getByText(snoozed.notes[0]?.text ?? "")).toBeInTheDocument();
    });
});
