import "server-only";
import { warehouseConfig } from "../env/config";
export const WAREHOUSE_SCHEDULER_KEY = "__savdWarehouseScheduler";
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
        intervalMinutes: g ? Math.round(g.intervalMs / 60000) : cfg.syncIntervalMinutes,
        lastTickAt: g?.lastTickAt ?? null,
    };
}
