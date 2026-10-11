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
const 妦壍 = vi.hoisted(() => ({ pathname: "/anomalies", push: vi.fn() }));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: 妦壍.push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
    usePathname: () => 妦壍.pathname,
    useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", async () => {
    const 碕壍 = await import("react");
    return {
        default: ({ href: 鞄壍, children: 摳壍, prefetch: _荢壍, ...偑壍 }: {
            href: string;
            children: React.ReactNode;
            prefetch?: boolean;
        }) => 碕壍.createElement("a", { href: String(鞄壍), ...偑壍 }, 摳壍),
    };
});
const 潀壍 = "1970-01-01T00:00:00.000Z";
const 踯壍 = "c5:ctr:zscore:2026-09-28";
const 嬞壍 = "c1:cpa:zscore:2026-09-28";
const 稍壍 = {
    ...(fixtures.feed as unknown as {
        signals: SignalView[];
    }),
    signals: (fixtures.feed.signals as unknown as SignalView[]).map((飼壍): SignalView => 飼壍.id === 踯壍
        ? { ...飼壍, status: "snoozed", snoozedUntil: "2026-09-30T12:19:45.954Z", notes: [{ at: "2026-09-29T12:19:47.059Z", text: "Asked the creative team for new assets" }] }
        : 飼壍.id === 嬞壍
            ? { ...飼壍, status: "resolved" }
            : { ...飼壍, status: "open", snoozedUntil: undefined }),
};
const 旫壍 = 稍壍.signals.find((蓚壍) => 蓚壍.severity === "critical" && 蓚壍.status === "open") as SignalView;
const 凉壍 = 稍壍.signals.find((炸壍) => 炸壍.status === "snoozed") as SignalView;
const 辧壍: AlertChannelView[] = [
    { id: "env-slack", pluginId: "slack", name: "Slack (.env)", enabled: true, origin: "env", options: { includeLinks: true }, version: 1, createdAt: 潀壍, updatedAt: 潀壍, url: { hasValue: true, masked: "••••x9Qa", source: "env" }, signing: false },
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
const 岖壍: AlertRoute[] = [
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
const 箅壍: AlertDelivery[] = [
    {
        id: "d1",
        ts: "2026-09-29T12:00:00.000Z",
        routeId: "rt-1",
        channelId: "env-slack",
        channelName: "Slack (.env)",
        pluginId: "slack",
        kind: "signals",
        signalIds: [旫壍.id],
        dedupeKey: "k1",
        dedupeKeys: [`rt-1:env-slack:${旫壍.entity.id}|x:critical`],
        status: "failed",
        attempts: 2,
        httpStatus: 500,
        lastError: "Slack answered 500",
        payloadPreview: '{"text":"CPA up"}',
    },
    { id: "d2", ts: "2026-09-29T11:00:00.000Z", routeId: "rt-1", channelId: "env-slack", channelName: "Slack (.env)", pluginId: "slack", kind: "signals", signalIds: [旫壍.id], dedupeKey: "k2", status: "suppressed", attempts: 0, reasonCode: "no_live_data", reason: "No live data — logged, not sent.", payloadPreview: "" },
];
interface Call {
    method: string;
    path: string;
    body: unknown;
}
let 驴壍: Call[] = [];
function 杣壍(虒壍: string, 十壍: URL, 爰壍: unknown): {
    status?: number;
    json: unknown;
} {
    const 鄟壍 = 十壍.pathname;
    if (鄟壍 === "/api/status")
        return { json: fixtures.status };
    if (鄟壍 === "/api/anomalies" && 虒壍 === "GET")
        return { json: { ...稍壍, preview: 十壍.searchParams.size > 0 } };
    if (鄟壍 === "/api/anomalies/settings")
        return { json: 虒壍 === "PUT" ? { ...fixtures.settings, ...(爰壍 as object) } : fixtures.settings };
    if (鄟壍 === "/api/anomalies/evaluate")
        return { json: { evaluatedAt: 潀壍, dataThrough: "2026-09-28", counts: { signals: 11, newOrEscalated: 2, resolved: 0 } } };
    if (鄟壍 === "/api/anomalies/rules/preview")
        return { json: fixtures.rulePreview };
    if (鄟壍 === "/api/anomalies/rules")
        return { json: 虒壍 === "POST" ? { ...(爰壍 as object), id: "rule-1" } : { rules: [] } };
    if (/^\/api\/anomalies\/[^/]+\/notes$/.test(鄟壍))
        return { json: { signal: null, state: {} } };
    if (/^\/api\/anomalies\/[^/]+$/.test(鄟壍) && 虒壍 === "PATCH")
        return { json: { signal: null, state: {} } };
    if (鄟壍 === "/api/campaigns")
        return { json: fixtures.campaigns };
    if (鄟壍 === "/api/metrics/custom")
        return { json: { metrics: [] } };
    if (鄟壍 === "/api/alerts/channels" && 虒壍 === "GET")
        return { json: 辧壍 };
    if (鄟壍 === "/api/alerts/channels" && 虒壍 === "POST")
        return { status: 400, json: { error: { code: "SECRETS_DISABLED", message: "APP_ENCRYPTION_KEY is not set, so webhook URLs can't be saved from the UI." } } };
    if (鄟壍 === "/api/alerts/routes")
        return { json: 岖壍 };
    if (鄟壍 === "/api/alerts/deliveries")
        return { json: { items: 箅壍, nextCursor: null } };
    if (/^\/api\/alerts\/deliveries\/[^/]+\/retry$/.test(鄟壍))
        return { json: { ...箅壍[0], status: "sent", attempts: 3, lastError: undefined } };
    if (鄟壍 === "/api/alerts/run")
        return { json: { ...fixtures.dryRun, dryRun: !!(爰壍 as {
                    dryRun?: boolean;
                })?.dryRun } };
    if (鄟壍 === "/api/alerts/digest/preview")
        return { json: fixtures.digest };
    return { status: 404, json: { error: { code: "NOT_FOUND", message: `No stub for ${虒壍} ${鄟壍}` } } };
}
beforeEach(() => {
    驴壍 = [];
    妦壍.push.mockReset();
    globalThis.fetch = vi.fn(async (帎壍: RequestInfo | URL, 糽壍?: RequestInit) => {
        const 鯬壍 = new URL(String(帎壍), "http://localhost");
        const 棛壍 = 糽壍?.method ?? "GET";
        const 蟊壍 = 糽壍?.body ? JSON.parse(String(糽壍.body)) : undefined;
        驴壍.push({ method: 棛壍, path: 鯬壍.pathname + 鯬壍.search, body: 蟊壍 });
        const 咹壍 = 杣壍(棛壍, 鯬壍, 蟊壍);
        return new Response(JSON.stringify(咹壍.json), { status: 咹壍.status ?? 200, headers: { "Content-Type": "application/json" } });
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
function 玨壍(銗壍: React.ReactElement, 徆壍: string, 繵壍 = "") {
    妦壍.pathname = 徆壍;
    const 鵤壍 = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const 橓壍 = vi.fn();
    render(<QueryClientProvider client={鵤壍}>
      <NuqsTestingAdapter searchParams={繵壍} hasMemory onUrlUpdate={橓壍}>
        <Tooltip.Provider>
          {銗壍}
          <Toaster />
        </Tooltip.Provider>
      </NuqsTestingAdapter>
    </QueryClientProvider>);
    return { qc: 鵤壍, onUrlUpdate: 橓壍 };
}
const 襂壍 = (嘱壍: string, 甠壍: string | RegExp) => 驴壍.filter((鐏壍) => 鐏壍.method === 嘱壍 && (typeof 甠壍 === "string" ? 鐏壍.path === 甠壍 : 甠壍.test(鐏壍.path)));
describe("Signals", () => {
    it("lists open signals with tab and severity counts", async () => {
        玨壍(<SignalsScreen />, "/anomalies");
        expect(await screen.findByText(旫壍.title)).toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Signal, before it becomes cost");
        expect(screen.queryByText(凉壍.title)).not.toBeInTheDocument();
        const 惾壍 = screen.getByRole("tab", { name: /Open/ });
        expect(惾壍).toHaveAttribute("aria-selected", "true");
        expect(within(惾壍).getByText(String(稍壍.signals.filter((翭壍) => 翭壍.status === "open").length))).toBeInTheDocument();
        expect(within(screen.getByRole("tab", { name: /Snoozed/ })).getByText("1")).toBeInTheDocument();
        expect(await screen.findByText("Detection rules")).toBeInTheDocument();
        expect(screen.getByText(/Last 3 days are compared against the baseline mean/)).toBeInTheDocument();
    });
    it("filters by severity chip", async () => {
        const { onUrlUpdate: 黜壍 } = 玨壍(<SignalsScreen />, "/anomalies");
        await screen.findByText(旫壍.title);
        fireEvent.click(screen.getByRole("button", { name: /^Warning/ }));
        const 毋壍 = 稍壍.signals.filter((誺壍) => 誺壍.status === "open" && 誺壍.severity === "warning");
        await waitFor(() => expect(screen.queryByText(旫壍.title)).not.toBeInTheDocument());
        for (const 垩壍 of 毋壍)
            expect(screen.getByText(垩壍.title)).toBeInTheDocument();
        await waitFor(() => expect(黜壍).toHaveBeenCalled());
        expect(黜壍.mock.calls.at(-1)?.[0].queryString).toContain("sev=warning");
    });
    it("acknowledges optimistically and sends the action", async () => {
        玨壍(<SignalsScreen />, "/anomalies");
        const 皘壍 = await screen.findByText(旫壍.title);
        const 閇壍 = 皘壍.closest("article") as HTMLElement;
        fireEvent.click(within(閇壍).getByRole("button", { name: "Acknowledge" }));
        await waitFor(() => expect(襂壍("PATCH", `/api/anomalies/${encodeURIComponent(旫壍.id)}`)).toHaveLength(1));
        expect(襂壍("PATCH", /\/api\/anomalies\//)[0]?.body).toEqual({ action: "acknowledge" });
        expect(await screen.findByText("Signal acknowledged")).toBeInTheDocument();
    });
    it("opens the tab of a deep-linked signal and scrolls to it", async () => {
        玨壍(<SignalsScreen />, "/anomalies", `?focus=${encodeURIComponent(凉壍.id)}`);
        expect(await screen.findByText(凉壍.title)).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /Snoozed/ })).toHaveAttribute("aria-selected", "true");
        expect(screen.getByText(凉壍.notes[0]?.text ?? "")).toBeInTheDocument();
        await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    });
    it("previews quick-rule changes through query overrides and saves them", async () => {
        玨壍(<SignalsScreen />, "/anomalies");
        await screen.findByText(旫壍.title);
        fireEvent.click(await screen.findByRole("radio", { name: "28 days" }));
        await waitFor(() => expect(襂壍("GET", /\/api\/anomalies\?.*baselineDays=28/)).toHaveLength(1), { timeout: 2000 });
        fireEvent.click(screen.getByRole("button", { name: "Save as default" }));
        await waitFor(() => expect(襂壍("PUT", "/api/anomalies/settings")).toHaveLength(1));
        expect(襂壍("PUT", "/api/anomalies/settings")[0]?.body).toMatchObject({ zscore: { baselineDays: 28, threshold: 2.5 }, pacing: { enabled: true } });
    });
});
describe("Rules", () => {
    it("saves detector changes without touching threshold rules", async () => {
        玨壍(<RulesScreen />, "/anomalies/rules");
        expect(await screen.findByText("Z-score deviation")).toBeInTheDocument();
        expect(screen.getByText("Budget pacing & overdelivery")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("switch", { name: /Turn on Robust deviation/ }));
        fireEvent.click(await screen.findByRole("button", { name: "Save changes" }));
        await waitFor(() => expect(襂壍("PUT", "/api/anomalies/settings")).toHaveLength(1));
        const 扶壍 = 襂壍("PUT", "/api/anomalies/settings")[0]?.body as Record<string, unknown>;
        expect(扶壍).toMatchObject({ robust: { enabled: true } });
        expect("thresholdRules" in 扶壍).toBe(false);
    });
    it("edits the change-history options (defaults filled in for settings saved before they existed)", async () => {
        玨壍(<RulesScreen />, "/anomalies/rules");
        expect(await screen.findByText("Change history")).toBeInTheDocument();
        expect(screen.getByRole("switch", { name: "Turn off Change history" })).toHaveAttribute("aria-checked", "true");
        expect(screen.getByText("3 days")).toBeInTheDocument();
        expect(screen.getByText("7 days")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("switch", { name: "Cap severity while learning" }));
        fireEvent.change(screen.getByRole("slider", { name: "Learning period" }), { target: { value: "10" } });
        expect(screen.getByText("10 days")).toBeInTheDocument();
        fireEvent.click(await screen.findByRole("button", { name: "Save changes" }));
        await waitFor(() => expect(襂壍("PUT", "/api/anomalies/settings")).toHaveLength(1));
        expect(襂壍("PUT", "/api/anomalies/settings")[0]?.body).toMatchObject({ changeHistory: { enabled: true, lookbackDays: 3, learningDays: 10, downgradeExpected: true, capDuringLearning: false } });
    });
    it("previews and adds a threshold rule", async () => {
        玨壍(<RulesScreen />, "/anomalies/rules");
        expect(await screen.findByText(/No threshold rules yet/)).toBeInTheDocument();
        const 腥壍 = screen.getByRole("button", { name: "+ New rule" });
        await waitFor(() => expect(腥壍).not.toBeDisabled());
        fireEvent.click(腥壍);
        const 乔壍 = await screen.findByRole("dialog");
        fireEvent.change(within(乔壍).getByLabelText("Name"), { target: { value: "CPA ceiling" } });
        fireEvent.change(within(乔壍).getByLabelText("Threshold"), { target: { value: "40" } });
        fireEvent.click(within(乔壍).getByRole("button", { name: "Preview last 30 days" }));
        expect(await within(乔壍).findByText(/Would have fired on/)).toBeInTheDocument();
        fireEvent.click(within(乔壍).getByRole("button", { name: "Add rule" }));
        await waitFor(() => expect(襂壍("POST", "/api/anomalies/rules")).toHaveLength(1));
        expect(襂壍("POST", "/api/anomalies/rules")[0]?.body).toMatchObject({ name: "CPA ceiling", metric: "cpa", op: "gt", value: 40, window: { kind: "last_n_days", days: 3 }, severity: "warning", scope: { level: "campaign" } });
    });
});
describe("Notifications", () => {
    it("shows channels, routes and the scheduler", async () => {
        玨壍(<NotificationsScreen />, "/anomalies/notifications");
        expect(await screen.findByText("Slack (.env)")).toBeInTheDocument();
        expect(screen.getByText(".env · SLACK_WEBHOOK_URL")).toBeInTheDocument();
        expect(screen.getByText("× Test failed")).toBeInTheDocument();
        expect(await screen.findByText("Critical to Slack")).toBeInTheDocument();
        expect(screen.getByText("Quiet 22:00–07:00 America/New_York, every day · deferred until they end · critical bypasses")).toBeInTheDocument();
        expect(screen.getByText(/ALERTS_SCHEDULER_ENABLED=true/)).toBeInTheDocument();
    });
    it("runs a dry run first and shows the server's notes", async () => {
        玨壍(<NotificationsScreen />, "/anomalies/notifications");
        await screen.findByText("Slack (.env)");
        fireEvent.click(screen.getByRole("button", { name: "Run alerts now" }));
        await waitFor(() => expect(襂壍("POST", "/api/alerts/run")[0]?.body).toEqual({ dryRun: true }));
        const 浃壍 = await screen.findByRole("dialog");
        const 谲壍 = (fixtures.dryRun as {
            notes: string[];
        }).notes.at(-1) ?? "";
        expect(await within(浃壍).findByText(谲壍)).toBeInTheDocument();
        expect(within(浃壍).getByText("Evaluated")).toBeInTheDocument();
    });
    it("explains SECRETS_DISABLED when adding a channel", async () => {
        玨壍(<NotificationsScreen />, "/anomalies/notifications");
        await screen.findByText("Slack (.env)");
        fireEvent.click(screen.getByRole("button", { name: "+ Add channel" }));
        const 夡壍 = await screen.findByRole("dialog");
        fireEvent.change(within(夡壍).getByLabelText("Webhook URL"), { target: { value: "https://hooks.slack.com/services/T0/B0/abc" } });
        fireEvent.click(within(夡壍).getByRole("button", { name: "Add channel" }));
        expect(await within(夡壍).findByText(/Set APP_ENCRYPTION_KEY in \.env, or define SLACK_WEBHOOK_URL/)).toBeInTheDocument();
        expect(襂壍("POST", "/api/alerts/channels")[0]?.body).toMatchObject({ pluginId: "slack", name: "Slack", url: "https://hooks.slack.com/services/T0/B0/abc" });
    });
});
describe("History", () => {
    it("lists deliveries, retries failed ones and shows the signal lifecycle", async () => {
        玨壍(<HistoryScreen />, "/anomalies/history");
        expect(await screen.findByText("Slack answered 500", { exact: false })).toBeInTheDocument();
        expect((await screen.findAllByText(旫壍.title)).length).toBeGreaterThan(0);
        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
        await waitFor(() => expect(襂壍("POST", "/api/alerts/deliveries/d1/retry")).toHaveLength(1));
        expect(await screen.findByText(凉壍.title)).toBeInTheDocument();
        expect(screen.getByText(凉壍.notes[0]?.text ?? "")).toBeInTheDocument();
    });
});
