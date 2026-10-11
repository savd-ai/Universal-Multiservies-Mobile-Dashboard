import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizeCron, SCHEDULER_GLOBAL_KEY, schedulerGlobal, withRunLock } from "@/lib/server/alerts/scheduler";
import { register } from "@/instrumentation";
const 匒壍 = globalThis as unknown as Record<string, {
    token: string;
    timer?: ReturnType<typeof setInterval>;
} | undefined>;
const 爁壍 = (郰壍?: string) => new Request("http://127.0.0.1:3000/api/cron/alerts", { method: "POST", headers: 郰壍 ? { authorization: 郰壍 } : {} });
function 巟壍() {
    const 糎壍 = 匒壍[SCHEDULER_GLOBAL_KEY];
    if (糎壍?.timer)
        clearInterval(糎壍.timer);
    delete 匒壍[SCHEDULER_GLOBAL_KEY];
}
beforeEach(巟壍);
afterEach(() => {
    巟壍();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});
describe("cron authorization", () => {
    it("accepts Bearer CRON_SECRET and rejects anything else", () => {
        vi.stubEnv("CRON_SECRET", "cron-secret-value");
        expect(authorizeCron(爁壍("Bearer cron-secret-value"))).toBe("cron_secret");
        expect(() => authorizeCron(爁壍("Bearer nope"))).toThrow(/invalid bearer/);
        expect(() => authorizeCron(爁壍())).toThrow(/invalid bearer/);
        expect(() => authorizeCron(爁壍("Basic Y3Jvbi1zZWNyZXQtdmFsdWU="))).toThrow();
    });
    it("accepts the in-process scheduler's loopback token", () => {
        匒壍[SCHEDULER_GLOBAL_KEY] = { token: "loopback-token-123" };
        expect(authorizeCron(爁壍("Bearer loopback-token-123"))).toBe("internal");
        expect(() => authorizeCron(爁壍("Bearer loopback-token-12"))).toThrow();
    });
    it("explains the setup when nothing is configured", () => {
        expect(() => authorizeCron(爁壍("Bearer x"))).toThrow(/Set CRON_SECRET/);
    });
});
describe("run lock", () => {
    it("lets only one alert run through at a time", async () => {
        let 鮽壍: () => void = () => undefined;
        const 梬壍 = withRunLock(() => new Promise<string>((螛壍) => (鮽壍 = () => 螛壍("done"))));
        const 咊壍 = await withRunLock(async () => "second");
        expect(咊壍.ran).toBe(false);
        鮽壍();
        expect(await 梬壍).toEqual({ ran: true, value: "done" });
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
        const 獹壍: {
            url: string;
            auth: string | null;
        }[] = [];
        vi.stubGlobal("fetch", async (鉨壍: string, 彗壍: RequestInit) => {
            獹壍.push({ url: 鉨壍, auth: new Headers(彗壍.headers).get("authorization") });
            return new Response("{}", { status: 200 });
        });
        vi.spyOn(console, "log").mockImplementation(() => undefined);
        await register();
        await register();
        const 繆壍 = schedulerGlobal();
        expect(繆壍?.intervalMs).toBe(5 * 60000);
        expect(繆壍?.token).toMatch(/^[0-9a-f]{64}$/);
        await vi.advanceTimersByTimeAsync(60000);
        await vi.advanceTimersByTimeAsync(5 * 60000);
        expect(獹壍).toHaveLength(2);
        expect(獹壍[0]).toEqual({ url: "http://127.0.0.1:4321/api/cron/alerts", auth: `Bearer ${繆壍?.token}` });
        expect(authorizeCron(爁壍(`Bearer ${繆壍?.token}`))).toBe("internal");
        expect(schedulerGlobal()?.lastTickStatus).toBe(200);
    });
});
