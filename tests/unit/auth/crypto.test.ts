import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hashPassword, hotp, newRecoveryCodes, newToken, otpauthUri, readableCode, tokenHash, verifyPassword, verifyTotp } from "@/lib/server/auth/crypto";
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));
describe("passwords", () => {
    it("hashes with scrypt and verifies only the right password", async () => {
        const stored = await hashPassword("correct horse battery");
        expect(stored).toMatch(/^scrypt\$32768\$8\$1\$[\w-]+\$[\w-]+$/);
        expect(await verifyPassword("correct horse battery", stored)).toBe(true);
        expect(await verifyPassword("correct horse batterY", stored)).toBe(false);
        expect(await hashPassword("correct horse battery")).not.toBe(stored);
    });
    it("treats missing or malformed hashes as a failed check", async () => {
        expect(await verifyPassword("anything", null)).toBe(false);
        expect(await verifyPassword("anything", "plain-text")).toBe(false);
    });
});
describe("tokens", () => {
    it("are long, url-safe and stored only as a sha-256 hex digest", () => {
        const t = newToken();
        expect(t).toMatch(/^[\w-]{43}$/);
        expect(tokenHash(t)).toMatch(/^[0-9a-f]{64}$/);
        expect(tokenHash(t)).not.toContain(t);
    });
    it("readable setup codes avoid ambiguous characters", () => {
        expect(readableCode()).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    });
    it("recovery codes are 8 distinct abcd-1234 codes", () => {
        const codes = newRecoveryCodes();
        expect(codes).toHaveLength(8);
        expect(new Set(codes).size).toBe(8);
        for (const c of codes)
            expect(c).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}$/);
    });
});
describe("TOTP", () => {
    it("base32 round-trips", () => {
        const buf = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 7]);
        expect(base32Decode(base32Encode(buf))).toEqual(buf);
        expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    });
    it("matches the RFC 6238 SHA-1 test vectors", () => {
        const key = base32Decode(RFC_SECRET);
        expect(hotp(key, Math.floor(59 / 30))).toBe("287082");
        expect(hotp(key, Math.floor(1111111109 / 30))).toBe("081804");
        expect(hotp(key, Math.floor(1234567890 / 30))).toBe("005924");
        expect(hotp(key, Math.floor(2000000000 / 30))).toBe("279037");
    });
    it("accepts one step of clock drift and returns the matched step", () => {
        const t = 1111111109 * 1000;
        expect(verifyTotp(RFC_SECRET, "081804", t)).toBe(Math.floor(1111111109 / 30));
        expect(verifyTotp(RFC_SECRET, "081804", t + 30000)).toBe(Math.floor(1111111109 / 30));
        expect(verifyTotp(RFC_SECRET, "081804", t + 90000)).toBeNull();
        expect(verifyTotp(RFC_SECRET, "12345", t)).toBeNull();
    });
    it("builds an otpauth URI authenticator apps understand", () => {
        const uri = otpauthUri(RFC_SECRET, "ana@savd.ai");
        expect(uri).toContain("otpauth://totp/SAVD%20Ads%20Intelligence%3Aana%40savd.ai?");
        expect(uri).toContain(`secret=${RFC_SECRET}`);
        expect(uri).toContain("period=30");
    });
});
