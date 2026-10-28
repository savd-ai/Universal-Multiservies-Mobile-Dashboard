import "server-only";
import { createHash, createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
const SCRYPT = { N: 32768, r: 8, p: 1, keyLen: 64 } as const;
const MAXMEM = 128 * SCRYPT.N * SCRYPT.r * 2;
function scrypt(password: string, salt: Buffer, keyLen: number, opts: ScryptOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => scryptCb(password, salt, keyLen, opts, (err, key) => (err ? reject(err) : resolve(key))));
}
export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await scrypt(password.normalize("NFKC"), salt, SCRYPT.keyLen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: MAXMEM });
    return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
    const parts = stored?.split("$");
    if (!parts || parts.length !== 6 || parts[0] !== "scrypt") {
        await hashPassword(password);
        return false;
    }
    const [, n, r, p, saltB64, hashB64] = parts as [
        string,
        string,
        string,
        string,
        string,
        string
    ];
    const expected = Buffer.from(hashB64, "base64url");
    const N = Number(n);
    const key = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64url"), expected.length, { N, r: Number(r), p: Number(p), maxmem: 128 * N * Number(r) * 2 });
    return key.length === expected.length && timingSafeEqual(key, expected);
}
export function newToken(bytes = 32): string {
    return randomBytes(bytes).toString("base64url");
}
export function tokenHash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}
export function safeEqual(a: string, b: string): boolean {
    const x = Buffer.from(createHash("sha256").update(a).digest());
    const y = Buffer.from(createHash("sha256").update(b).digest());
    return timingSafeEqual(x, y);
}
export function readableCode(groups = 3, size = 4): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: groups }, () => Array.from({ length: size }, () => alphabet[randomInt(alphabet.length)]).join("")).join("-");
}
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(buf: Buffer): string {
    let bits = 0;
    let value = 0;
    let out = "";
    for (const byte of buf) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += B32[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0)
        out += B32[(value << (5 - bits)) & 31];
    return out;
}
export function base32Decode(text: string): Buffer {
    const clean = text.replace(/[\s=-]/g, "").toUpperCase();
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const ch of clean) {
        const idx = B32.indexOf(ch);
        if (idx < 0)
            throw new Error("Invalid base32 secret");
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}
export function newTotpSecret(): string {
    return base32Encode(randomBytes(20));
}
export function hotp(secret: Buffer, counter: number, digits = 6): string {
    const msg = Buffer.alloc(8);
    msg.writeBigUInt64BE(BigInt(counter));
    const h = createHmac("sha1", secret).update(msg).digest();
    const offset = h[h.length - 1]! & 0xf;
    const bin = ((h[offset]! & 0x7f) << 24) | (h[offset + 1]! << 16) | (h[offset + 2]! << 8) | h[offset + 3]!;
    return String(bin % 10 ** digits).padStart(digits, "0");
}
export const TOTP_STEP_SECONDS = 30;
export function verifyTotp(secretBase32: string, code: string, nowMs: number, window = 1): number | null {
    if (!/^\d{6}$/.test(code))
        return null;
    const key = base32Decode(secretBase32);
    const step = Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
    for (let w = -window; w <= window; w++) {
        if (safeEqual(hotp(key, step + w), code))
            return step + w;
    }
    return null;
}
export function otpauthUri(secretBase32: string, account: string, issuer = "SAVD Ads Intelligence"): string {
    const label = encodeURIComponent(`${issuer}:${account}`);
    return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${TOTP_STEP_SECONDS}`;
}
export function newRecoveryCodes(count = 8): string[] {
    const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
    const part = () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join("");
    return Array.from({ length: count }, () => `${part()}-${part()}`);
}
