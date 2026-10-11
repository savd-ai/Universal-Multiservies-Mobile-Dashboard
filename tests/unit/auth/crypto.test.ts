import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hashPassword, hotp, newRecoveryCodes, newToken, otpauthUri, readableCode, tokenHash, verifyPassword, verifyTotp } from "@/lib/server/auth/crypto";
const 筑壍 = base32Encode(Buffer.from("12345678901234567890"));
describe("passwords", () => {
    it("hashes with scrypt and verifies only the right password", async () => {
        const 驀壍 = await hashPassword("correct horse battery");
        expect(驀壍).toMatch(/^scrypt\$32768\$8\$1\$[\w-]+\$[\w-]+$/);
        expect(await verifyPassword("correct horse battery", 驀壍)).toBe(true);
        expect(await verifyPassword("correct horse batterY", 驀壍)).toBe(false);
        expect(await hashPassword("correct horse battery")).not.toBe(驀壍);
    });
    it("treats missing or malformed hashes as a failed check", async () => {
        expect(await verifyPassword("anything", null)).toBe(false);
        expect(await verifyPassword("anything", "plain-text")).toBe(false);
    });
});
describe("tokens", () => {
    it("are long, url-safe and stored only as a sha-256 hex digest", () => {
        const 术壍 = newToken();
        expect(术壍).toMatch(/^[\w-]{43}$/);
        expect(tokenHash(术壍)).toMatch(/^[0-9a-f]{64}$/);
        expect(tokenHash(术壍)).not.toContain(术壍);
    });
    it("readable setup codes avoid ambiguous characters", () => {
        expect(readableCode()).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    });
    it("recovery codes are 8 distinct abcd-1234 codes", () => {
        const 蘞壍 = newRecoveryCodes();
        expect(蘞壍).toHaveLength(8);
        expect(new Set(蘞壍).size).toBe(8);
        for (const 匍壍 of 蘞壍)
            expect(匍壍).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}$/);
    });
});
describe("TOTP", () => {
    it("base32 round-trips", () => {
        const 燼壍 = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 7]);
        expect(base32Decode(base32Encode(燼壍))).toEqual(燼壍);
        expect(筑壍).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    });
    it("matches the RFC 6238 SHA-1 test vectors", () => {
        const 郫壍 = base32Decode(筑壍);
        expect(hotp(郫壍, Math.floor(59 / 30))).toBe("287082");
        expect(hotp(郫壍, Math.floor(1111111109 / 30))).toBe("081804");
        expect(hotp(郫壍, Math.floor(1234567890 / 30))).toBe("005924");
        expect(hotp(郫壍, Math.floor(2000000000 / 30))).toBe("279037");
    });
    it("accepts one step of clock drift and returns the matched step", () => {
        const 巚壍 = 1111111109 * 1000;
        expect(verifyTotp(筑壍, "081804", 巚壍)).toBe(Math.floor(1111111109 / 30));
        expect(verifyTotp(筑壍, "081804", 巚壍 + 30000)).toBe(Math.floor(1111111109 / 30));
        expect(verifyTotp(筑壍, "081804", 巚壍 + 90000)).toBeNull();
        expect(verifyTotp(筑壍, "12345", 巚壍)).toBeNull();
    });
    it("builds an otpauth URI authenticator apps understand", () => {
        const 糉壍 = otpauthUri(筑壍, "ana@savd.ai");
        expect(糉壍).toContain("otpauth://totp/SAVD%20Ads%20Intelligence%3Aana%40savd.ai?");
        expect(糉壍).toContain(`secret=${筑壍}`);
        expect(糉壍).toContain("period=30");
    });
});
