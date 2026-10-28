import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeCron, SCHEDULER_GLOBAL_KEY, schedulerGlobal, withRunLock } from "@/lib/server/alerts/scheduler";
import { register } from "@/instrumentation";
const g = globalThis as unknown as Record<string, {
    token: string;
    timer?: ReturnType<typeof setInterval>;
} | undefined>;
const req = (auth?: string) => new Request("http://127.0.0.1:3000/api/cron/alerts", { method: "POST", headers: auth ? { authorization: auth } : {} });
function clearScheduler() {
    const s = g[SCHEDULER_GLOBAL_KEY];
    if (s?.timer)
        clearInterval(s.timer);
    delete g[SCHEDULER_GLOBAL_KEY];
}
beforeEach(clearScheduler);
afterEach(() => {
    clearScheduler();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});
describe("cron authorization", () => {
    it("accepts Bearer CRON_SECRET and rejects anything else", () => {
        vi.stubEnv("CRON_SECRET", "cron-secret-value");
        expect(authorizeCron(req("Bearer cron-secret-value"))).toBe("cron_secret");
        expect(() => authorizeCron(req("Bearer nope"))).toThrow(/invalid bearer/);
        expect(() => authorizeCron(req())).toThrow(/invalid bearer/);
        expect(() => authorizeCron(req("Basic Y3Jvbi1zZWNyZXQtdmFsdWU="))).toThrow();
    });
    it("accepts the in-process scheduler's loopback token", () => {
        g[SCHEDULER_GLOBAL_KEY] = { token: "loopback-token-123" };
        expect(authorizeCron(req("Bearer loopback-token-123"))).toBe("internal");
        expect(() => authorizeCron(req("Bearer loopback-token-12"))).toThrow();
    });
    it("explains the setup when nothing is configured", () => {
        expect(() => authorizeCron(req("Bearer x"))).toThrow(/Set CRON_SECRET/);
    });
});
describe("run lock", () => {
    it("lets only one alert run through at a time", async () => {
        let release: () => void = () => undefined;
        const first = withRunLock(() => new Promise<string>((r) => (release = () => r("done"))));
        const second = await withRunLock(async () => "second");
        expect(second.ran).toBe(false);
        release();
        expect(await first).toEqual({ ran: true, value: "done" });
        expect(await withRunLock(async () => "third")).toEqual({ ran: true, value: "third" });
    });
});
describe("instrumentation scheduler", () => {
    it("does nothing unless enabled, on the Node runtime, outside builds", async () => {
        vi.stubEnv("NEXT_RUNTIME", "nodejs");
        await register();
        expect(schedulerGlobal()).toBeUndefined();
        vi.stubEnv("ALERTS_SCHEDULER_ENABLED", "true");
        vi.stubEnv("NEXT_PHASE", "phase-production-build");
        await register();
        expect(schedulerGlobal()).toBeUndefined();
        vi.stubEnv("NEXT_PHASE", "");
        vi.stubEnv("NEXT_RUNTIME", "edge");
        await register();
        expect(schedulerGlobal()).toBeUndefined();
    });
    it("starts one timer that calls /api/cron/alerts over loopback with its token", async () => {
        vi.useFakeTimers();
        vi.stubEnv("NEXT_RUNTIME", "nodejs");
        vi.stubEnv("ALERTS_SCHEDULER_ENABLED", "true");
        vi.stubEnv("ALERTS_INTERVAL_MINUTES", "2");
        vi.stubEnv("PORT", "4321");
        const calls: {
            url: string;
            auth: string | null;
        }[] = [];
        vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
            calls.push({ url, auth: new Headers(init.headers).get("authorization") });
            return new Response("{}", { status: 200 });
        });
        vi.spyOn(console, "log").mockImplementation(() => undefined);
        await register();
        await register();
        const state = schedulerGlobal();
        expect(state?.intervalMs).toBe(5 * 60000);
        expect(state?.token).toMatch(/^[0-9a-f]{64}$/);
        await vi.advanceTimersByTimeAsync(60000);
        await vi.advanceTimersByTimeAsync(5 * 60000);
        expect(calls).toHaveLength(2);
        expect(calls[0]).toEqual({ url: "http://127.0.0.1:4321/api/cron/alerts", auth: `Bearer ${state?.token}` });
        expect(authorizeCron(req(`Bearer ${state?.token}`))).toBe("internal");
        expect(schedulerGlobal()?.lastTickStatus).toBe(200);
    });
});
