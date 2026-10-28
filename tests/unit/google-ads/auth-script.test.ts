import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { consentUrl, maskSecret, parseClientFile, pkcePair, upsertEnv } from "../../../scripts/google-ads-auth-lib";
describe("parseClientFile", () => {
    it("reads Desktop (installed) and Web clients", () => {
        expect(parseClientFile(JSON.stringify({ installed: { client_id: "id-1.apps.googleusercontent.com", client_secret: "s1" } }))).toEqual({ clientId: "id-1.apps.googleusercontent.com", clientSecret: "s1", kind: "installed" });
        expect(parseClientFile(JSON.stringify({ web: { client_id: "id-2", client_secret: "s2" } }))).toMatchObject({ kind: "web", clientId: "id-2" });
    });
    it("rejects files without a client id and secret", () => {
        expect(() => parseClientFile("not json")).toThrow(/valid JSON/);
        expect(() => parseClientFile(JSON.stringify({ installed: { client_id: "x" } }))).toThrow(/client_secret/);
        expect(() => parseClientFile(JSON.stringify({ type: "service_account" }))).toThrow(/client_secret/);
    });
});
describe("consentUrl + PKCE", () => {
    it("asks for the adwords scope offline with a fresh consent, S256 PKCE and state", () => {
        const { verifier, challenge } = pkcePair();
        expect(createHash("sha256").update(verifier).digest("base64url")).toBe(challenge);
        const url = new URL(consentUrl({ clientId: "cid", redirectUri: "http://127.0.0.1:51234", state: "st", challenge, loginHint: "analyst@example.com" }));
        expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
        expect(Object.fromEntries(url.searchParams)).toEqual({
            client_id: "cid",
            redirect_uri: "http://127.0.0.1:51234",
            response_type: "code",
            scope: "https://www.googleapis.com/auth/adwords",
            access_type: "offline",
            prompt: "consent",
            code_challenge: challenge,
            code_challenge_method: "S256",
            state: "st",
            login_hint: "analyst@example.com",
        });
    });
});
describe("upsertEnv", () => {
    const base = "# Google Ads\nGOOGLE_ADS_CLIENT_ID=\n# GOOGLE_ADS_CLIENT_SECRET=commented\nGOOGLE_ADS_CUSTOMER_ID=482-119-3307\n";
    it("replaces existing lines, appends missing ones and keeps everything else", () => {
        const out = upsertEnv(base, { GOOGLE_ADS_CLIENT_ID: "cid", GOOGLE_ADS_CLIENT_SECRET: "sec", GOOGLE_ADS_REFRESH_TOKEN: "1//tok" });
        expect(out).toBe("# Google Ads\nGOOGLE_ADS_CLIENT_ID=cid\n# GOOGLE_ADS_CLIENT_SECRET=commented\nGOOGLE_ADS_CUSTOMER_ID=482-119-3307\nGOOGLE_ADS_CLIENT_SECRET=sec\nGOOGLE_ADS_REFRESH_TOKEN=1//tok\n");
    });
    it("handles export prefixes, CRLF and an empty file, and refuses line breaks in values", () => {
        expect(upsertEnv("export GOOGLE_ADS_CLIENT_ID=old\r\nA=1\r\n", { GOOGLE_ADS_CLIENT_ID: "new" })).toBe("GOOGLE_ADS_CLIENT_ID=new\nA=1\n");
        expect(upsertEnv("", { A: "1" })).toBe("A=1\n");
        expect(() => upsertEnv(base, { A: "x\ny" })).toThrow(/line break/);
    });
    it("masks secrets to the last four characters", () => {
        expect(maskSecret("1//0abcdefWXYZ")).toBe("••••WXYZ");
        expect(maskSecret("abc")).toBe("••••");
    });
});
