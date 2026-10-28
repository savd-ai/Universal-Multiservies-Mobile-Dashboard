import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { now, setClockForTests } from "@/lib/server/clock";
import { base32Decode, hotp, TOTP_STEP_SECONDS } from "@/lib/server/auth/crypto";
import { finishGoogleSignIn, startGoogleSignIn } from "@/lib/server/auth/google";
import { toPrincipal } from "@/lib/server/auth/principal";
import type { UserRecord } from "@/lib/server/auth/records";
import { readCookie, SESSION_COOKIE, validateSession } from "@/lib/server/auth/sessions";
import { completeSetup } from "@/lib/server/auth/setup";
import { createUser, enableMfa, startMfaSetup, updateUser } from "@/lib/server/auth/users";
import { getGlobalStore } from "@/lib/server/store";
import { resetServerState, restoreServerState } from "../analytics/helpers";
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), connection: async () => undefined }));
const callback = await import("@/app/api/auth/google/callback/route");
const mfaStep = await import("@/app/api/auth/login/mfa/route");
const BASE = "https://dash.example";
const CLIENT_ID = "client-123.apps.googleusercontent.com";
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
let admin: UserRecord;
beforeEach(async () => {
    resetServerState();
    vi.stubEnv("AUTH_MODE", "required");
    vi.stubEnv("AUTH_SETUP_TOKEN", "google-test-code");
    vi.stubEnv("AUTH_GOOGLE_CLIENT_ID", CLIENT_ID);
    vi.stubEnv("AUTH_GOOGLE_CLIENT_SECRET", "google-secret-xyz");
    vi.stubEnv("AUTH_GOOGLE_ALLOWED_DOMAINS", "savd.ai");
    vi.stubEnv("APP_BASE_URL", BASE);
    vi.stubEnv("APP_ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
    admin = await completeSetup({ code: "google-test-code", email: "admin@savd.ai", name: "Admin", password: "correct horse battery" });
});
afterEach(() => {
    vi.unstubAllGlobals();
    restoreServerState();
});
function roundTrip(claims: Record<string, unknown>, opts: {
    next?: string;
    state?: string;
    nonce?: string;
} = {}) {
    const start = startGoogleSignIn(new Request(`${BASE}/api/auth/google/start`), opts.next);
    const location = new URL(start.headers.get("location") as string);
    const oauthCookie = (start.headers.get("set-cookie") as string).split(";")[0] as string;
    const idToken = [
        b64({ alg: "RS256", kid: "k1" }),
        b64({ iss: "https://accounts.google.com", aud: CLIENT_ID, exp: Math.floor(now().getTime() / 1000) + 3600, nonce: opts.nonce ?? location.searchParams.get("nonce"), email_verified: true, ...claims }),
        "signature",
    ].join(".");
    const req = new Request(`${BASE}/api/auth/google/callback?code=auth-code&state=${opts.state ?? location.searchParams.get("state")}`, { headers: { cookie: oauthCookie } });
    const fetchToken = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ id_token: idToken }), { status: 200, headers: { "content-type": "application/json" } }));
    return { location, req, fetchToken };
}
describe("Sign in with Google", () => {
    it("starts with PKCE, state and nonce and the configured redirect URI", () => {
        const { location } = roundTrip({ email: "admin@savd.ai" }, { next: "/budget" });
        expect(location.origin + location.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
        expect(Object.fromEntries(location.searchParams)).toMatchObject({ client_id: CLIENT_ID, redirect_uri: `${BASE}/api/auth/google/callback`, response_type: "code", code_challenge_method: "S256" });
        expect(location.searchParams.get("scope")).toContain("openid");
        for (const k of ["state", "nonce", "code_challenge"])
            expect((location.searchParams.get(k) ?? "").length).toBeGreaterThanOrEqual(16);
    });
    it("signs in an invited person, exchanges the code with the verifier and fulfils the invite", async () => {
        const invited = await createUser(toPrincipal(admin, null), { email: "Lee@Partner.example", name: "Lee", role: "agency_member", clientId: null });
        const { req, fetchToken } = roundTrip({ email: "lee@partner.example" }, { next: "/budget" });
        const { user, next } = await finishGoogleSignIn(req, { fetch: fetchToken as unknown as typeof fetch });
        expect(user).toMatchObject({ id: invited.user.id, status: "active" });
        expect(next).toBe("/budget");
        const body = new URLSearchParams(String(fetchToken.mock.calls[0]?.[1]?.body));
        expect(body.get("grant_type")).toBe("authorization_code");
        expect(body.get("code_verifier")?.length).toBeGreaterThanOrEqual(43);
    });
    it("provisions verified accounts of an allowed Workspace domain as agency members and refuses everyone else", async () => {
        const ok = roundTrip({ email: "New.Person@savd.ai", hd: "savd.ai", name: "New Person" });
        const { user } = await finishGoogleSignIn(ok.req, { fetch: ok.fetchToken as unknown as typeof fetch });
        expect(user).toMatchObject({ email: "new.person@savd.ai", role: "agency_member", clientId: null, passwordHash: null });
        const outsider = roundTrip({ email: "someone@gmail.com" });
        await expect(finishGoogleSignIn(outsider.req, { fetch: outsider.fetchToken as unknown as typeof fetch })).rejects.toThrow(/has no access/);
        const spoof = roundTrip({ email: "x@savd.ai" });
        await expect(finishGoogleSignIn(spoof.req, { fetch: spoof.fetchToken as unknown as typeof fetch })).rejects.toThrow(/has no access/);
    });
    it("refuses a tampered state, a wrong nonce or audience, an unverified email, an expired token and disabled people", async () => {
        const cases = [
            roundTrip({ email: "admin@savd.ai" }, { state: "forged-state-forged-state" }),
            roundTrip({ email: "admin@savd.ai" }, { nonce: "not-the-nonce-we-sent" }),
            roundTrip({ email: "admin@savd.ai", aud: "someone-else.apps.googleusercontent.com" }),
            roundTrip({ email: "admin@savd.ai", email_verified: false }),
            roundTrip({ email: "admin@savd.ai", exp: Math.floor(now().getTime() / 1000) - 5 }),
        ];
        for (const c of cases)
            await expect(finishGoogleSignIn(c.req, { fetch: c.fetchToken as unknown as typeof fetch })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
        const member = await createUser(toPrincipal(admin, null), { email: "off@savd.ai", name: "Off", role: "agency_member", clientId: null });
        await updateUser(toPrincipal(admin, null), member.user.id, { status: "disabled" });
        const disabled = roundTrip({ email: "off@savd.ai", hd: "savd.ai" });
        await expect(finishGoogleSignIn(disabled.req, { fetch: disabled.fetchToken as unknown as typeof fetch })).rejects.toThrow(/disabled/);
    });
    it("still asks for the 2FA code when it is on, without putting the challenge in the URL", async () => {
        const t0 = now().getTime();
        const { secret } = await startMfaSetup(admin.id);
        const codeAt = (ms: number) => hotp(base32Decode(secret), Math.floor(ms / 1000 / TOTP_STEP_SECONDS));
        await enableMfa(admin.id, codeAt(t0));
        setClockForTests(() => new Date(t0 + 2 * TOTP_STEP_SECONDS * 1000));
        const { req, fetchToken } = roundTrip({ email: "admin@savd.ai" }, { next: "/clients" });
        vi.stubGlobal("fetch", fetchToken);
        const res = await callback.GET(req);
        expect(res.status).toBe(302);
        expect(res.headers.get("location")).toBe("/login?step=2fa");
        const cookies = res.headers.getSetCookie();
        const mfaCookie = cookies.find((c) => c.startsWith("savd-mfa="));
        expect(mfaCookie).toMatch(/HttpOnly/);
        expect(mfaCookie).toMatch(/Path=\/api\/auth\/login\/mfa/);
        expect(cookies.some((c) => c.startsWith(`${SESSION_COOKIE}=`))).toBe(false);
        const challenge = (mfaCookie as string).split(";")[0] as string;
        const post = (code: string) => new Request(`${BASE}/api/auth/login/mfa`, { method: "POST", headers: { "content-type": "application/json", cookie: challenge }, body: JSON.stringify({ code }) });
        expect((await mfaStep.POST(post("000000" === codeAt(now().getTime()) ? "111111" : "000000"))).status).toBe(401);
        const ok = await mfaStep.POST(post(codeAt(now().getTime())));
        expect(ok.status).toBe(200);
        expect((await ok.json()).next).toBe("/clients");
        const setCookie = ok.headers.getSetCookie();
        expect(setCookie.find((c) => c.startsWith("savd-mfa="))).toMatch(/Max-Age=0/);
        const token = readCookie(setCookie.find((c) => c.startsWith(`${SESSION_COOKIE}=`)), SESSION_COOKIE);
        const session = await validateSession(token);
        expect(session?.user.id).toBe(admin.id);
        expect(session?.session.method).toBe("google");
        expect((await getGlobalStore().authTokens.list((r) => r.kind === "mfa_challenge" && !r.usedAt)).length).toBe(0);
    });
});
