import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setClockForTests } from "@/lib/server/clock";
import { hotp, base32Decode, TOTP_STEP_SECONDS } from "@/lib/server/auth/crypto";
import { createClient } from "@/lib/server/auth/clients";
import { toPrincipal } from "@/lib/server/auth/principal";
import type { UserRecord } from "@/lib/server/auth/records";
import { createSession, listUserSessions, validateSession } from "@/lib/server/auth/sessions";
import { completeSetup, setupRequired } from "@/lib/server/auth/setup";
import { acceptLink, changePassword, completeMfaChallenge, createMfaChallenge, createUser, deleteUser, enableMfa, inspectLink, listUsers, startMfaSetup, updateUser, verifyLogin } from "@/lib/server/auth/users";
import { getGlobalStore } from "@/lib/server/store";
import { resetServerState, restoreServerState } from "../analytics/helpers";
const T0 = Date.parse("2026-09-29T12:00:00.000Z");
let t = T0;
const req = () => new Request("https://dash.example/api/auth/login", { headers: { "user-agent": "vitest", "x-forwarded-proto": "https" } });
async function admin(): Promise<UserRecord> {
    return completeSetup({ code: "setup-code-1234", email: "Ada@SAVD.ai", name: "Ada", password: "correct horse battery" });
}
beforeEach(() => {
    resetServerState();
    t = T0;
    setClockForTests(() => new Date(t));
    vi.stubEnv("AUTH_MODE", "required");
    vi.stubEnv("AUTH_SETUP_TOKEN", "setup-code-1234");
    vi.stubEnv("APP_ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
});
afterEach(() => restoreServerState());
describe("first-run setup", () => {
    it("needs the setup code and only works once", async () => {
        expect(await setupRequired()).toBe(true);
        await expect(completeSetup({ code: "wrong", email: "a@b.co", name: "A", password: "correct horse battery" })).rejects.toThrow(/setup code/);
        const u = await admin();
        expect(u).toMatchObject({ email: "ada@savd.ai", role: "agency_admin", status: "active" });
        expect(await setupRequired()).toBe(false);
        await expect(admin()).rejects.toThrow(/already complete/);
    });
});
describe("login", () => {
    it("accepts the right password (any email case) and gives no hint otherwise", async () => {
        await admin();
        expect((await verifyLogin("ADA@savd.ai", "correct horse battery")).email).toBe("ada@savd.ai");
        await expect(verifyLogin("ada@savd.ai", "nope")).rejects.toThrow("Email or password is incorrect");
        await expect(verifyLogin("nobody@savd.ai", "nope")).rejects.toThrow("Email or password is incorrect");
    });
    it("locks the account for 15 minutes after 5 failures", async () => {
        await admin();
        for (let i = 0; i < 5; i++)
            await expect(verifyLogin("ada@savd.ai", "wrong")).rejects.toThrow();
        await expect(verifyLogin("ada@savd.ai", "correct horse battery")).rejects.toThrow(/Too many failed attempts/);
        t += 16 * 60000;
        expect((await verifyLogin("ada@savd.ai", "correct horse battery")).email).toBe("ada@savd.ai");
    });
});
describe("sessions", () => {
    it("stores only the token hash and sets a secure HttpOnly cookie", async () => {
        const u = await admin();
        const { token, cookie, session } = await createSession(u, req(), "password");
        expect(session.id).not.toContain(token);
        expect(cookie).toMatch(/^savd-session=[\w-]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=604800; Secure$/);
        expect((await validateSession(token))?.user.id).toBe(u.id);
        expect(await validateSession("x".repeat(43))).toBeNull();
    });
    it("expires after the idle timeout unless used, and at the absolute limit", async () => {
        const u = await admin();
        const { token } = await createSession(u, req(), "password");
        t += 23 * 3600000;
        expect(await validateSession(token)).not.toBeNull();
        t += 23 * 3600000;
        expect(await validateSession(token)).not.toBeNull();
        t += 25 * 3600000;
        expect(await validateSession(token)).toBeNull();
        const fresh = await createSession(u, req(), "password");
        for (let hours = 20; hours <= 160; hours += 20) {
            t += 20 * 3600000;
            expect(await validateSession(fresh.token)).not.toBeNull();
        }
        t += 20 * 3600000;
        expect(await validateSession(fresh.token)).toBeNull();
    });
    it("a password change signs out every other session", async () => {
        const u = await admin();
        const keep = await createSession(u, req(), "password");
        const other = await createSession(u, req(), "password");
        await changePassword(u.id, "correct horse battery", "an even better passphrase", keep.session.id);
        expect(await validateSession(other.token)).toBeNull();
        expect(await validateSession(keep.token)).not.toBeNull();
        expect((await listUserSessions(u.id, keep.session.id)).map((s) => s.current)).toEqual([true]);
    });
});
describe("invites and administration", () => {
    it("an invite link sets the password once and activates the user", async () => {
        const a = await admin();
        const { user, link } = await createUser(toPrincipal(a, null), { email: "bo@savd.ai", name: "Bo", role: "agency_member", clientId: null });
        expect(user.status).toBe("invited");
        const token = link.url.split("/invite/")[1]!;
        expect(await inspectLink(token)).toMatchObject({ kind: "invite", email: "bo@savd.ai" });
        await acceptLink(token, "bo's long password", "Bo B.");
        expect((await verifyLogin("bo@savd.ai", "bo's long password")).name).toBe("Bo B.");
        await expect(acceptLink(token, "again and again", undefined)).rejects.toThrow(/invalid or has expired/);
    });
    it("client admins manage only their own organization's client users", async () => {
        const a = await admin();
        const ap = toPrincipal(a, null);
        const other = await createClient({ name: "Other Co", accountIds: [], notes: "", startFrom: "templates" });
        const acme = await createClient({ name: "Acme Running Co.", accountIds: ["4821193307"], notes: "", startFrom: "templates" });
        const { user: ca } = await createUser(ap, { email: "cam@acme.test", name: "Cam", role: "client_admin", clientId: acme.id });
        const caRec = (await getGlobalStore().users.get(ca.id))!;
        const cp = toPrincipal({ ...caRec, status: "active" }, null);
        await expect(createUser(cp, { email: "x@acme.test", name: "X", role: "agency_member", clientId: null })).rejects.toThrow(/can't assign/);
        await expect(createUser(cp, { email: "x@other.test", name: "X", role: "client_viewer", clientId: other.id })).rejects.toThrow(/own organization/);
        const { user: viewer } = await createUser(cp, { email: "vi@acme.test", name: "Vi", role: "client_viewer", clientId: acme.id });
        expect(viewer.clientId).toBe(acme.id);
        expect((await listUsers(cp)).map((u) => u.email).sort()).toEqual(["cam@acme.test", "vi@acme.test"]);
        await expect(updateUser(cp, a.id, { status: "disabled" })).rejects.toThrow(/own organization/);
    });
    it("keeps at least one active agency admin and never lets you remove yourself", async () => {
        const a = await admin();
        const ap = toPrincipal(a, null);
        await expect(deleteUser(ap, a.id)).rejects.toThrow(/yourself/);
        await expect(updateUser(ap, a.id, { role: "agency_member" })).rejects.toThrow(/own role/);
        const { user: b } = await createUser(ap, { email: "b@savd.ai", name: "B", role: "agency_admin", clientId: null });
        const bp = toPrincipal({ ...(await getGlobalStore().users.get(b.id))!, status: "active" }, null);
        await expect(updateUser(bp, a.id, { status: "disabled" })).rejects.toThrow(/at least one active agency admin/);
    });
});
describe("two-factor authentication", () => {
    it("enrols with a TOTP code, then requires it (or a recovery code) at sign-in", async () => {
        const a = await admin();
        const { secret } = await startMfaSetup(a.id);
        const code = (ms: number) => hotp(base32Decode(secret), Math.floor(ms / 1000 / TOTP_STEP_SECONDS));
        await expect(enableMfa(a.id, "000000" === code(t) ? "111111" : "000000")).rejects.toThrow(/didn't match/);
        const { recoveryCodes } = await enableMfa(a.id, code(t));
        expect(recoveryCodes).toHaveLength(8);
        const user = await verifyLogin("ada@savd.ai", "correct horse battery");
        expect(user.mfa).not.toBeNull();
        t += 60000;
        const challenge = await createMfaChallenge(user, "/budget");
        expect((await completeMfaChallenge(challenge, code(t))).next).toBe("/budget");
        const again = await createMfaChallenge(user);
        await expect(completeMfaChallenge(again, code(t))).rejects.toThrow(/didn't match/);
        const c1 = await createMfaChallenge(user);
        await completeMfaChallenge(c1, recoveryCodes[0]!);
        const c2 = await createMfaChallenge(user);
        await expect(completeMfaChallenge(c2, recoveryCodes[0]!)).rejects.toThrow();
    });
    it("five wrong codes end the sign-in attempt", async () => {
        const a = await admin();
        const { secret } = await startMfaSetup(a.id);
        await enableMfa(a.id, hotp(base32Decode(secret), Math.floor(t / 1000 / TOTP_STEP_SECONDS)));
        const user = (await getGlobalStore().users.get(a.id))!;
        const challenge = await createMfaChallenge(user);
        for (let i = 0; i < 5; i++)
            await expect(completeMfaChallenge(challenge, "000000")).rejects.toThrow(/didn't match/);
        t += 60000;
        const right = hotp(base32Decode(secret), Math.floor(t / 1000 / TOTP_STEP_SECONDS));
        await expect(completeMfaChallenge(challenge, right)).rejects.toThrow(/expired/);
    });
    it("concurrent setup requests create exactly one admin", async () => {
        const results = await Promise.allSettled([admin(), admin(), admin()]);
        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect((await getGlobalStore().users.list()).length).toBe(1);
    });
    it("challenges expire after 5 minutes", async () => {
        const a = await admin();
        const challenge = await createMfaChallenge(a);
        t += 6 * 60000;
        await expect(completeMfaChallenge(challenge, "123456")).rejects.toThrow(/expired/);
    });
});
