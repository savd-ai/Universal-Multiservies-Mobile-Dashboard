import { afterEach, describe, expect, it, vi } from "vitest";
import type { DemoResponse } from "@/lib/domain/contracts/demo";
import { DEMO_ACCOUNTS } from "@/lib/domain/demo-data/scenario";
import { policyFor } from "@/lib/server/auth/policy";
import { setClockForTests } from "@/lib/server/clock";
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => undefined }));
const demoRoute = await import("@/app/api/demo/route");
const BASE = "http://localhost:3000";
async function get(query = ""): Promise<{ status: number; json: DemoResponse }> {
    const res = await demoRoute.GET(new Request(`${BASE}/api/demo${query}`));
    return { status: res.status, json: await res.json() };
}
afterEach(() => setClockForTests(undefined));
describe("/api/demo", () => {
    it("reads like any other account route", () => {
        expect(policyFor("GET", "/api/demo")).toEqual({ kind: "permission", permission: "accounts.read" });
    });
    it("returns 90 days of the first demo account through yesterday, no puzzle", async () => {
        setClockForTests(() => new Date("2026-10-12T15:00:00Z"));
        const { status, json } = await get();
        expect(status).toBe(200);
        expect(json.accounts.map((a) => a.id)).toEqual(DEMO_ACCOUNTS.map((a) => a.id));
        expect(json.dataset.account.name).toBe("Acme Running Co.");
        expect(json.dataset.campaigns.length).toBeGreaterThan(0);
        const dates = [...new Set(json.dataset.daily.map((row) => row.date))].sort();
        expect(dates.length).toBe(90);
        expect(dates.at(-1)).toBe("2026-10-11");
        const ids = new Set(json.dataset.campaigns.map((c) => c.id));
        expect(json.dataset.daily.every((row) => ids.has(row.campaign_id))).toBe(true);
    });
    it("switches account and falls back to the first for unknown ids", async () => {
        expect((await get("?account=9876543210")).json.dataset.account.name).toBe("Trail Gear Outlet");
        expect((await get("?account=1")).json.dataset.account.name).toBe("Acme Running Co.");
        expect((await get("?account=abc")).status).toBe(400);
    });
});
