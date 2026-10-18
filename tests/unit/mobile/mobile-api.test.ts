import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { policyFor } from "@/lib/server/auth/policy";
import { completeSetup } from "@/lib/server/auth/setup";
import { createUser } from "@/lib/server/auth/users";
import { toPrincipal } from "@/lib/server/auth/principal";
import { getGlobalStore } from "@/lib/server/store";
import { NOW_ISO, resetServerState, restoreServerState } from "../analytics/helpers";

vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => undefined }));

const login = await import("@/app/api/auth/mobile/login/route");
const logout = await import("@/app/api/auth/mobile/logout/route");
const overview = await import("@/app/api/mobile/overview/route");
const notifications = await import("@/app/api/mobile/notifications/route");
const ack = await import("@/app/api/mobile/notifications/ack/route");
const device = await import("@/app/api/mobile/device/route");
const evaluate = await import("@/app/api/anomalies/evaluate/route");
const summary = await import("@/app/api/history/summary/route");

const BASE = "http://localhost:3000";
const DEVICE = { platform: "ios", name: "Test iPhone", appVersion: "1.0.0", osVersion: "18.2" };
let ip = 0;
const json = (method: string, path: string, body: unknown, token?: string) =>
  new Request(`${BASE}${path}`, { method, headers: { "content-type": "application/json", "x-real-ip": `10.1.0.${++ip}`, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
const get = (path: string, token?: string) => new Request(`${BASE}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

async function signIn(email = "admin@savd.ai", password = "correct horse battery"): Promise<{ token: string; deviceId: string }> {
  const res = await login.POST(json("POST", "/api/auth/mobile/login", { email, password, device: DEVICE }));
  expect(res.status).toBe(200);
  expect(res.headers.get("set-cookie")).toBeNull();
  const body = await res.json();
  expect(body).toMatchObject({ ok: true, user: { email } });
  return { token: body.token, deviceId: body.deviceId };
}

beforeEach(async () => {
  resetServerState();
  vi.stubEnv("AUTH_MODE", "required");
  vi.stubEnv("AUTH_SETUP_TOKEN", "mobile-test-code");
  await completeSetup({ code: "mobile-test-code", email: "admin@savd.ai", name: "Admin", password: "correct horse battery" });
});
afterEach(() => restoreServerState());

describe("mobile API", () => {
  it("keeps sign-in public and the rest behind a session", () => {
    expect(policyFor("POST", "/api/auth/mobile/login")).toEqual({ kind: "public" });
    expect(policyFor("PUT", "/api/mobile/device")).toEqual({ kind: "session" });
    expect(policyFor("POST", "/api/mobile/notifications/ack")).toEqual({ kind: "permission", permission: "accounts.read" });
    expect(policyFor("GET", "/api/history/status")).toEqual({ kind: "permission", permission: "system.manage" });
  });

  it("signs in with a bearer token, no cookie, and refuses bad passwords and junk tokens", async () => {
    const { token, deviceId } = await signIn();
    expect(token.length).toBeGreaterThan(30);
    expect(deviceId).toBeTruthy();
    const session = (await getGlobalStore().sessions.list(() => true))[0]!;
    expect(session.method).toBe("mobile");
    expect(Date.parse(session.expiresAt) - Date.parse(NOW_ISO)).toBe(30 * 86400000);
    expect(Date.parse(session.idleExpiresAt) - Date.parse(NOW_ISO)).toBe(14 * 86400000);
    expect((await login.POST(json("POST", "/api/auth/mobile/login", { email: "admin@savd.ai", password: "wrong password!", device: DEVICE }))).status).toBe(401);
    expect((await overview.GET(get("/api/mobile/overview", "not-a-real-token-but-long-enough"))).status).toBe(401);
    expect((await overview.GET(get("/api/mobile/overview"))).status).toBe(401);
  });

  it("serves the overview, the notification inbox, device settings, receipts and the summary", async () => {
    const { token } = await signIn();
    const view = await (await overview.GET(get("/api/mobile/overview?range=last_7d", token))).json();
    expect(view.kpis.cost).toBeGreaterThan(0);
    expect(view.daily).toHaveLength(7);
    expect(view.range.preset).toBe("last_7d");

    expect((await evaluate.POST(json("POST", "/api/anomalies/evaluate", {}, token))).status).toBe(200);
    const feed = await (await notifications.GET(get("/api/mobile/notifications?since=0&limit=100", token))).json();
    expect(feed.items.length).toBeGreaterThan(0);
    expect(feed.items.every((item: { polarity: string; severity: string }) => item.polarity === "bad" && item.severity !== "info")).toBe(true);

    const prefs = await (await device.PUT(json("PUT", "/api/mobile/device", { minSeverity: "critical" }, token))).json();
    expect(prefs.device).toMatchObject({ minSeverity: "critical", enabled: true });
    const critical = await (await notifications.GET(get("/api/mobile/notifications?since=0&limit=100", token))).json();
    expect(critical.items.every((item: { severity: string }) => item.severity === "critical")).toBe(true);

    const opened = await (await ack.POST(json("POST", "/api/mobile/notifications/ack", { ids: [feed.items[0].id], opened: true }, token))).json();
    expect(opened.updated).toBe(1);
    const stats = await (await summary.GET(get("/api/history/summary?months=3", token))).json();
    expect(stats.notifications.opened).toBe(1);
    expect(stats.notifications.delivered).toBeGreaterThanOrEqual(feed.items.length);
    expect(stats.runs.count).toBe(1);
  });

  it("signs out: the token stops working and the device is forgotten", async () => {
    const { token } = await signIn();
    expect(await (await logout.POST(json("POST", "/api/auth/mobile/logout", {}, token))).json()).toEqual({ ok: true, revoked: true });
    expect((await overview.GET(get("/api/mobile/overview", token))).status).toBe(401);
  });

  it("gives a viewer without a client no inbox", async () => {
    const admin = (await getGlobalStore().users.list((user) => user.role === "agency_admin"))[0]!;
    const created = await createUser(toPrincipal(admin, null), { email: "viewer@example.com", name: "Viewer", role: "client_viewer", clientId: null });
    const { hashPassword } = await import("@/lib/server/auth/crypto");
    await getGlobalStore().users.update(created.user.id, { status: "active", passwordHash: await hashPassword("viewer password 1") });
    const { token } = await signIn("viewer@example.com", "viewer password 1");
    const res = await notifications.GET(get("/api/mobile/notifications", token));
    expect(res.status).toBe(403);
    expect((await res.json()).error.details).toEqual({ reason: "awaiting_access" });
  });
});
