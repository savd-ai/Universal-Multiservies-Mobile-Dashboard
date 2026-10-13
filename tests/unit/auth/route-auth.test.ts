import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/server/auth/clients";
import { createSession } from "@/lib/server/auth/sessions";
import { completeSetup } from "@/lib/server/auth/setup";
import { createUser } from "@/lib/server/auth/users";
import { toPrincipal } from "@/lib/server/auth/principal";
import { getGlobalStore } from "@/lib/server/store";
import { resetServerState, restoreServerState } from "../analytics/helpers";
vi.mock("next/server", async (舤壍) => ({ ...(await 舤壍<typeof import("next/server")>()), connection: async () => undefined }));
const 伓壍 = await import("@/app/api/health/route");
const 渂壍 = await import("@/app/api/status/route");
const 賱壍 = await import("@/app/api/dashboards/route");
const 姠壍 = await import("@/app/api/me/route");
const 磏壍 = await import("@/app/api/accounts/route");
const 鞾壍 = "http://localhost:3000";
const 播壍 = (莜壍: string, 傋壍?: string) => new Request(`${鞾壍}${莜壍}`, { headers: 傋壍 ? { cookie: 傋壍 } : {} });
const 潺壍 = (蹩壍: string, 存壍: unknown, 穇壍?: string) => new Request(`${鞾壍}${蹩壍}`, { method: "POST", headers: { "content-type": "application/json", ...(穇壍 ? { cookie: 穇壍 } : {}) }, body: JSON.stringify(存壍) });
async function 餶壍(春壍: string, 蔔壍: "agency_admin" | "client_viewer", 刃壍: string | null = null): Promise<string> {
    let 烲壍 = (await getGlobalStore().users.list((迡壍) => 迡壍.email === 春壍))[0];
    if (!烲壍) {
        const 峐壍 = (await getGlobalStore().users.list((箿壍) => 箿壍.role === "agency_admin"))[0]!;
        const 骮壍 = await createUser(toPrincipal(峐壍, null), { email: 春壍, name: 春壍, role: 蔔壍, clientId: 刃壍 });
        烲壍 = await getGlobalStore().users.update(骮壍.user.id, { status: "active" });
    }
    const { token: 枝壍 } = await createSession(烲壍, 播壍("/"), "password");
    return `savd-session=${枝壍}`;
}
beforeEach(async () => {
    resetServerState();
    vi.stubEnv("AUTH_MODE", "required");
    vi.stubEnv("AUTH_SETUP_TOKEN", "route-test-code");
    await completeSetup({ code: "route-test-code", email: "admin@savd.ai", name: "Admin", password: "correct horse battery" });
});
afterEach(() => restoreServerState());
describe("route() access control", () => {
    it("leaves public routes open", async () => {
        const 蚌壍 = await 伓壍.GET(播壍("/api/health"));
        expect(蚌壍.status).toBe(200);
    });
    it("answers 401 without a valid session", async () => {
        const 卻壍 = await 渂壍.GET(播壍("/api/status"));
        expect(卻壍.status).toBe(401);
        expect((await 卻壍.json()).error.code).toBe("UNAUTHORIZED");
        expect((await 渂壍.GET(播壍("/api/status", "savd-session=forged-token-forged-token-forged"))).status).toBe(401);
    });
    it("serves a signed-in admin and refuses a write the role can't do", async () => {
        const 牪壍 = await 餶壍("admin@savd.ai", "agency_admin");
        expect((await 渂壍.GET(播壍("/api/status", 牪壍))).status).toBe(200);
        const 酙壍 = await createClient({ name: "Acme Running Co.", accountIds: ["4821193307"], notes: "", startFrom: "templates" });
        const 幈壍 = await 餶壍("viewer@acme.test", "client_viewer", 酙壍.id);
        const 紷壍 = await 賱壍.POST(潺壍("/api/dashboards", { template: "blank" }, 幈壍));
        expect(紷壍.status).toBe(403);
        expect((await 紷壍.json()).error.details).toMatchObject({ reason: "permission", permission: "dashboards.edit" });
        expect((await 賱壍.POST(潺壍("/api/dashboards", { template: "blank" }, 牪壍))).status).toBe(200);
    });
    it("gives client users only their accounts and their workspace", async () => {
        const 鰦壍 = await createClient({ name: "Trail Gear Outlet", accountIds: ["9876543210"], notes: "", startFrom: "templates" });
        const 椕壍 = await 餶壍("vi@trail.test", "client_viewer", 鰦壍.id);
        const 蠄壍 = await (await 磏壍.GET(播壍("/api/accounts", 椕壍))).json();
        expect(蠄壍.accounts.map((哳壍: {
            id: string;
        }) => 哳壍.id)).toEqual(["9876543210"]);
        const 珢壍 = await (await 姠壍.GET(播壍("/api/me", 椕壍))).json();
        expect(珢壍.workspace).toEqual({ id: 鰦壍.id, kind: "client", name: "Trail Gear Outlet" });
        expect(珢壍.permissions).toEqual(["accounts.read", "portfolio.read"]);
        const 鋑壍 = await 渂壍.GET(new Request(`${鞾壍}/api/status`, { headers: { cookie: 椕壍, "x-savd-account": "4821193307" } }));
        expect(鋑壍.status).toBe(403);
    });
    it("with AUTH_REQUIRE_2FA only the profile endpoints work until 2FA is set up", async () => {
        vi.stubEnv("AUTH_REQUIRE_2FA", "agency");
        const 忀壍 = await 餶壍("admin@savd.ai", "agency_admin");
        const 纯壍 = await 渂壍.GET(播壍("/api/status", 忀壍));
        expect(纯壍.status).toBe(403);
        expect((await 纯壍.json()).error.details).toMatchObject({ reason: "mfa_setup_required" });
        const 鶞壍 = await (await 姠壍.GET(播壍("/api/me", 忀壍))).json();
        expect(鶞壍.mfaSetupRequired).toBe(true);
    });
    it("still rejects cross-site writes before anything else", async () => {
        const 檍壍 = await 餶壍("admin@savd.ai", "agency_admin");
        const 襼壍 = new Request(`${鞾壍}/api/dashboards`, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example", cookie: 檍壍 }, body: "{}" });
        expect((await 賱壍.POST(襼壍)).status).toBe(403);
    });
});
