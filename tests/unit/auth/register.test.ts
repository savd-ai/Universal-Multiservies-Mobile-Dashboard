import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { awaitingAccess, workspaceFor } from "@/lib/domain/auth/roles";
import { safeNext } from "@/lib/domain/contracts/auth";
import { policyFor } from "@/lib/server/auth/policy";
import { getGlobalStore } from "@/lib/server/store";
import { resetServerState, restoreServerState } from "../analytics/helpers";

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), connection: async () => undefined }));

const registerRoute = await import("@/app/api/auth/register/route");
const statusRoute = await import("@/app/api/status/route");
const meRoute = await import("@/app/api/me/route");

const BASE = "http://localhost:3000";
const register = (body: unknown, ip = "1") =>
  registerRoute.POST(new Request(`${BASE}/api/auth/register`, { method: "POST", headers: { "content-type": "application/json", "x-real-ip": `10.0.0.${ip}` }, body: JSON.stringify(body) }));
const cookieOf = (res: Response) => res.headers.get("set-cookie")!.split(";")[0]!;

beforeEach(() => {
  resetServerState();
  vi.stubEnv("AUTH_MODE", "required");
  vi.stubEnv("AUTH_SETUP_TOKEN", "");
});
afterEach(() => restoreServerState());

describe("self-service registration", () => {
  it("is public and kept out of next= redirects", () => {
    expect(policyFor("POST", "/api/auth/register")).toEqual({ kind: "public" });
    expect(safeNext("/register")).toBe("/overview");
  });

  it("makes the first account the agency admin without any setup code", async () => {
    const res = await register({ name: "First Admin", email: "First@Example.com", password: "correct horse battery" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, first: true });
    const [user] = await getGlobalStore().users.list(() => true);
    expect(user).toMatchObject({ email: "first@example.com", role: "agency_admin", clientId: null, status: "active" });
    expect(res.headers.get("set-cookie")).toMatch(/^savd-session=/);
  });

  it("gives later accounts no access until an admin assigns a client", async () => {
    await register({ name: "Admin", email: "admin@example.com", password: "correct horse battery" });
    const res = await register({ name: "Newcomer", email: "new@example.com", password: "another long password" }, "2");
    expect(await res.json()).toMatchObject({ ok: true, first: false });
    const user = (await getGlobalStore().users.list((u) => u.email === "new@example.com"))[0]!;
    expect(user).toMatchObject({ role: "client_viewer", clientId: null, status: "active" });
    expect(awaitingAccess({ role: user.role, clientId: user.clientId })).toBe(true);
    expect(workspaceFor({ role: user.role, clientId: null }, [], null)).toBe("unassigned");

    const cookie = cookieOf(res);
    const status = await statusRoute.GET(new Request(`${BASE}/api/status`, { headers: { cookie } }));
    expect(status.status).toBe(403);
    expect((await status.json()).error.details).toEqual({ reason: "awaiting_access" });
    const me = await (await meRoute.GET(new Request(`${BASE}/api/me`, { headers: { cookie } }))).json();
    expect(me.workspace).toEqual({ id: "unassigned", kind: "client", name: "No client yet" });
    expect(me.user.email).toBe("new@example.com");
  });

  it("refuses duplicate emails and weak input", async () => {
    await register({ name: "Admin", email: "admin@example.com", password: "correct horse battery" });
    const dup = await register({ name: "Again", email: "ADMIN@example.com", password: "correct horse battery" }, "3");
    expect(dup.status).toBe(409);
    expect((await register({ name: "Short", email: "short@example.com", password: "short" }, "4")).status).toBe(400);
    expect((await register({ name: "Bad", email: "not-an-email", password: "correct horse battery" }, "5")).status).toBe(400);
  });

  it("has nothing to register for when sign-in is off", async () => {
    vi.stubEnv("AUTH_MODE", "off");
    expect((await register({ name: "X", email: "x@example.com", password: "correct horse battery" })).status).toBe(409);
  });
});
