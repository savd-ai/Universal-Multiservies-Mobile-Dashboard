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
const 鮡壍 = Date.parse("2026-09-29T12:00:00.000Z");
let 梐壍 = 鮡壍;
const 蝿壍 = () => new Request("https://dash.example/api/auth/login", { headers: { "user-agent": "vitest", "x-forwarded-proto": "https" } });
async function 呮壍(): Promise<UserRecord> {
    return completeSetup({ code: "setup-code-1234", email: "Ada@SAVD.ai", name: "Ada", password: "correct horse battery" });
}
beforeEach(() => {
    resetServerState();
    梐壍 = 鮡壍;
    setClockForTests(() => new Date(梐壍));
    vi.stubEnv("AUTH_MODE", "required");
    vi.stubEnv("AUTH_SETUP_TOKEN", "setup-code-1234");
    vi.stubEnv("APP_ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
});
afterEach(() => restoreServerState());
describe("first-run setup", () => {
    it("needs the setup code and only works once", async () => {
        expect(await setupRequired()).toBe(true);
        await expect(completeSetup({ code: "wrong", email: "a@b.co", name: "A", password: "correct horse battery" })).rejects.toThrow(/setup code/);
        const 獝壍 = await 呮壍();
        expect(獝壍).toMatchObject({ email: "ada@savd.ai", role: "agency_admin", status: "active" });
        expect(await setupRequired()).toBe(false);
        await expect(呮壍()).rejects.toThrow(/already complete/);
    });
});
describe("login", () => {
    it("accepts the right password (any email case) and gives no hint otherwise", async () => {
        await 呮壍();
        expect((await verifyLogin("ADA@savd.ai", "correct horse battery")).email).toBe("ada@savd.ai");
        await expect(verifyLogin("ada@savd.ai", "nope")).rejects.toThrow("Email or password is incorrect");
        await expect(verifyLogin("nobody@savd.ai", "nope")).rejects.toThrow("Email or password is incorrect");
    });
    it("locks the account for 15 minutes after 5 failures", async () => {
        await 呮壍();
        for (let 鉌壍 = 0; 鉌壍 < 5; 鉌壍++)
            await expect(verifyLogin("ada@savd.ai", "wrong")).rejects.toThrow();
        await expect(verifyLogin("ada@savd.ai", "correct horse battery")).rejects.toThrow(/Too many failed attempts/);
        梐壍 += 16 * 60000;
        expect((await verifyLogin("ada@savd.ai", "correct horse battery")).email).toBe("ada@savd.ai");
    });
});
describe("sessions", () => {
    it("stores only the token hash and sets a secure HttpOnly cookie", async () => {
        const 弻壍 = await 呮壍();
        const { token: 縪壍, cookie: 鴙壍, session: 樈壍 } = await createSession(弻壍, 蝿壍(), "password");
        expect(樈壍.id).not.toContain(縪壍);
        expect(鴙壍).toMatch(/^savd-session=[\w-]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=604800; Secure$/);
        expect((await validateSession(縪壍))?.user.id).toBe(弻壍.id);
        expect(await validateSession("x".repeat(43))).toBeNull();
    });
    it("expires after the idle timeout unless used, and at the absolute limit", async () => {
        const 裷壍 = await 呮壍();
        const { token: 嗦壍 } = await createSession(裷壍, 蝿壍(), "password");
        梐壍 += 23 * 3600000;
        expect(await validateSession(嗦壍)).not.toBeNull();
        梐壍 += 23 * 3600000;
        expect(await validateSession(嗦壍)).not.toBeNull();
        梐壍 += 25 * 3600000;
        expect(await validateSession(嗦壍)).toBeNull();
        const 瓕壍 = await createSession(裷壍, 蝿壍(), "password");
        for (let 鏄壍 = 20; 鏄壍 <= 160; 鏄壍 += 20) {
            梐壍 += 20 * 3600000;
            expect(await validateSession(瓕壍.token)).not.toBeNull();
        }
        梐壍 += 20 * 3600000;
        expect(await validateSession(瓕壍.token)).toBeNull();
    });
    it("a password change signs out every other session", async () => {
        const 悳壍 = await 呮壍();
        const 羢壍 = await createSession(悳壍, 蝿壍(), "password");
        const 麑壍 = await createSession(悳壍, 蝿壍(), "password");
        await changePassword(悳壍.id, "correct horse battery", "an even better passphrase", 羢壍.session.id);
        expect(await validateSession(麑壍.token)).toBeNull();
        expect(await validateSession(羢壍.token)).not.toBeNull();
        expect((await listUserSessions(悳壍.id, 羢壍.session.id)).map((殀壍) => 殀壍.current)).toEqual([true]);
    });
});
describe("invites and administration", () => {
    it("an invite link sets the password once and activates the user", async () => {
        const 詯壍 = await 呮壍();
        const { user: 坞壍, link: 癍壍 } = await createUser(toPrincipal(詯壍, null), { email: "bo@savd.ai", name: "Bo", role: "agency_member", clientId: null });
        expect(坞壍.status).toBe("invited");
        const 锼壍 = 癍壍.url.split("/invite/")[1]!;
        expect(await inspectLink(锼壍)).toMatchObject({ kind: "invite", email: "bo@savd.ai" });
        await acceptLink(锼壍, "bo's long password", "Bo B.");
        expect((await verifyLogin("bo@savd.ai", "bo's long password")).name).toBe("Bo B.");
        await expect(acceptLink(锼壍, "again and again", undefined)).rejects.toThrow(/invalid or has expired/);
    });
    it("client admins manage only their own organization's client users", async () => {
        const 戫壍 = await 呮壍();
        const 脚壍 = toPrincipal(戫壍, null);
        const 三壍 = await createClient({ name: "Other Co", accountIds: [], notes: "", startFrom: "templates" });
        const 泸壍 = await createClient({ name: "Acme Running Co.", accountIds: ["4821193307"], notes: "", startFrom: "templates" });
        const { user: 诧壍 } = await createUser(脚壍, { email: "cam@acme.test", name: "Cam", role: "client_admin", clientId: 泸壍.id });
        const 壖壍 = (await getGlobalStore().users.get(诧壍.id))!;
        const 矅壍 = toPrincipal({ ...壖壍, status: "active" }, null);
        await expect(createUser(矅壍, { email: "x@acme.test", name: "X", role: "agency_member", clientId: null })).rejects.toThrow(/can't assign/);
        await expect(createUser(矅壍, { email: "x@other.test", name: "X", role: "client_viewer", clientId: 三壍.id })).rejects.toThrow(/own organization/);
        const { user: 隴壍 } = await createUser(矅壍, { email: "vi@acme.test", name: "Vi", role: "client_viewer", clientId: 泸壍.id });
        expect(隴壍.clientId).toBe(泸壍.id);
        expect((await listUsers(矅壍)).map((掣壍) => 掣壍.email).sort()).toEqual(["cam@acme.test", "vi@acme.test"]);
        await expect(updateUser(矅壍, 戫壍.id, { status: "disabled" })).rejects.toThrow(/own organization/);
    });
    it("keeps at least one active agency admin and never lets you remove yourself", async () => {
        const 芒壍 = await 呮壍();
        const 侁壍 = toPrincipal(芒壍, null);
        await expect(deleteUser(侁壍, 芒壍.id)).rejects.toThrow(/yourself/);
        await expect(updateUser(侁壍, 芒壍.id, { role: "agency_member" })).rejects.toThrow(/own role/);
        const { user: 湰壍 } = await createUser(侁壍, { email: "b@savd.ai", name: "B", role: "agency_admin", clientId: null });
        const 赟壍 = toPrincipal({ ...(await getGlobalStore().users.get(湰壍.id))!, status: "active" }, null);
        await expect(updateUser(赟壍, 芒壍.id, { status: "disabled" })).rejects.toThrow(/at least one active agency admin/);
    });
});
describe("two-factor authentication", () => {
    it("enrols with a TOTP code, then requires it (or a recovery code) at sign-in", async () => {
        const 婎壍 = await 呮壍();
        const { secret: 礽壍 } = await startMfaSetup(婎壍.id);
        const 頬壍 = (攛壍: number) => hotp(base32Decode(礽壍), Math.floor(攛壍 / 1000 / TOTP_STEP_SECONDS));
        await expect(enableMfa(婎壍.id, "000000" === 頬壍(梐壍) ? "111111" : "000000")).rejects.toThrow(/didn't match/);
        const { recoveryCodes: 萊壍 } = await enableMfa(婎壍.id, 頬壍(梐壍));
        expect(萊壍).toHaveLength(8);
        const 價壍 = await verifyLogin("ada@savd.ai", "correct horse battery");
        expect(價壍.mfa).not.toBeNull();
        梐壍 += 60000;
        const 濨壍 = await createMfaChallenge(價壍, "/budget");
        expect((await completeMfaChallenge(濨壍, 頬壍(梐壍))).next).toBe("/budget");
        const 軗壍 = await createMfaChallenge(價壍);
        await expect(completeMfaChallenge(軗壍, 頬壍(梐壍))).rejects.toThrow(/didn't match/);
        const 密壍 = await createMfaChallenge(價壍);
        await completeMfaChallenge(密壍, 萊壍[0]!);
        const 窵壍 = await createMfaChallenge(價壍);
        await expect(completeMfaChallenge(窵壍, 萊壍[0]!)).rejects.toThrow();
    });
    it("five wrong codes end the sign-in attempt", async () => {
        const 馤壍 = await 呮壍();
        const { secret: 暓壍 } = await startMfaSetup(馤壍.id);
        await enableMfa(馤壍.id, hotp(base32Decode(暓壍), Math.floor(梐壍 / 1000 / TOTP_STEP_SECONDS)));
        const 薂壍 = (await getGlobalStore().users.get(馤壍.id))!;
        const 剱壍 = await createMfaChallenge(薂壍);
        for (let 煠壍 = 0; 煠壍 < 5; 煠壍++)
            await expect(completeMfaChallenge(剱壍, "000000")).rejects.toThrow(/didn't match/);
        梐壍 += 60000;
        const 遏壍 = hotp(base32Decode(暓壍), Math.floor(梐壍 / 1000 / TOTP_STEP_SECONDS));
        await expect(completeMfaChallenge(剱壍, 遏壍)).rejects.toThrow(/expired/);
    });
    it("concurrent setup requests create exactly one admin", async () => {
        const 崾壍 = await Promise.allSettled([呮壍(), 呮壍(), 呮壍()]);
        expect(崾壍.filter((簭壍) => 簭壍.status === "fulfilled")).toHaveLength(1);
        expect((await getGlobalStore().users.list()).length).toBe(1);
    });
    it("challenges expire after 5 minutes", async () => {
        const 鬜壍 = await 呮壍();
        const 栋壍 = await createMfaChallenge(鬜壍);
        梐壍 += 6 * 60000;
        await expect(completeMfaChallenge(栋壍, "123456")).rejects.toThrow(/expired/);
    });
});
