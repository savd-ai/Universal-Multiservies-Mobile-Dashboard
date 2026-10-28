import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSingletonsForTests } from "@/lib/server/cache";
import { googleAdsRouter, mockFetch, setupLiveEnv, teardownLiveEnv } from "./helpers";

// The routes the pages call, with the real resolver and the four keys set (network mocked): everything reads live.
(globalThis as { __savdRealResolver?: boolean }).__savdRealResolver = true;
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => undefined }));

const status = await import("@/app/api/status/route");
const query = await import("@/app/api/query/route");
const campaigns = await import("@/app/api/campaigns/route");
const overview = await import("@/app/api/mobile/overview/route");

const BASE = "http://localhost:3000";

beforeEach(() => {
  setupLiveEnv();
  vi.stubEnv("STORE_DRIVER", "memory");
  resetSingletonsForTests("store:");
  resetSingletonsForTests("query:");
  vi.stubGlobal("fetch", mockFetch(googleAdsRouter()).fetch);
});
afterEach(() => teardownLiveEnv());

describe("with the four Google Ads keys in .env, the dashboard is live", () => {
  it("reports live mode with no demo reason (no banner, no 'Demo data' labels)", async () => {
    const body = await (await status.GET(new Request(`${BASE}/api/status`))).json();
    expect(body.mode).toBe("live");
    expect(body.reason ?? null).toBeNull();
    expect(body.account.id).toBe("1234567890");
  });

  it("answers widget queries, the campaign table and the phone overview from Google Ads rows", async () => {
    const res = await query.POST(new Request(`${BASE}/api/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ metrics: ["cost", "clicks"], dateRange: { start: "2026-09-20", end: "2026-09-26" }, totals: true }) }));
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.meta.sources[0].mode).toBe("live");
    expect(result.totals.cost).toBeGreaterThan(0);

    const table = await (await campaigns.GET(new Request(`${BASE}/api/campaigns?range=last_7d`))).json();
    expect(table.mode).toBe("live");
    expect(table.rows.length).toBeGreaterThan(0);

    const phone = await (await overview.GET(new Request(`${BASE}/api/mobile/overview?range=last_7d`))).json();
    expect(phone).toMatchObject({ mode: "live", demo: false, reasonText: null });
    expect(phone.account.id).toBe("1234567890");
  });
});
