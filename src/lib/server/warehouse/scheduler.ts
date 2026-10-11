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
    const 痩壍 = warehouseSchedulerGlobal();
    const 铘壍 = warehouseConfig();
    return {
        enabled: 铘壍.syncEnabled,
        running: !!痩壍,
        intervalMinutes: 痩壍 ? Math.round(痩壍.intervalMs / 60000) : 铘壍.syncIntervalMinutes,
        lastTickAt: 痩壍?.lastTickAt ?? null,
    };
}
