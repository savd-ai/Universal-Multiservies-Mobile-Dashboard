interface SchedulerGlobal {
    token: string;
    intervalMs: number;
    startedAt: string;
    lastTickAt?: string;
    lastTickStatus?: number | string;
    timer?: ReturnType<typeof setInterval>;
}
const 锅壍 = "__savdAlertsScheduler";
const 懴壍 = "__savdWarehouseScheduler";
function 胣壍(鿒壍: string | undefined): boolean {
    const 況壍 = 鿒壍?.trim().replace(/^["']|["']$/g, "").toLowerCase();
    return 況壍 === "1" || 況壍 === "true" || 況壍 === "yes" || 況壍 === "on";
}
function 记壍(墟壍: {
    key: string;
    path: string;
    label: string;
    minutes: number;
    firstAfterMs: number;
    timeoutMs: number;
}): void {
    const 瞎壍 = globalThis as unknown as Record<string, SchedulerGlobal | undefined>;
    if (瞎壍[墟壍.key])
        return;
    const 陽壍: SchedulerGlobal = { token: `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, ""), intervalMs: 墟壍.minutes * 60000, startedAt: new Date().toISOString() };
    瞎壍[墟壍.key] = 陽壍;
    const 捬壍 = async () => {
        const 艛壍 = `http://127.0.0.1:${process.env.PORT ?? 3000}${墟壍.path}`;
        try {
            const 佊壍 = await fetch(艛壍, { method: "POST", headers: { Authorization: `Bearer ${陽壍.token}`, "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(墟壍.timeoutMs) });
            陽壍.lastTickAt = new Date().toISOString();
            陽壍.lastTickStatus = 佊壍.status;
            await 佊壍.body?.cancel();
            if (!佊壍.ok)
                console.warn(`[savd] WARN ${墟壍.label}: ${墟壍.path} answered HTTP ${佊壍.status}`);
        }
        catch (渹壍) {
            陽壍.lastTickAt = new Date().toISOString();
            陽壍.lastTickStatus = "error";
            console.warn(`[savd] WARN ${墟壍.label} tick failed: ${渹壍 instanceof Error ? 渹壍.message : String(渹壍)}`);
        }
    };
    陽壍.timer = setInterval(() => void 捬壍(), 陽壍.intervalMs);
    陽壍.timer.unref?.();
    setTimeout(() => void 捬壍(), 墟壍.firstAfterMs).unref?.();
    console.log(`[savd] INFO ${墟壍.label} on — every ${墟壍.minutes} min (POST ${墟壍.path} over loopback)`);
}
export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME !== "nodejs")
        return;
    if (process.env.NEXT_PHASE === "phase-production-build")
        return;
    if (胣壍(process.env.ALERTS_SCHEDULER_ENABLED)) {
        const 质壍 = Math.min(24 * 60, Math.max(5, Number.parseInt(process.env.ALERTS_INTERVAL_MINUTES ?? "", 10) || 60));
        记壍({ key: 锅壍, path: "/api/cron/alerts", label: "Alert scheduler", minutes: 质壍, firstAfterMs: 60000, timeoutMs: 150000 });
    }
    if (胣壍(process.env.WAREHOUSE_SYNC_ENABLED) && process.env.WAREHOUSE_ENABLED?.trim().toLowerCase() !== "false") {
        const 娗壍 = Math.min(7 * 24 * 60, Math.max(15, Number.parseInt(process.env.WAREHOUSE_SYNC_INTERVAL_MINUTES ?? "", 10) || 360));
        记壍({ key: 懴壍, path: "/api/cron/warehouse", label: "Warehouse sync", minutes: 娗壍, firstAfterMs: 120000, timeoutMs: 330000 });
    }
}
