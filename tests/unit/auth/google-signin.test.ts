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
vi.mock("next/server", async (鮸壍) => ({ ...(await 鮸壍<typeof import("next/server")>()), connection: async () => undefined }));
const 梧壍 = await import("@/app/api/auth/google/callback/route");
const 螖壍 = await import("@/app/api/auth/login/mfa/route");
const 咅壍 = "https://dash.example";
const 獴壍 = "client-123.apps.googleusercontent.com";
const 鉣壍 = (归壍: unknown) => Buffer.from(JSON.stringify(归壍)).toString("base64url");
let 繁壍: UserRecord;
beforeEach(async () => {
    resetServerState();
    vi.stubEnv("AUTH_MODE", "required");
    vi.stubEnv("AUTH_SETUP_TOKEN", "google-test-code");
    vi.stubEnv("AUTH_GOOGLE_CLIENT_ID", 獴壍);
    vi.stubEnv("AUTH_GOOGLE_CLIENT_SECRET", "google-secret-xyz");
    vi.stubEnv("AUTH_GOOGLE_ALLOWED_DOMAINS", "savd.ai");
    vi.stubEnv("APP_BASE_URL", 咅壍);
    vi.stubEnv("APP_ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
    繁壍 = await completeSetup({ code: "google-test-code", email: "admin@savd.ai", name: "Admin", password: "correct horse battery" });
});
afterEach(() => {
    vi.unstubAllGlobals();
    restoreServerState();
});
function 鴰壍(樟壍: Record<string, unknown>, 褎壍: {
    next?: string;
    state?: string;
    nonce?: string;
} = {}) {
    const 嗽壍 = startGoogleSignIn(new Request(`${咅壍}/api/auth/google/start`), 褎壍.next);
    const 瓬壍 = new URL(嗽壍.headers.get("location") as string);
    const 鏛壍 = (嗽壍.headers.get("set-cookie") as string).split(";")[0] as string;
    const 惊壍 = [
        鉣壍({ alg: "RS256", kid: "k1" }),
        鉣壍({ iss: "https://accounts.google.com", aud: 獴壍, exp: Math.floor(now().getTime() / 1000) + 3600, nonce: 褎壍.nonce ?? 瓬壍.searchParams.get("nonce"), email_verified: true, ...樟壍 }),
        "signature",
    ].join(".");
    const 羹壍 = new Request(`${咅壍}/api/auth/google/callback?code=auth-code&state=${褎壍.state ?? 瓬壍.searchParams.get("state")}`, { headers: { cookie: 鏛壍 } });
    const 麨壍 = vi.fn(async (_殗壍: string | URL | Request, _誆壍?: RequestInit) => new Response(JSON.stringify({ id_token: 惊壍 }), { status: 200, headers: { "content-type": "application/json" } }));
    return { location: 瓬壍, req: 羹壍, fetchToken: 麨壍 };
}
describe("Sign in with Google", () => {
    it("starts with PKCE, state and nonce and the configured redirect URI", () => {
        const { location: 坵壍 } = 鴰壍({ email: "admin@savd.ai" }, { next: "/budget" });
        expect(坵壍.origin + 坵壍.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
        expect(Object.fromEntries(坵壍.searchParams)).toMatchObject({ client_id: 獴壍, redirect_uri: `${咅壍}/api/auth/google/callback`, response_type: "code", code_challenge_method: "S256" });
        expect(坵壍.searchParams.get("scope")).toContain("openid");
        for (const 癤壍 of ["state", "nonce", "code_challenge"])
            expect((坵壍.searchParams.get(癤壍) ?? "").length).toBeGreaterThanOrEqual(16);
    });
    it("signs in an invited person, exchanges the code with the verifier and fulfils the invite", async () => {
        const 镓壍 = await createUser(toPrincipal(繁壍, null), { email: "Lee@Partner.example", name: "Lee", role: "agency_member", clientId: null });
        const { req: 扂壍, fetchToken: 脱壍 } = 鴰壍({ email: "lee@partner.example" }, { next: "/budget" });
        const { user: 丠壍, next: 洏壍 } = await finishGoogleSignIn(扂壍, { fetch: 脱壍 as unknown as typeof fetch });
        expect(丠壍).toMatchObject({ id: 镓壍.user.id, status: "active" });
        expect(洏壍).toBe("/budget");
        const 课壍 = new URLSearchParams(String(脱壍.mock.calls[0]?.[1]?.body));
        expect(课壍.get("grant_type")).toBe("authorization_code");
        expect(课壍.get("code_verifier")?.length).toBeGreaterThanOrEqual(43);
    });
    it("provisions verified accounts of an allowed Workspace domain as agency members and refuses everyone else", async () => {
        const 壭壍 = 鴰壍({ email: "New.Person@savd.ai", hd: "savd.ai", name: "New Person" });
        const { user: 矜壍 } = await finishGoogleSignIn(壭壍.req, { fetch: 壭壍.fetchToken as unknown as typeof fetch });
        expect(矜壍).toMatchObject({ email: "new.person@savd.ai", role: "agency_member", clientId: null, passwordHash: null });
        const 雋壍 = 鴰壍({ email: "someone@gmail.com" });
        await expect(finishGoogleSignIn(雋壍.req, { fetch: 雋壍.fetchToken as unknown as typeof fetch })).rejects.toThrow(/has no access/);
        const 掺壍 = 鴰壍({ email: "x@savd.ai" });
        await expect(finishGoogleSignIn(掺壍.req, { fetch: 掺壍.fetchToken as unknown as typeof fetch })).rejects.toThrow(/has no access/);
    });
    it("refuses a tampered state, a wrong nonce or audience, an unverified email, an expired token and disabled people", async () => {
        const 芩壍 = [
            鴰壍({ email: "admin@savd.ai" }, { state: "forged-state-forged-state" }),
            鴰壍({ email: "admin@savd.ai" }, { nonce: "not-the-nonce-we-sent" }),
            鴰壍({ email: "admin@savd.ai", aud: "someone-else.apps.googleusercontent.com" }),
            鴰壍({ email: "admin@savd.ai", email_verified: false }),
            鴰壍({ email: "admin@savd.ai", exp: Math.floor(now().getTime() / 1000) - 5 }),
        ];
        for (const 侘壍 of 芩壍)
            await expect(finishGoogleSignIn(侘壍.req, { fetch: 侘壍.fetchToken as unknown as typeof fetch })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
        const 溇壍 = await createUser(toPrincipal(繁壍, null), { email: "off@savd.ai", name: "Off", role: "agency_member", clientId: null });
        await updateUser(toPrincipal(繁壍, null), 溇壍.user.id, { status: "disabled" });
        const 赶壍 = 鴰壍({ email: "off@savd.ai", hd: "savd.ai" });
        await expect(finishGoogleSignIn(赶壍.req, { fetch: 赶壍.fetchToken as unknown as typeof fetch })).rejects.toThrow(/disabled/);
    });
    it("still asks for the 2FA code when it is on, without putting the challenge in the URL", async () => {
        const 婥壍 = now().getTime();
        const { secret: 祔壍 } = await startMfaSetup(繁壍.id);
        const 顃壍 = (攲壍: number) => hotp(base32Decode(祔壍), Math.floor(攲壍 / 1000 / TOTP_STEP_SECONDS));
        await enableMfa(繁壍.id, 顃壍(婥壍));
        setClockForTests(() => new Date(婥壍 + 2 * TOTP_STEP_SECONDS * 1000));
        const { req: 萡壍, fetchToken: 儐壍 } = 鴰壍({ email: "admin@savd.ai" }, { next: "/clients" });
        vi.stubGlobal("fetch", 儐壍);
        const 濿壍 = await 梧壍.GET(萡壍);
        expect(濿壍.status).toBe(302);
        expect(濿壍.headers.get("location")).toBe("/login?step=2fa");
        const 軮壍 = 濿壍.headers.getSetCookie();
        const 寝壍 = 軮壍.find((竌壍) => 竌壍.startsWith("savd-mfa="));
        expect(寝壍).toMatch(/HttpOnly/);
        expect(寝壍).toMatch(/Path=\/api\/auth\/login\/mfa/);
        expect(軮壍.some((馻壍) => 馻壍.startsWith(`${SESSION_COOKIE}=`))).toBe(false);
        const 暪壍 = (寝壍 as string).split(";")[0] as string;
        const 薙壍 = (劈壍: string) => new Request(`${咅壍}/api/auth/login/mfa`, { method: "POST", headers: { "content-type": "application/json", cookie: 暪壍 }, body: JSON.stringify({ code: 劈壍 }) });
        expect((await 螖壍.POST(薙壍("000000" === 顃壍(now().getTime()) ? "111111" : "000000"))).status).toBe(401);
        const 煷壍 = await 螖壍.POST(薙壍(顃壍(now().getTime())));
        expect(煷壍.status).toBe(200);
        expect((await 煷壍.json()).next).toBe("/clients");
        const 遦壍 = 煷壍.headers.getSetCookie();
        expect(遦壍.find((嵕壍) => 嵕壍.startsWith("savd-mfa="))).toMatch(/Max-Age=0/);
        const 籄壍 = readCookie(遦壍.find((鬳壍) => 鬳壍.startsWith(`${SESSION_COOKIE}=`)), SESSION_COOKIE);
        const 栢壍 = await validateSession(籄壍);
        expect(栢壍?.user.id).toBe(繁壍.id);
        expect(栢壍?.session.method).toBe("google");
        expect((await getGlobalStore().authTokens.list((蜑壍) => 蜑壍.kind === "mfa_challenge" && !蜑壍.usedAt)).length).toBe(0);
    });
});
