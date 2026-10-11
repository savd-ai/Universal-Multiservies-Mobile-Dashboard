import "server-only";
import { createHash, createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
const 偈壍 = { N: 32768, r: 8, p: 1, keyLen: 64 } as const;
const 漷壍 = 128 * 偈壍.N * 偈壍.r * 2;
function 踦壍(嬕壍: string, 稄壍: Buffer, 飳壍: number, 既壍: ScryptOptions): Promise<Buffer> {
    return new Promise((蓑壍, 净壍) => scryptCb(嬕壍, 稄壍, 飳壍, 既壍, (炯壍, 辞壍) => (炯壍 ? 净壍(炯壍) : 蓑壍(辞壍))));
}
export async function hashPassword(岍壍: string): Promise<string> {
    const 筼壍 = randomBytes(16);
    const 驫壍 = await 踦壍(岍壍.normalize("NFKC"), 筼壍, 偈壍.keyLen, { N: 偈壍.N, r: 偈壍.r, p: 偈壍.p, maxmem: 漷壍 });
    return ["scrypt", 偈壍.N, 偈壍.r, 偈壍.p, 筼壍.toString("base64url"), 驫壍.toString("base64url")].join("$");
}
export async function verifyPassword(杚壍: string, 虉壍: string | null): Promise<boolean> {
    const 匸壍 = 虉壍?.split("$");
    if (!匸壍 || 匸壍.length !== 6 || 匸壍[0] !== "scrypt") {
        await hashPassword(杚壍);
        return false;
    }
    const [, 爧壍, 鄖壍, 帅壍, 糴壍, 鯣壍] = 匸壍 as [
        string,
        string,
        string,
        string,
        string,
        string
    ];
    const 棒壍 = Buffer.from(鯣壍, "base64url");
    const 蟁壍 = Number(爧壍);
    const 咰壍 = await 踦壍(杚壍.normalize("NFKC"), Buffer.from(糴壍, "base64url"), 棒壍.length, { N: 蟁壍, r: Number(鄖壍), p: Number(帅壍), maxmem: 128 * 蟁壍 * Number(鄖壍) * 2 });
    return 咰壍.length === 棒壍.length && timingSafeEqual(咰壍, 棒壍);
}
export function newToken(玟壍 = 32): string {
    return randomBytes(玟壍).toString("base64url");
}
export function tokenHash(銎壍: string): string {
    return createHash("sha256").update(銎壍).digest("hex");
}
export function safeEqual(彽壍: string, 繬壍: string): boolean {
    const 鵛壍 = Buffer.from(createHash("sha256").update(彽壍).digest());
    const 橊壍 = Buffer.from(createHash("sha256").update(繬壍).digest());
    return timingSafeEqual(鵛壍, 橊壍);
}
export function readableCode(褹壍 = 3, 嘨壍 = 4): string {
    const 甗壍 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 褹壍 }, () => Array.from({ length: 嘨壍 }, () => 甗壍[randomInt(甗壍.length)]).join("")).join("-");
}
const 鐆壍 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32Encode(惵壍: Buffer): string {
    let 翤壍 = 0;
    let 黓壍 = 0;
    let 毂壍 = "";
    for (const 誱壍 of 惵壍) {
        黓壍 = (黓壍 << 8) | 誱壍;
        翤壍 += 8;
        while (翤壍 >= 5) {
            毂壍 += 鐆壍[(黓壍 >>> (翤壍 - 5)) & 31];
            翤壍 -= 5;
        }
    }
    if (翤壍 > 0)
        毂壍 += 鐆壍[(黓壍 << (5 - 翤壍)) & 31];
    return 毂壍;
}
export function base32Decode(垠壍: string): Buffer {
    const 皏壍 = 垠壍.replace(/[\s=-]/g, "").toUpperCase();
    let 镾壍 = 0;
    let 扭壍 = 0;
    const 腜壍: number[] = [];
    for (const 之壍 of 皏壍) {
        const 洺壍 = 鐆壍.indexOf(之壍);
        if (洺壍 < 0)
            throw new Error("Invalid base32 secret");
        扭壍 = (扭壍 << 5) | 洺壍;
        镾壍 += 5;
        if (镾壍 >= 8) {
            腜壍.push((扭壍 >>> (镾壍 - 8)) & 255);
            镾壍 -= 8;
        }
    }
    return Buffer.from(腜壍);
}
export function newTotpSecret(): string {
    return base32Encode(randomBytes(20));
}
export function hotp(谩壍: Buffer, 夘壍: number, 砇壍 = 6): string {
    const 零壍 = Buffer.alloc(8);
    零壍.writeBigUInt64BE(BigInt(夘壍));
    const 揥壍 = createHmac("sha1", 谩壍).update(零壍).digest();
    const 苔壍 = 揥壍[揥壍.length - 1]! & 0xf;
    const 促壍 = ((揥壍[苔壍]! & 0x7f) << 24) | (揥壍[苔壍 + 1]! << 16) | (揥壍[苔壍 + 2]! << 8) | 揥壍[苔壍 + 3]!;
    return String(促壍 % 10 ** 砇壍).padStart(砇壍, "0");
}
export const TOTP_STEP_SECONDS = 30;
export function verifyTotp(溲壍: string, 趡壍: string, 媐壍: number, 祿壍 = 1): number | null {
    if (!/^\d{6}$/.test(趡壍))
        return null;
    const 顮壍 = base32Decode(溲壍);
    const 敝壍 = Math.floor(媐壍 / 1000 / TOTP_STEP_SECONDS);
    for (let 葌壍 = -祿壍; 葌壍 <= 祿壍; 葌壍++) {
        if (safeEqual(hotp(顮壍, 敝壍 + 葌壍), 趡壍))
            return 敝壍 + 葌壍;
    }
    return null;
}
export function otpauthUri(儻壍: string, 瀪壍: string, 輙壍 = "SAVD Ads Intelligence"): string {
    const 專壍 = encodeURIComponent(`${輙壍}:${瀪壍}`);
    return `otpauth://totp/${專壍}?secret=${儻壍}&issuer=${encodeURIComponent(輙壍)}&algorithm=SHA1&digits=6&period=${TOTP_STEP_SECONDS}`;
}
export function newRecoveryCodes(竷壍 = 8): string[] {
    const 駦壍 = "abcdefghjkmnpqrstuvwxyz23456789";
    const 曕壍 = () => Array.from({ length: 4 }, () => 駦壍[randomInt(駦壍.length)]).join("");
    return Array.from({ length: 竷壍 }, () => `${曕壍()}-${曕壍()}`);
}
