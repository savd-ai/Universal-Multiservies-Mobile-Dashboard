// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { Tooltip } from "radix-ui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/toast";
import { ChannelsScreen } from "@/features/channels/channels-screen";
import { ActivityScreen } from "@/features/data-source/activity-screen";
import { ConnectionScreen } from "@/features/data-source/connection-screen";
import { WarehouseScreen } from "@/features/data-source/warehouse-screen";
import { PluginsScreen } from "@/features/plugins/plugins-screen";
import type { PluginManifest } from "@/lib/domain/contracts/plugins";
import { WAREHOUSE_TABLES, type WarehouseStatus } from "@/lib/domain/contracts/warehouse";
import fixtures from "./fixtures/api.json";

// Smoke tests for the Plugins, Channels, Data source and Activity screens on real API payloads (captured from the
// demo server): they render, and their main actions send the right requests. fetch is stubbed; Next navigation
// and Link are shimmed.

const nav = vi.hoisted(() => ({ pathname: "/plugins", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, prefetch: _p, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) => React.createElement("a", { href: String(href), ...rest }, children),
  };
});

interface Call {
  method: string;
  path: string;
  body: unknown;
}
let calls: Call[] = [];
let channelsPayload: unknown = fixtures.channels;

const actions = { ...fixtures.actions, actions: fixtures.actions.actions.map((a, i) => (i === 0 ? { ...a, revertedAt: undefined } : a)) };

function saved(manifest: PluginManifest) {
  return {
    plugin: { manifest, recordVersion: 1, createdAt: "2026-09-29T12:00:00.000Z", updatedAt: "2026-09-29T12:00:00.000Z", secrets: { auth: { hasValue: false, masked: null, source: "env" } } },
    warnings: ["rest.auth: PLUGIN_KLAVIYO_KEY is not set in the server environment yet — requests will fail until it is."],
    created: true,
    view: { manifest, connected: true, mode: "live", status: "connected", envDetected: [], custom: true },
  };
}

const run = { id: "sync_20260929_a1b2c3", mode: "demo" as const, trigger: "manual" as const, scope: "all" as const, startedAt: "2026-09-29T12:00:00.000Z", finishedAt: "2026-09-29T12:00:02.000Z", status: "ok" as const, accounts: 2, requests: 40, rowsWritten: 88_330, budgetExhausted: false, error: null };
const warehouse: WarehouseStatus = {
  enabled: true,
  available: true,
  reason: null,
  engine: "SQLite",
  sqliteVersion: "3.53.4",
  mode: "demo",
  file: "data/warehouse/demo.sqlite",
  sizeBytes: 11_534_336,
  schemaVersion: 1,
  reads: true,
  scheduler: { enabled: false, running: false, intervalMinutes: 360, lastTickAt: null },
  backfillDays: 400,
  retentionDays: 0,
  maxRequests: 250,
  restatementDays: 14,
  account: { id: "4821193307", name: "Acme Running Co.", currency: "USD" },
  accountsStored: 2,
  tables: WAREHOUSE_TABLES.map((t, i) => ({ table: t.id, label: t.label, sqlTable: t.sql, rows: 1000 * (i + 1), firstDay: "2025-08-26", lastDay: "2026-09-28", periods: 400, settledPeriods: 386, lastFetchedAt: "2026-09-29T12:00:02.000Z", googleFrom: t.id === "campaign_hourly" ? "2026-06-30" : "2023-09-29", beyondGoogle: t.id === "campaign_hourly" ? 28 : 0 })),
  dims: { campaigns: 8, adGroups: 25, keywords: 34, campaignVersions: 9 },
  changeEvents: { count: 18, firstDay: "2026-09-03", lastDay: "2026-09-27" },
  estimates: { simulations: 6, recommendations: 1, lastCapturedAt: "2026-09-29T12:00:02.000Z" },
  months: [
    { month: "2026-08", impressions: 900_000, clicks: 40_000, cost: 131_000, conversions: 3_100, convValue: 520_000 },
    { month: "2026-09", impressions: 880_000, clicks: 39_000, cost: 128_000, conversions: 3_000, convValue: 505_000 },
  ],
  runs: [run],
  running: null,
  note: "Demo data lives in its own file (demo.sqlite), so it never mixes with real accounts.",
};

function reply(method: string, url: URL, body: unknown): { status?: number; json: unknown } {
  const p = url.pathname;
  if (p === "/api/warehouse") return { json: warehouse };
  if (p === "/api/warehouse/sync") return { json: { started: true, run: { ...run, id: "sync_next", status: "running", finishedAt: null, scope: (body as { scope: string }).scope } } };
  if (p === "/api/status") return { json: fixtures.status };
  if (p === "/api/plugins") return { json: fixtures.plugins };
  if (p === "/api/plugins/meta") return { json: fixtures.pluginMeta };
  if (p === "/api/plugins/slack") return { json: fixtures.pluginSlack };
  if (/^\/api\/plugins\/[^/]+\/connect$/.test(p)) return { json: { plugin: fixtures.pluginMeta, channel: null } };
  if (/^\/api\/plugins\/[^/]+\/(test|sync)$/.test(p)) return { json: { ok: true, message: "Demo connector — no live test in v1", testedAt: "2026-09-29T12:00:00.000Z" } };
  if (p === "/api/plugins/custom/preview") return { json: fixtures.preview };
  if (p === "/api/plugins/custom/validate") return { json: fixtures.validate };
  if (p === "/api/plugins/custom" && method === "POST") {
    const b = body as { manifest: PluginManifest; secrets?: Record<string, string> };
    if (b.secrets) return { status: 422, json: { error: { code: "SECRETS_DISABLED", message: "APP_ENCRYPTION_KEY is not set, so this credential can't be saved from the UI.", details: { envKey: "PLUGIN_KLAVIYO_KEY" } } } };
    return { json: saved(b.manifest) };
  }
  if (p === "/api/channels") return { json: channelsPayload };
  if (p === "/api/settings") return { json: method === "PUT" ? { ...fixtures.settings, ...(body as object) } : fixtures.settings };
  if (p === "/api/accounts") return { json: fixtures.accounts };
  if (p === "/api/accounts/active") return { json: { ok: true, accountId: (body as { accountId: string }).accountId } };
  if (p === "/api/google-ads/health") return { json: { mode: "demo", ok: false, reason: { code: "no_env" }, reasonText: fixtures.status.reasonText, health: null } };
  if (p === "/api/google-ads/refresh") return { json: { ok: true, mode: "demo", dataThrough: "2026-09-28" } };
  if (p === "/api/audit") return { json: fixtures.audit };
  if (p === "/api/actions") return { json: actions };
  if (/^\/api\/actions\/[^/]+$/.test(p) && method === "DELETE") return { json: { ...actions.actions[0], revertedAt: "2026-09-29T12:05:00.000Z" } };
  return { status: 404, json: { error: { code: "NOT_FOUND", message: `No stub for ${method} ${p}` } } };
}

beforeEach(() => {
  calls = [];
  channelsPayload = fixtures.channels;
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
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => cleanup());

function renderScreen(ui: React.ReactElement, pathname: string, search = "") {
  nav.pathname = pathname;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onUrlUpdate = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <NuqsTestingAdapter searchParams={search} hasMemory onUrlUpdate={onUrlUpdate}>
        <Tooltip.Provider>
          {ui}
          <Toaster />
        </Tooltip.Provider>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
  return { qc, onUrlUpdate };
}

const sent = (method: string, path: string | RegExp) => calls.filter((c) => c.method === method && (typeof path === "string" ? c.path === path : path.test(c.path)));
const lastQuery = (fn: ReturnType<typeof vi.fn>) => String(fn.mock.calls.at(-1)?.[0]?.queryString ?? "");

describe("Plugins", () => {
  it("renders the gallery and filters by category chip", async () => {
    const { onUrlUpdate } = renderScreen(<PluginsScreen />, "/plugins");
    const meta = await screen.findByRole("article", { name: "Meta Ads" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("One spine, every channel");
    expect(within(meta).getByText("Connected")).toBeInTheDocument();
    expect(within(meta).getByText("Demo")).toBeInTheDocument();
    expect(within(meta).getByText(/Demo connector — live connector not in v1/)).toBeInTheDocument();
    const slack = screen.getByRole("article", { name: "Slack" });
    expect(within(slack).getByText("Live")).toBeInTheDocument();
    expect(within(slack).getByRole("link", { name: /Route alerts on Notifications/ })).toHaveAttribute("href", "/anomalies/notifications");

    fireEvent.click(screen.getByRole("button", { name: /^Alerts/ }));
    await waitFor(() => expect(screen.queryByRole("article", { name: "Meta Ads" })).not.toBeInTheDocument());
    expect(screen.getByRole("article", { name: "Slack" })).toBeInTheDocument();
    await waitFor(() => expect(lastQuery(onUrlUpdate)).toContain("cat=alerts"));
  });

  it("opens the connect modal from ?connect= and sends only the changed, non-secret values", async () => {
    renderScreen(<PluginsScreen />, "/plugins", "?connect=meta");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Configure · Ad platform")).toBeInTheDocument();
    const token = await within(dialog).findByLabelText("Access token");
    expect(token).toBeDisabled();
    expect(within(dialog).getByText(/APP_ENCRYPTION_KEY is set/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Ad account ID"), { target: { value: "act_123" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(sent("POST", "/api/plugins/meta/connect")).toHaveLength(1));
    expect(sent("POST", "/api/plugins/meta/connect")[0]?.body).toEqual({ values: { adAccountId: "act_123" } });
  });

  it("seeds the builder from a demo-only built-in", async () => {
    const { onUrlUpdate } = renderScreen(<PluginsScreen />, "/plugins");
    const meta = await screen.findByRole("article", { name: "Meta Ads" });
    fireEvent.click(within(meta).getByRole("button", { name: /Build a live connector/ }));
    await waitFor(() => expect(screen.getByLabelText("Service name")).toHaveValue("Meta Ads"));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    await waitFor(() => expect(lastQuery(onUrlUpdate)).toContain("build=meta"));
  });

  it("previews the Klaviyo-style mock preset, then saves with an env reference when secrets can't be stored", async () => {
    renderScreen(<PluginsScreen />, "/plugins", "?step=preview");
    fireEvent.click(await screen.findByRole("button", { name: "Test & preview rows" }));
    await waitFor(() => expect(sent("POST", "/api/plugins/custom/preview")).toHaveLength(1));
    const preview = sent("POST", "/api/plugins/custom/preview")[0]?.body as { manifest: PluginManifest; secrets?: unknown };
    expect(preview.secrets).toEqual({ apiKey: "mock-key" });
    expect(preview.manifest).toMatchObject({ id: "custom-klaviyo", kind: "rest", rest: { baseUrl: "mock://platform", report: { rowsPath: "data.rows" } } });
    expect(JSON.stringify(preview.manifest)).not.toContain("mock-key");
    expect(await screen.findByRole("table", { name: /Mapped rows/ })).toBeInTheDocument();
    expect(screen.getAllByText("Spring launch").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Save & connect" }));
    await waitFor(() => expect(sent("POST", "/api/plugins/custom")).toHaveLength(1));
    expect(await screen.findByText(/APP_ENCRYPTION_KEY is not set, so this credential/)).toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole("button", { name: /Use PLUGIN_KLAVIYO_KEY and save/ }))[0] as HTMLElement);
    await waitFor(() => expect(sent("POST", "/api/plugins/custom")).toHaveLength(2));
    const second = sent("POST", "/api/plugins/custom")[1]?.body as { manifest: PluginManifest; secrets?: unknown };
    expect(second.secrets).toBeUndefined();
    expect(second.manifest.rest?.auth).toEqual({ type: "api_key_header", header: "x-api-key", secret: { env: "PLUGIN_KLAVIYO_KEY" } });
    expect(await screen.findByText("Klaviyo registered and connected")).toBeInTheDocument();
    expect(screen.getByText(/Custom plugin · editing custom-klaviyo/)).toBeInTheDocument();
  });
});

describe("Channels", () => {
  it("renders KPIs, platforms and the ledger for the top-bar range", async () => {
    renderScreen(<ChannelsScreen />, "/channels", "?range=7d");
    expect(await screen.findByText("Total ad spend")).toBeInTheDocument();
    expect(sent("GET", "/api/channels?from=2026-09-22&to=2026-09-28")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Every platform, one ledger");
    expect(screen.getByText("Blended ROAS")).toBeInTheDocument();
    expect(screen.getByText(/platform-attributed · may double-count/)).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/attribution window/);
    const ledger = screen.getByRole("table", { name: "Platform ledger" });
    for (const p of fixtures.channels.platforms) expect(within(ledger).getByText(p.label)).toBeInTheDocument();
    expect(within(ledger).getByText("Blended")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Connect another platform/ })[0]).toHaveAttribute("href", "/plugins?cat=ad_platform");
  });
});

describe("Channels · commerce", () => {
  it("shows MER and the store-revenue chart once a commerce source reports", async () => {
    channelsPayload = fixtures.channelsCommerce;
    renderScreen(<ChannelsScreen />, "/channels", "?range=7d");
    expect(await screen.findByText("MER vs store revenue")).toBeInTheDocument();
    const mer = (fixtures.channelsCommerce.totals.mer as number).toFixed(2);
    expect(screen.getByText(`${mer}x`)).toBeInTheDocument();
    expect(screen.getByText("Beside ad spend")).toBeInTheDocument();
    expect(screen.getAllByText("Shopify").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Needs store revenue/)).not.toBeInTheDocument();
  });
});

describe("Data source", () => {
  it("shows the mode, credentials, .env.example and go-live checklist without any secret values", async () => {
    renderScreen(<ConnectionScreen />, "/data-source");
    expect(await screen.findByText("Demo data")).toBeInTheDocument();
    expect(screen.getByText(fixtures.status.reasonText)).toBeInTheDocument();
    expect(screen.getByText("Credentials")).toBeInTheDocument();
    expect(screen.getAllByText("Missing").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText(/GOOGLE_ADS_CLIENT_ID=/)).toBeInTheDocument();
    expect(screen.getByText("All 4 required keys in .env")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Google Ads environment keys" })).toBeInTheDocument();
  });

  it("switches the active account and invalidates", async () => {
    renderScreen(<ConnectionScreen />, "/data-source");
    fireEvent.click(await screen.findByRole("button", { name: "Switch" }));
    await waitFor(() => expect(sent("PUT", "/api/accounts/active")).toHaveLength(1));
    expect(sent("PUT", "/api/accounts/active")[0]?.body).toEqual({ accountId: "9876543210" });
    expect(await screen.findByText("Switched to Trail Gear Outlet")).toBeInTheDocument();
  });

  it("tests the connection and saves display preferences", async () => {
    renderScreen(<ConnectionScreen />, "/data-source");
    fireEvent.click(await screen.findByRole("button", { name: "Test connection" }));
    await waitFor(() => expect(sent("GET", "/api/google-ads/health")).toHaveLength(1));
    const brand = await screen.findByLabelText("Brand terms");
    fireEvent.change(brand, { target: { value: "acme, acme running" } });
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));
    await waitFor(() => expect(sent("PUT", "/api/settings")).toHaveLength(1));
    expect(sent("PUT", "/api/settings")[0]?.body).toMatchObject({ brandTerms: ["acme", "acme running"], displayCurrency: null });
  });
});

describe("Data source · Warehouse", () => {
  it("shows the SQLite warehouse, its coverage beyond Google, monthly totals and syncs, and starts a sync", async () => {
    renderScreen(<WarehouseScreen />, "/data-source/warehouse");
    expect(await screen.findByText("SQLite warehouse")).toBeInTheDocument();
    expect(screen.getByText("data/warehouse/demo.sqlite")).toBeInTheDocument();
    expect(screen.getByText("11.0 MB")).toBeInTheDocument();
    const tables = screen.getByRole("table", { name: "Warehouse tables for Acme Running Co." });
    expect(within(tables).getByText("Campaign × hour")).toBeInTheDocument();
    expect(within(tables).getByText("fact_campaign_hourly")).toBeInTheDocument();
    expect(within(tables).getByText("+28")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Recent warehouse syncs" })).toBeInTheDocument();
    expect(screen.getByText("88,330")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View as table" }));
    expect(screen.getByRole("table", { name: "Monthly totals from the warehouse" })).toBeInTheDocument();
    expect(screen.getByText("3.95×")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sync all accounts" }));
    await waitFor(() => expect(sent("POST", "/api/warehouse/sync")).toHaveLength(1));
    expect(sent("POST", "/api/warehouse/sync")[0]?.body).toEqual({ scope: "all" });
    expect(await screen.findByText("Syncing every account in the background")).toBeInTheDocument();
  });
});

describe("Activity", () => {
  it("lists simulated actions with Revert and filters the audit log", async () => {
    const { onUrlUpdate } = renderScreen(<ActivityScreen />, "/data-source/activity");
    fireEvent.click(await screen.findByRole("button", { name: /Revert/ }));
    await waitFor(() => expect(sent("DELETE", `/api/actions/${actions.actions[0]?.id}`)).toHaveLength(1));
    const table = await screen.findByRole("table", { name: "Audit log" });
    expect(within(table).getAllByRole("row").length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole("button", { name: /^Plugins/ }));
    await waitFor(() => expect(lastQuery(onUrlUpdate)).toContain("type=plugin"));
    for (const row of within(screen.getByRole("table", { name: "Audit log" })).getAllByRole("row").slice(1)) expect(row.textContent).toMatch(/plugin\./);
  });
});
