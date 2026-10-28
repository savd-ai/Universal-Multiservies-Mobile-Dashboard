interface SchedulerGlobal {
    token: string;
    intervalMs: number;
    startedAt: string;
    lastTickAt?: string;
    lastTickStatus?: number | string;
    timer?: ReturnType<typeof setInterval>;
}
const KEY = "__savdAlertsScheduler";
const WAREHOUSE_KEY = "__savdWarehouseScheduler";
function flag(v: string | undefined): boolean {
    const t = v?.trim().replace(/^["']|["']$/g, "").toLowerCase();
    return t === "1" || t === "true" || t === "yes" || t === "on";
}
function startTimer(o: {
    key: string;
    path: string;
    label: string;
    minutes: number;
    firstAfterMs: number;
    timeoutMs: number;
}): void {
    const g = globalThis as unknown as Record<string, SchedulerGlobal | undefined>;
    if (g[o.key])
        return;
    const state: SchedulerGlobal = { token: `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, ""), intervalMs: o.minutes * 60000, startedAt: new Date().toISOString() };
    g[o.key] = state;
    const tick = async () => {
        const url = `http://127.0.0.1:${process.env.PORT ?? 3000}${o.path}`;
        try {
            const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${state.token}`, "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(o.timeoutMs) });
            state.lastTickAt = new Date().toISOString();
            state.lastTickStatus = res.status;
            await res.body?.cancel();
            if (!res.ok)
                console.warn(`[savd] WARN ${o.label}: ${o.path} answered HTTP ${res.status}`);
        }
        catch (err) {
            state.lastTickAt = new Date().toISOString();
            state.lastTickStatus = "error";
            console.warn(`[savd] WARN ${o.label} tick failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    };
    state.timer = setInterval(() => void tick(), state.intervalMs);
    state.timer.unref?.();
    setTimeout(() => void tick(), o.firstAfterMs).unref?.();
    console.log(`[savd] INFO ${o.label} on — every ${o.minutes} min (POST ${o.path} over loopback)`);
}
export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME !== "nodejs")
        return;
    if (process.env.NEXT_PHASE === "phase-production-build")
        return;
    if (flag(process.env.ALERTS_SCHEDULER_ENABLED)) {
        const minutes = Math.min(24 * 60, Math.max(5, Number.parseInt(process.env.ALERTS_INTERVAL_MINUTES ?? "", 10) || 60));
        startTimer({ key: KEY, path: "/api/cron/alerts", label: "Alert scheduler", minutes, firstAfterMs: 60000, timeoutMs: 150000 });
    }
    if (flag(process.env.WAREHOUSE_SYNC_ENABLED) && process.env.WAREHOUSE_ENABLED?.trim().toLowerCase() !== "false") {
        const minutes = Math.min(7 * 24 * 60, Math.max(15, Number.parseInt(process.env.WAREHOUSE_SYNC_INTERVAL_MINUTES ?? "", 10) || 360));
        startTimer({ key: WAREHOUSE_KEY, path: "/api/cron/warehouse", label: "Warehouse sync", minutes, firstAfterMs: 120000, timeoutMs: 330000 });
    }
}
