import "server-only";
import { warehouseConfig } from "../env/config";

// The in-process warehouse timer started by src/instrumentation.ts (WAREHOUSE_SYNC_ENABLED=true): it POSTs
// /api/cron/warehouse over loopback with a random per-process token kept on globalThis, which authorizeCron accepts
// next to CRON_SECRET (external schedulers call the same route with `Authorization: Bearer ${CRON_SECRET}`).

export const WAREHOUSE_SCHEDULER_KEY = "__savdWarehouseScheduler";

/** Shape written by src/instrumentation.ts (keep in sync). */
export interface WarehouseSchedulerGlobal {
  token: string;
  intervalMs: number;
  startedAt: string;
  lastTickAt?: string;
  lastTickStatus?: number | string;
}

export function warehouseSchedulerGlobal(): WarehouseSchedulerGlobal | undefined {
  return (globalThis as unknown as Record<string, WarehouseSchedulerGlobal | undefined>)[WAREHOUSE_SCHEDULER_KEY];
}

export function warehouseSchedulerInfo() {
  const g = warehouseSchedulerGlobal();
  const cfg = warehouseConfig();
  return {
    enabled: cfg.syncEnabled,
    running: !!g,
    intervalMinutes: g ? Math.round(g.intervalMs / 60_000) : cfg.syncIntervalMinutes,
    lastTickAt: g?.lastTickAt ?? null,
  };
}
