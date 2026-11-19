import { afterEach, describe, expect, it, vi } from "vitest";
import type { PluginManifest } from "@/lib/domain/contracts/plugins";
import { enumerate } from "@/lib/domain/dates";
import type { GuardedFetch, PluginContext } from "@/lib/server/plugins/define";
import { MOCK_API_KEY, mockPlatformHandle } from "@/lib/server/plugins/mock-platform";
import { createRestPlugin, invalidateRestCache } from "@/lib/server/plugins/rest-engine";

const account = { id: "4821193307", name: "Acme", currency: "USD", timezone: "America/New_York", isManager: false, mode: "demo" as const };
const range = { start: "2026-09-22", end: "2026-09-28" };

function manifest(over: Partial<NonNullable<PluginManifest["rest"]>> = {}, pageSize = 5): PluginManifest {
  return {
    id: "custom-mock",
    name: "Mock",
    version: "1.0.0",
    kind: "rest",
    category: "ad_platform",
    description: "x",
    icon: { abbr: "MK" },
    capabilities: ["metrics.read"],
    live: true,
    refresh: "hourly",
    rest: {
      baseUrl: "mock://platform",
      auth: { type: "api_key_header", header: "x-api-key" },
      report: {
        method: "GET",
        path: `/reports?date_from={start}&date_to={end}&page_size=${pageSize}`,
        rowsPath: "data.rows",
        dateFormat: "YYYY-MM-DD",
        pagination: { type: "cursor", param: "cursor", cursorPath: "paging.next" },
      },
      mapping: { date: "day", spend: "metrics.spend", clicks: "metrics.clicks", impressions: "metrics.impressions", conversions: "actions[action_type=purchase].value", conversionValue: "actions[action_type=purchase_value].value", campaign: "campaign.name" },
      ...over,
    },
  };
}

const noNetwork: GuardedFetch = async () => {
  throw new Error("mock://platform must be answered in-process");
};

const ctx = (config: Record<string, string> = { apiKey: MOCK_API_KEY }, fetch: GuardedFetch = noNetwork): PluginContext => ({ config, env: {}, fetch, account, mode: "live", now: new Date("2026-09-29T15:00:00Z") });

/** What the mock returns for the whole range in one page — the ground truth for the mapped rows. */
function expected() {
  const body = mockPlatformHandle(`/reports?date_from=${range.start}&date_to=${range.end}&page_size=500`, new Headers({ "x-api-key": MOCK_API_KEY })).body as {
    data: { rows: { day: string; campaign: { name: string }; metrics: { spend: string; clicks: number }; actions: { action_type: string; value: number | string }[] }[] };
  };
  return body.data.rows;
}

afterEach(() => {
  invalidateRestCache();
  vi.unstubAllEnvs();
});

describe("REST engine against mock://platform", () => {
  it("follows cursor pagination and maps every row for the date range", async () => {
    const plugin = createRestPlugin(manifest());
    const rows = await plugin.fetchMetrics?.(range, ctx());
    const truth = expected();
    expect(rows).toHaveLength(truth.length); // 7 days × 2 campaigns
    expect(truth.length).toBe(14);
    expect(new Set(rows?.map((r) => r.date))).toEqual(new Set(enumerate(range.start, range.end)));
    const spend = truth.reduce((s, r) => s + Number(r.metrics.spend), 0);
    const purchases = truth.reduce((s, r) => s + Number(r.actions.find((a) => a.action_type === "purchase")?.value ?? 0), 0);
    expect(rows?.reduce((s, r) => s + r.cost, 0)).toBeCloseTo(spend, 6);
    expect(rows?.reduce((s, r) => s + r.conversions, 0)).toBe(purchases);
    expect(rows?.every((r) => r.platform === "custom-mock" && r.account_id === account.id && r.currency === "USD")).toBe(true);
    expect(new Set(rows?.map((r) => r.platform_campaign))).toEqual(new Set(["Spring launch", "Retargeting"]));
  });

  it("previews with raw sample, mapped rows and page stats", async () => {
    const preview = await createRestPlugin(manifest()).preview?.(range, ctx());
    expect(preview?.stats).toMatchObject({ items: 14, pages: 3, mappedRows: 14 });
    expect(preview?.rows.length).toBe(14);
    expect(preview?.warnings).toEqual([]);
    expect(Array.isArray(preview?.rawSample)).toBe(true);
    expect((preview?.rawSample as unknown[]).length).toBe(3);
  });

  it("authenticates from a PLUGIN_* env reference and with bearer tokens", async () => {
    vi.stubEnv("PLUGIN_MOCK_KEY", MOCK_API_KEY);
    const viaEnv = createRestPlugin(manifest({ auth: { type: "api_key_header", header: "x-api-key", secret: { env: "PLUGIN_MOCK_KEY" } } }));
    expect(await viaEnv.fetchMetrics?.(range, ctx({}))).toHaveLength(14);
    const bearer = createRestPlugin({ ...manifest({ auth: { type: "bearer" } }), id: "custom-mock-bearer" });
    expect(await bearer.fetchMetrics?.(range, ctx({ token: MOCK_API_KEY }))).toHaveLength(14);
  });

  it("reports a wrong key clearly and without echoing it", async () => {
    const plugin = createRestPlugin(manifest());
    const test = await plugin.testConnection?.(ctx({ apiKey: "wrong-key-123" }));
    expect(test?.ok).toBe(false);
    expect(test?.message).toMatch(/HTTP 401/);
    expect(test?.message).not.toContain("wrong-key-123");
    await expect(plugin.preview?.(range, ctx({ apiKey: "wrong-key-123" }))).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
    const ok = await plugin.testConnection?.(ctx());
    expect(ok).toMatchObject({ ok: true });
  });

  it("fails loudly when rowsPath does not point at a list", async () => {
    await expect(createRestPlugin(manifest({ report: { ...manifest().rest!.report, rowsPath: "data" } })).fetchMetrics?.(range, ctx())).rejects.toThrow(/rowsPath/);
  });
});

describe("REST engine over the network (stubbed fetch)", () => {
  const net = (over: Partial<NonNullable<PluginManifest["rest"]>> = {}) =>
    createRestPlugin({ ...manifest(), id: "custom-net", rest: { ...manifest().rest!, baseUrl: "https://api.example.com/v2", report: { method: "GET", path: "/stats?from={start}&to={end}&acct={config.account}", rowsPath: "rows", dateFormat: "YYYYMMDD" }, mapping: { date: "date", spend: { path: "cost_micros", transform: "micros" } }, ...over }, configFields: [{ key: "account", label: "Account", type: "text", required: false }] });

  it("builds the URL on the base path with encoded template values and injects auth", async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const fetch: GuardedFetch = async (url, init) => {
      calls.push({ url, headers: init?.headers as Record<string, string> });
      return Response.json({ rows: [{ date: "20260928", cost_micros: 2_500_000 }] });
    };
    const rows = await net({ auth: { type: "api_key_query", param: "key" } }).fetchMetrics?.({ start: "2026-09-28", end: "2026-09-28" }, ctx({ apiKey: "k1", account: "a/b c" }, fetch));
    expect(calls[0]?.url).toBe("https://api.example.com/v2/stats?from=20260928&to=20260928&acct=a%2Fb%20c&key=k1");
    expect(calls[0]?.headers.Accept).toBe("application/json");
    expect(rows).toEqual([expect.objectContaining({ date: "2026-09-28", cost: 2.5 })]);
  });

  it("refuses report paths that leave the base URL's host", async () => {
    const fetch = vi.fn<GuardedFetch>();
    await expect(net({ report: { method: "GET", path: "https://evil.example/steal?from={start}", rowsPath: "rows", dateFormat: "YYYY-MM-DD" } }).fetchMetrics?.(range, ctx({ apiKey: "k" }, fetch))).rejects.toMatchObject({ code: "SSRF_BLOCKED" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("scrubs credentials that an API echoes back in errors", async () => {
    const fetch: GuardedFetch = async () => new Response("bad key: sk_live_ABCDEF123456", { status: 403 });
    const plugin = net({ auth: { type: "bearer" } });
    const res = await plugin.testConnection?.(ctx({ token: "sk_live_ABCDEF123456" }, fetch));
    expect(res?.ok).toBe(false);
    expect(res?.message).toContain("HTTP 403");
    expect(res?.message).not.toContain("sk_live_ABCDEF123456");
  });
});
