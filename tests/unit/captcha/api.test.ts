import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHROMA_GAP, CHROMA_SOLVED } from "@/lib/domain/captcha/chroma";
import { policyFor } from "@/lib/server/auth/policy";
import { createSession } from "@/lib/server/auth/sessions";
import { completeSetup } from "@/lib/server/auth/setup";
import { now, setClockForTests } from "@/lib/server/clock";
import { getGlobalStore } from "@/lib/server/store";
import { resetServerState, restoreServerState } from "../analytics/helpers";

// One move from solved (tile 24 sits in the gap's home), so the tests can solve it with [24].
const ONE_MOVE_BOARD = [...CHROMA_SOLVED.slice(0, 23), CHROMA_GAP, 24];
vi.mock("@/lib/domain/captcha/chroma", async (orig) => ({ ...(await orig<typeof import("@/lib/domain/captcha/chroma")>()), scrambleChroma: () => [...ONE_MOVE_BOARD] }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), connection: async () => undefined }));

const captchaRoute = await import("@/app/api/captcha/route");
const statusRoute = await import("@/app/api/status/route");
const meRoute = await import("@/app/api/me/route");
const queryRoute = await import("@/app/api/query/route");

const BASE = "http://localhost:3000";
const get = (path: string, cookie: string) => new Request(`${BASE}${path}`, { headers: { cookie } });
const post = (path: string, body: unknown, cookie: string) =>
  new Request(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });

async function signIn(): Promise<{ cookie: string; sessionId: string }> {
  const admin = (await getGlobalStore().users.list((user) => user.role === "agency_admin"))[0]!;
  const { token, session } = await createSession(admin, new Request(`${BASE}/`), "password");
  return { cookie: `savd-session=${token}`, sessionId: session.id };
}

beforeEach(async () => {
  resetServerState();
  vi.stubEnv("AUTH_MODE", "required");
  vi.stubEnv("AUTH_SETUP_TOKEN", "captcha-test-code");
  await completeSetup({ code: "captcha-test-code", email: "admin@savd.ai", name: "Admin", password: "correct horse battery" });
});
afterEach(() => restoreServerState());

describe("captcha policy", () => {
  it("needs a session but not a solved puzzle", () => {
    expect(policyFor("GET", "/api/captcha")).toEqual({ kind: "session" });
    expect(policyFor("POST", "/api/captcha")).toEqual({ kind: "session" });
    expect(policyFor("DELETE", "/api/captcha")).toBeNull();
  });
});

describe("captcha gate on the API", () => {
  it("refuses every data route until the session solves the puzzle", async () => {
    const { cookie } = await signIn();
    const status = await statusRoute.GET(get("/api/status", cookie));
    expect(status.status).toBe(403);
    expect((await status.json()).error.details).toEqual({ reason: "captcha_required" });
    const query = await queryRoute.POST(post("/api/query", { metrics: ["cost"] }, cookie));
    expect(query.status).toBe(403);
    expect((await meRoute.GET(get("/api/me", cookie))).status).toBe(200);
  });

  it("issues a session-bound board, rejects unsolved and illegal plays, then opens on a solve", async () => {
    const { cookie, sessionId } = await signIn();
    const issued = await (await captchaRoute.GET(get("/api/captcha", cookie))).json();
    expect(issued).toMatchObject({ required: true, passed: false, challenge: { board: ONE_MOVE_BOARD, size: 5 } });
    const token = issued.challenge.token as string;

    const unsolved = await captchaRoute.POST(post("/api/captcha", { token, moves: [] }, cookie));
    expect(unsolved.status).toBe(403);
    expect((await unsolved.json()).error.details).toEqual({ reason: "captcha_failed", verdict: "unsolved", moves: 0 });

    const illegal = await captchaRoute.POST(post("/api/captcha", { token, moves: [1] }, cookie));
    expect((await illegal.json()).error.details).toMatchObject({ reason: "captcha_failed", verdict: "illegal_move" });

    const other = await signIn();
    const stolen = await captchaRoute.POST(post("/api/captcha", { token, moves: [24] }, other.cookie));
    expect(stolen.status).toBe(403);
    expect((await stolen.json()).error.details).toEqual({ reason: "captcha_invalid" });
    expect((await statusRoute.GET(get("/api/status", other.cookie))).status).toBe(403);

    const solved = await captchaRoute.POST(post("/api/captcha", { token, moves: [24] }, cookie));
    expect(solved.status).toBe(200);
    expect((await getGlobalStore().sessions.get(sessionId))?.captchaPassedAt).toBeTruthy();
    expect((await statusRoute.GET(get("/api/status", cookie))).status).toBe(200);
    expect(await (await captchaRoute.GET(get("/api/captcha", cookie))).json()).toEqual({ required: true, passed: true, challenge: null });
  });

  it("rejects forged and expired boards", async () => {
    const { cookie } = await signIn();
    const { challenge } = await (await captchaRoute.GET(get("/api/captcha", cookie))).json();
    const [payload] = (challenge.token as string).split(".");
    const forged = await captchaRoute.POST(post("/api/captcha", { token: `${payload}.AAAA`, moves: [24] }, cookie));
    expect((await forged.json()).error.details).toEqual({ reason: "captcha_invalid" });
    const later = now().getTime() + 2 * 60 * 60 * 1000; // past the 1 h board TTL, inside the session
    setClockForTests(() => new Date(later));
    const expired = await captchaRoute.POST(post("/api/captcha", { token: challenge.token, moves: [24] }, cookie));
    expect(expired.status).toBe(403);
    expect((await expired.json()).error.details).toEqual({ reason: "captcha_expired" });
  });

  it("a new session (after logout) has to solve it again", async () => {
    const first = await signIn();
    const { challenge } = await (await captchaRoute.GET(get("/api/captcha", first.cookie))).json();
    expect((await captchaRoute.POST(post("/api/captcha", { token: challenge.token, moves: [24] }, first.cookie))).status).toBe(200);
    const second = await signIn();
    expect((await statusRoute.GET(get("/api/status", second.cookie))).status).toBe(403);
  });

  it("validates the body", async () => {
    const { cookie } = await signIn();
    const res = await captchaRoute.POST(post("/api/captcha", { token: "x", moves: [0] }, cookie));
    expect(res.status).toBe(400);
  });
});
