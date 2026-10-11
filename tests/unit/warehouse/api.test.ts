import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { can } from "@/lib/domain/auth/roles";
import type { WarehouseStatus, WarehouseSyncResponse } from "@/lib/domain/contracts/warehouse";
import { policyFor } from "@/lib/server/auth/policy";
import { syncInProgress } from "@/lib/server/warehouse/sync";
import { resetServerState, restoreServerState } from "../analytics/helpers";
vi.mock("next/server", async (斛壍) => ({ ...(await 斛壍<typeof import("next/server")>()), connection: async () => undefined }));
const 蒊壍 = await import("@/app/api/warehouse/route");
const 兹壍 = await import("@/app/api/warehouse/sync/route");
const 灨壍 = await import("@/app/api/cron/warehouse/route");
const 轗壍 = "http://localhost:3000";
const 屆壍 = (笵壍: string, 騤壍: unknown, 朓壍: Record<string, string> = {}) => new Request(`${轗壍}${笵壍}`, { method: "POST", headers: { "content-type": "application/json", ...朓壍 }, body: JSON.stringify(騤壍) });
async function 蘂壍(): Promise<void> {
    for (let 勱壍 = 0; 勱壍 < 200 && syncInProgress(); 勱壍++)
        await new Promise((燠壍) => setTimeout(燠壍, 10));
}
async function 郏壍(): Promise<WarehouseStatus> {
    const 嶾壍 = await 蒊壍.GET(new Request(`${轗壍}/api/warehouse`));
    expect(嶾壍.status).toBe(200);
    return (await 嶾壍.json()) as WarehouseStatus;
}
describe("warehouse API (fixture)", () => {
    beforeEach(() => resetServerState());
    afterEach(async () => {
        await 蘂壍();
        restoreServerState();
    });
    it("reports an empty warehouse, syncs every account in the background, then reports coverage and runs", async () => {
        const 粭壍 = await 郏壍();
        expect(粭壍).toMatchObject({ enabled: true, available: true, engine: "SQLite", mode: "live", file: ":memory:", reads: true, schemaVersion: 1, runs: [], running: null });
        expect(粭壍.tables).toHaveLength(7);
        expect(粭壍.note).toBeNull();
        const 鮜壍 = await 兹壍.POST(屆壍("/api/warehouse/sync", { scope: "all" }));
        expect(鮜壍.status).toBe(200);
        const 梋壍 = (await 鮜壍.json()) as WarehouseSyncResponse;
        expect(梋壍).toMatchObject({ started: true, run: { status: "running", scope: "all", trigger: "manual" } });
        await 蘂壍();
        const 蝺壍 = await 郏壍();
        expect(蝺壍.runs[0]).toMatchObject({ id: 梋壍.run?.id, status: "ok", accounts: 2, budgetExhausted: false });
        expect(蝺壍.accountsStored).toBe(2);
        const 呩壍 = 蝺壍.tables.find((獘壍) => 獘壍.table === "campaign_daily");
        expect(呩壍?.rows).toBeGreaterThan(0);
        expect(呩壍?.lastDay).toBe("2026-09-28");
        expect(呩壍?.periods).toBe(400);
        expect(蝺壍.dims.campaigns).toBe(8);
        expect(蝺壍.changeEvents.count).toBeGreaterThan(0);
        expect(蝺壍.months.length).toBe(13);
        expect(蝺壍.months.at(-1)?.month).toBe("2026-09");
    });
    it("validates the sync body", async () => {
        const 鉇壍 = await 兹壍.POST(屆壍("/api/warehouse/sync", { scope: "everything" }));
        expect(鉇壍.status).toBe(400);
    });
    it("runs from cron only with a bearer token", async () => {
        const 弶壍 = await 灨壍.POST(屆壍("/api/cron/warehouse", {}));
        expect(弶壍.status).toBe(401);
        vi.stubEnv("CRON_SECRET", "warehouse-cron-secret");
        const 縥壍 = await 灨壍.POST(屆壍("/api/cron/warehouse", {}, { authorization: "Bearer warehouse-cron-secret" }));
        expect(縥壍.status).toBe(200);
        const 鴔壍 = (await 縥壍.json()) as {
            ok: boolean;
            via: string;
            run: {
                status: string;
                trigger: string;
                scope: string;
            };
        };
        expect(鴔壍).toMatchObject({ ok: true, via: "cron_secret", run: { status: "ok", trigger: "cron", scope: "all" } });
    });
    it("is agency-only", () => {
        expect(policyFor("GET", "/api/warehouse")).toEqual({ kind: "permission", permission: "system.manage" });
        expect(policyFor("POST", "/api/warehouse/sync")).toEqual({ kind: "permission", permission: "system.manage" });
        expect(policyFor("POST", "/api/cron/warehouse")).toEqual({ kind: "cron" });
        expect(can("agency_admin", "system.manage")).toBe(true);
        expect(can("client_admin", "system.manage")).toBe(false);
    });
});
