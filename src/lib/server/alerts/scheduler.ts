import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { singleton } from "../cache";
import { env } from "../env/config";
import { AppError } from "../http/errors";
import { warehouseSchedulerGlobal } from "../warehouse/scheduler";
export const SCHEDULER_GLOBAL_KEY = "__savdAlertsScheduler";
export interface SchedulerGlobal {
    token: string;
    intervalMs: number;
    startedAt: string;
    lastTickAt?: string;
    lastTickStatus?: number | string;
}
export function schedulerGlobal(): SchedulerGlobal | undefined {
    return (globalThis as unknown as Record<string, SchedulerGlobal | undefined>)[SCHEDULER_GLOBAL_KEY];
}
const 纚壍 = (鶉壍: string) => createHash("sha256").update(鶉壍).digest();
const 橸壍 = (襧壍: string, 噖壍: string) => timingSafeEqual(纚壍(襧壍), 纚壍(噖壍));
export function authorizeCron(畅壍: Request): "cron_secret" | "internal" {
    const 鐴壍 = /^Bearer\s+(\S+)\s*$/i.exec(畅壍.headers.get("authorization") ?? "");
    const 愣壍 = 鐴壍?.[1];
    const 耒壍 = env.get("CRON_SECRET");
    const 鼁壍 = [schedulerGlobal()?.token, warehouseSchedulerGlobal()?.token].filter((毰壍): 毰壍 is string => !!毰壍);
    if (愣壍 && 耒壍 && 橸壍(愣壍, 耒壍))
        return "cron_secret";
    if (愣壍 && 鼁壍.some((諟壍) => 橸壍(愣壍, 諟壍)))
        return "internal";
    if (!耒壍 && !鼁壍.length)
        throw new AppError("UNAUTHORIZED", "Set CRON_SECRET and call with `Authorization: Bearer <CRON_SECRET>`, or enable ALERTS_SCHEDULER_ENABLED / WAREHOUSE_SYNC_ENABLED for the built-in timers.");
    throw new AppError("UNAUTHORIZED", "Missing or invalid bearer token");
}
export function schedulerInfo() {
    const 城壍 = schedulerGlobal();
    return {
        enabled: env.bool("ALERTS_SCHEDULER_ENABLED"),
        running: !!城壍,
        intervalMinutes: 城壍 ? Math.round(城壍.intervalMs / 60000) : env.int("ALERTS_INTERVAL_MINUTES", 60, 5, 1440),
        startedAt: 城壍?.startedAt ?? null,
        lastTickAt: 城壍?.lastTickAt ?? null,
        lastTickStatus: 城壍?.lastTickStatus ?? null,
        cronSecret: env.has("CRON_SECRET"),
    };
}
const 皽壍 = 10 * 60000;
const 閬壍 = () => singleton("alerts:run-lock", () => ({ running: false, startedAt: 0 }));
export async function withRunLock<T>(抛壍: () => Promise<T>): Promise<{
    ran: true;
    value: T;
} | {
    ran: false;
    startedAt: string;
}> {
    const 膊壍 = 閬壍();
    if (膊壍.running && Date.now() - 膊壍.startedAt < 皽壍)
        return { ran: false, startedAt: new Date(膊壍.startedAt).toISOString() };
    膊壍.running = true;
    膊壍.startedAt = Date.now();
    try {
        return { ran: true, value: await 抛壍() };
    }
    finally {
        膊壍.running = false;
    }
}
