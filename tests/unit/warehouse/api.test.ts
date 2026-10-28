import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { can } from "@/lib/domain/auth/roles";
import type { WarehouseStatus, WarehouseSyncResponse } from "@/lib/domain/contracts/warehouse";
import { policyFor } from "@/lib/server/auth/policy";
import { syncInProgress } from "@/lib/server/warehouse/sync";
import { resetServerState, restoreServerState } from "../analytics/helpers";
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), connection: async () => undefined }));
const status = await import("@/app/api/warehouse/route");
const syncRoute = await import("@/app/api/warehouse/sync/route");
const cron = await import("@/app/api/cron/warehouse/route");
const base = "http://localhost:3000";
const post = (path: string, body: unknown, headers: Record<string, string> = {}) => new Request(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
async function settled(): Promise<void> {
    for (let i = 0; i < 200 && syncInProgress(); i++)
        await new Promise((r) => setTimeout(r, 10));
}
async function getStatus(): Promise<WarehouseStatus> {
    const res = await status.GET(new Request(`${base}/api/warehouse`));
    expect(res.status).toBe(200);
    return (await res.json()) as WarehouseStatus;
}
describe("warehouse API (fixture)", () => {
    beforeEach(() => resetServerState());
    afterEach(async () => {
        await settled();
        restoreServerState();
    });
    it("reports an empty warehouse, syncs every account in the background, then reports coverage and runs", async () => {
        const before = await getStatus();
        expect(before).toMatchObject({ enabled: true, available: true, engine: "SQLite", mode: "live", file: ":memory:", reads: true, schemaVersion: 1, runs: [], running: null });
        expect(before.tables).toHaveLength(7);
        expect(before.note).toBeNull();
        const res = await syncRoute.POST(post("/api/warehouse/sync", { scope: "all" }));
        expect(res.status).toBe(200);
        const started = (await res.json()) as WarehouseSyncResponse;
        expect(started).toMatchObject({ started: true, run: { status: "running", scope: "all", trigger: "manual" } });
        await settled();
        const after = await getStatus();
        expect(after.runs[0]).toMatchObject({ id: started.run?.id, status: "ok", accounts: 2, budgetExhausted: false });
        expect(after.accountsStored).toBe(2);
        const daily = after.tables.find((t) => t.table === "campaign_daily");
        expect(daily?.rows).toBeGreaterThan(0);
        expect(daily?.lastDay).toBe("2026-09-28");
        expect(daily?.periods).toBe(400);
        expect(after.dims.campaigns).toBe(8);
        expect(after.changeEvents.count).toBeGreaterThan(0);
        expect(after.months.length).toBe(13);
        expect(after.months.at(-1)?.month).toBe("2026-09");
    });
    it("validates the sync body", async () => {
        const res = await syncRoute.POST(post("/api/warehouse/sync", { scope: "everything" }));
        expect(res.status).toBe(400);
    });
    it("runs from cron only with a bearer token", async () => {
        const unauthorized = await cron.POST(post("/api/cron/warehouse", {}));
        expect(unauthorized.status).toBe(401);
        vi.stubEnv("CRON_SECRET", "warehouse-cron-secret");
        const ok = await cron.POST(post("/api/cron/warehouse", {}, { authorization: "Bearer warehouse-cron-secret" }));
        expect(ok.status).toBe(200);
        const body = (await ok.json()) as {
            ok: boolean;
            via: string;
            run: {
                status: string;
                trigger: string;
                scope: string;
            };
        };
        expect(body).toMatchObject({ ok: true, via: "cron_secret", run: { status: "ok", trigger: "cron", scope: "all" } });
    });
    it("is agency-only", () => {
        expect(policyFor("GET", "/api/warehouse")).toEqual({ kind: "permission", permission: "system.manage" });
        expect(policyFor("POST", "/api/warehouse/sync")).toEqual({ kind: "permission", permission: "system.manage" });
        expect(policyFor("POST", "/api/cron/warehouse")).toEqual({ kind: "cron" });
        expect(can("agency_admin", "system.manage")).toBe(true);
        expect(can("client_admin", "system.manage")).toBe(false);
    });
});
