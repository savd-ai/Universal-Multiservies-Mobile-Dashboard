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
const digest = (s: string) => createHash("sha256").update(s).digest();
const safeEqual = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));
export function authorizeCron(req: Request): "cron_secret" | "internal" {
    const m = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.get("authorization") ?? "");
    const token = m?.[1];
    const secret = env.get("CRON_SECRET");
    const internal = [schedulerGlobal()?.token, warehouseSchedulerGlobal()?.token].filter((t): t is string => !!t);
    if (token && secret && safeEqual(token, secret))
        return "cron_secret";
    if (token && internal.some((t) => safeEqual(token, t)))
        return "internal";
    if (!secret && !internal.length)
        throw new AppError("UNAUTHORIZED", "Set CRON_SECRET and call with `Authorization: Bearer <CRON_SECRET>`, or enable ALERTS_SCHEDULER_ENABLED / WAREHOUSE_SYNC_ENABLED for the built-in timers.");
    throw new AppError("UNAUTHORIZED", "Missing or invalid bearer token");
}
export function schedulerInfo() {
    const g = schedulerGlobal();
    return {
        enabled: env.bool("ALERTS_SCHEDULER_ENABLED"),
        running: !!g,
        intervalMinutes: g ? Math.round(g.intervalMs / 60000) : env.int("ALERTS_INTERVAL_MINUTES", 60, 5, 1440),
        startedAt: g?.startedAt ?? null,
        lastTickAt: g?.lastTickAt ?? null,
        lastTickStatus: g?.lastTickStatus ?? null,
        cronSecret: env.has("CRON_SECRET"),
    };
}
const STALE_LOCK_MS = 10 * 60000;
const lock = () => singleton("alerts:run-lock", () => ({ running: false, startedAt: 0 }));
export async function withRunLock<T>(fn: () => Promise<T>): Promise<{
    ran: true;
    value: T;
} | {
    ran: false;
    startedAt: string;
}> {
    const l = lock();
    if (l.running && Date.now() - l.startedAt < STALE_LOCK_MS)
        return { ran: false, startedAt: new Date(l.startedAt).toISOString() };
    l.running = true;
    l.startedAt = Date.now();
    try {
        return { ran: true, value: await fn() };
    }
    finally {
        l.running = false;
    }
}
