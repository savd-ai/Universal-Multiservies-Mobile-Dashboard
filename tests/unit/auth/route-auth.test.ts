import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/server/auth/clients";
import { createSession } from "@/lib/server/auth/sessions";
import { completeSetup } from "@/lib/server/auth/setup";
import { createUser } from "@/lib/server/auth/users";
import { toPrincipal } from "@/lib/server/auth/principal";
import { getGlobalStore } from "@/lib/server/store";
import { resetServerState, restoreServerState } from "../analytics/helpers";
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), connection: async () => undefined }));
const health = await import("@/app/api/health/route");
const status = await import("@/app/api/status/route");
const dashboards = await import("@/app/api/dashboards/route");
const me = await import("@/app/api/me/route");
const accounts = await import("@/app/api/accounts/route");
const base = "http://localhost:3000";
const handler = (path: string, cookie?: string) => new Request(`${base}${path}`, { headers: cookie ? { cookie } : {} });
const post = (path: string, body: unknown, cookie?: string) => new Request(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
async function signIn(email: string, role: "agency_admin" | "client_viewer", clientId: string | null = null): Promise<string> {
    let user = (await getGlobalStore().users.list((u) => u.email === email))[0];
    if (!user) {
        const admin = (await getGlobalStore().users.list((u) => u.role === "agency_admin"))[0]!;
        const created = await createUser(toPrincipal(admin, null), { email, name: email, role, clientId });
        user = await getGlobalStore().users.update(created.user.id, { status: "active" });
    }
    const { token } = await createSession(user, handler("/"), "password");
    return `savd-session=${token}`;
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
        const res = await health.GET(handler("/api/health"));
        expect(res.status).toBe(200);
    });
    it("answers 401 without a valid session", async () => {
        const res = await status.GET(handler("/api/status"));
        expect(res.status).toBe(401);
        expect((await res.json()).error.code).toBe("UNAUTHORIZED");
        expect((await status.GET(handler("/api/status", "savd-session=forged-token-forged-token-forged"))).status).toBe(401);
    });
    it("serves a signed-in admin and refuses a write the role can't do", async () => {
        const adminCookie = await signIn("admin@savd.ai", "agency_admin");
        expect((await status.GET(handler("/api/status", adminCookie))).status).toBe(200);
        const acme = await createClient({ name: "Acme Running Co.", accountIds: ["4821193307"], notes: "", startFrom: "templates" });
        const viewerCookie = await signIn("viewer@acme.test", "client_viewer", acme.id);
        const denied = await dashboards.POST(post("/api/dashboards", { template: "blank" }, viewerCookie));
        expect(denied.status).toBe(403);
        expect((await denied.json()).error.details).toMatchObject({ reason: "permission", permission: "dashboards.edit" });
        expect((await dashboards.POST(post("/api/dashboards", { template: "blank" }, adminCookie))).status).toBe(200);
    });
    it("gives client users only their accounts and their workspace", async () => {
        const trail = await createClient({ name: "Trail Gear Outlet", accountIds: ["9876543210"], notes: "", startFrom: "templates" });
        const cookie = await signIn("vi@trail.test", "client_viewer", trail.id);
        const list = await (await accounts.GET(handler("/api/accounts", cookie))).json();
        expect(list.accounts.map((a: {
            id: string;
        }) => a.id)).toEqual(["9876543210"]);
        const who = await (await me.GET(handler("/api/me", cookie))).json();
        expect(who.workspace).toEqual({ id: trail.id, kind: "client", name: "Trail Gear Outlet" });
        expect(who.permissions).toEqual(["accounts.read", "portfolio.read"]);
        const foreign = await status.GET(new Request(`${base}/api/status`, { headers: { cookie, "x-savd-account": "4821193307" } }));
        expect(foreign.status).toBe(403);
    });
    it("with AUTH_REQUIRE_2FA only the profile endpoints work until 2FA is set up", async () => {
        vi.stubEnv("AUTH_REQUIRE_2FA", "agency");
        const cookie = await signIn("admin@savd.ai", "agency_admin");
        const blocked = await status.GET(handler("/api/status", cookie));
        expect(blocked.status).toBe(403);
        expect((await blocked.json()).error.details).toMatchObject({ reason: "mfa_setup_required" });
        const who = await (await me.GET(handler("/api/me", cookie))).json();
        expect(who.mfaSetupRequired).toBe(true);
    });
    it("still rejects cross-site writes before anything else", async () => {
        const cookie = await signIn("admin@savd.ai", "agency_admin");
        const req = new Request(`${base}/api/dashboards`, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example", cookie }, body: "{}" });
        expect((await dashboards.POST(req)).status).toBe(403);
    });
});
