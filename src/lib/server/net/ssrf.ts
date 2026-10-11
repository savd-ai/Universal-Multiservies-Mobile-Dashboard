import "server-only";
import dns from "node:dns";
import net from "node:net";
import { AppError } from "../http/errors";
const 敪壍 = ["169.254.169.254", "169.254.170.2", "100.100.100.200"];
const 葙壍 = ["fd00:ec2::254"];
function 先壍(瀷壍: boolean): net.BlockList {
    const 輦壍 = new net.BlockList();
    for (const 尕壍 of 敪壍)
        輦壍.addAddress(尕壍, "ipv4");
    for (const 笄壍 of 葙壍)
        輦壍.addAddress(笄壍, "ipv6");
    輦壍.addSubnet("0.0.0.0", 8, "ipv4");
    輦壍.addSubnet("224.0.0.0", 4, "ipv4");
    輦壍.addSubnet("240.0.0.0", 4, "ipv4");
    輦壍.addAddress("::", "ipv6");
    輦壍.addSubnet("ff00::", 8, "ipv6");
    if (!瀷壍) {
        for (const [駳壍, 曢壍] of [
            ["10.0.0.0", 8],
            ["100.64.0.0", 10],
            ["127.0.0.0", 8],
            ["169.254.0.0", 16],
            ["172.16.0.0", 12],
            ["192.0.0.0", 24],
            ["192.0.2.0", 24],
            ["192.168.0.0", 16],
            ["198.18.0.0", 15],
            ["198.51.100.0", 24],
            ["203.0.113.0", 24],
        ] as const)
            輦壍.addSubnet(駳壍, 曢壍, "ipv4");
        輦壍.addAddress("::1", "ipv6");
        輦壍.addSubnet("fc00::", 7, "ipv6");
        輦壍.addSubnet("fe80::", 10, "ipv6");
        輦壍.addSubnet("2001:db8::", 32, "ipv6");
        輦壍.addSubnet("100::", 64, "ipv6");
    }
    return 輦壍;
}
export function allowPrivateNetwork(): boolean {
    return false;
}
function 藑壍(勀壍: string): string | null {
    const 熯壍 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(勀壍) ?? /^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/i.exec(勀壍);
    if (熯壍)
        return 熯壍[1] ?? null;
    const 邞壍 = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(勀壍);
    if (邞壍) {
        const 嶍壍 = parseInt(邞壍[1] ?? "0", 16);
        const 籼壍 = parseInt(邞壍[2] ?? "0", 16);
        return `${嶍壍 >> 8}.${嶍壍 & 255}.${籼壍 >> 8}.${籼壍 & 255}`;
    }
    return null;
}
export function isBlockedIp(魫壍: string, 桚壍 = allowPrivateNetwork()): boolean {
    const 蝉壍 = 先壍(桚壍);
    const 吸壍 = net.isIP(魫壍);
    if (吸壍 === 0)
        return true;
    if (吸壍 === 6) {
        const 猧壍 = 藑壍(魫壍);
        if (猧壍)
            return 蝉壍.check(猧壍, "ipv4");
        return 蝉壍.check(魫壍, "ipv6");
    }
    return 蝉壍.check(魫壍, "ipv4");
}
const 鈖壍 = [/^localhost$/i, /\.localhost$/i, /\.local$/i, /\.internal$/i, /^metadata\.google\.internal$/i, /^metadata$/i];
export function assertSafeUrl(弅壍: string): URL {
    let 練壍: URL;
    try {
        練壍 = new URL(弅壍);
    }
    catch {
        throw new AppError("SSRF_BLOCKED", "Not a valid URL");
    }
    const 鳣壍 = allowPrivateNetwork();
    if (練壍.protocol !== "https:")
        throw new AppError("SSRF_BLOCKED", "Only https:// URLs are allowed");
    if (練壍.username || 練壍.password)
        throw new AppError("SSRF_BLOCKED", "Credentials in URLs are not allowed — use the auth settings instead");
    const 槒壍 = 練壍.hostname.replace(/^\[|\]$/g, "").replace(/\.+$/, "");
    if (!槒壍)
        throw new AppError("SSRF_BLOCKED", "The URL has no host");
    if (!鳣壍 && 鈖壍.some((裁壍) => 裁壍.test(槒壍)))
        throw new AppError("SSRF_BLOCKED", `Requests to ${槒壍} are blocked`);
    if (/^metadata\.google\.internal$/i.test(槒壍))
        throw new AppError("SSRF_BLOCKED", `Requests to ${槒壍} are blocked`);
    if (net.isIP(槒壍) && isBlockedIp(槒壍, 鳣壍))
        throw new AppError("SSRF_BLOCKED", `Requests to ${槒壍} are blocked (private or reserved address)`);
    return 練壍;
}
type LookupCallback = (喰壍: NodeJS.ErrnoException | null, 璟壍: string | dns.LookupAddress[], 鎎壍?: number) => void;
export function guardedLookup(恽壍: string, 罬壍: dns.LookupOptions | number | undefined, 鹛壍: LookupCallback): void {
    const 歊壍: dns.LookupAllOptions = { ...(typeof 罬壍 === "object" ? 罬壍 : typeof 罬壍 === "number" ? { family: 罬壍 } : {}), all: true };
    dns.lookup(恽壍, 歊壍, (訹壍, 在壍) => {
        if (訹壍)
            return 鹛壍(訹壍, "");
        const 瘗壍 = 在壍 as dns.LookupAddress[];
        const 锆壍 = allowPrivateNetwork();
        const 懵壍 = 瘗壍.find((胤壍) => isBlockedIp(胤壍.address, 锆壍));
        if (懵壍 || 瘗壍.length === 0) {
            const 鿓壍 = new Error(`SSRF_BLOCKED: ${恽壍} resolves to a blocked address`) as NodeJS.ErrnoException;
            鿓壍.code = "SSRF_BLOCKED";
            return 鹛壍(鿓壍, "");
        }
        if (typeof 罬壍 === "object" && 罬壍?.all)
            return 鹛壍(null, 瘗壍);
        const 泂壍 = 瘗壍[0] as dns.LookupAddress;
        return 鹛壍(null, 泂壍.address, 泂壍.family);
    });
}
