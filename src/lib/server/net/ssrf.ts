import "server-only";
import dns from "node:dns";
import net from "node:net";
import { AppError } from "../http/errors";
const METADATA_V4 = ["169.254.169.254", "169.254.170.2", "100.100.100.200"];
const METADATA_V6 = ["fd00:ec2::254"];
function buildBlockList(allowPrivate: boolean): net.BlockList {
    const bl = new net.BlockList();
    for (const ip of METADATA_V4)
        bl.addAddress(ip, "ipv4");
    for (const ip of METADATA_V6)
        bl.addAddress(ip, "ipv6");
    bl.addSubnet("0.0.0.0", 8, "ipv4");
    bl.addSubnet("224.0.0.0", 4, "ipv4");
    bl.addSubnet("240.0.0.0", 4, "ipv4");
    bl.addAddress("::", "ipv6");
    bl.addSubnet("ff00::", 8, "ipv6");
    if (!allowPrivate) {
        for (const [a, p] of [
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
            bl.addSubnet(a, p, "ipv4");
        bl.addAddress("::1", "ipv6");
        bl.addSubnet("fc00::", 7, "ipv6");
        bl.addSubnet("fe80::", 10, "ipv6");
        bl.addSubnet("2001:db8::", 32, "ipv6");
        bl.addSubnet("100::", 64, "ipv6");
    }
    return bl;
}
export function allowPrivateNetwork(): boolean {
    return false;
}
function embeddedV4(ip: string): string | null {
    const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip) ?? /^64:ff9b::(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (m)
        return m[1] ?? null;
    const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ip);
    if (hex) {
        const hi = parseInt(hex[1] ?? "0", 16);
        const lo = parseInt(hex[2] ?? "0", 16);
        return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
    }
    return null;
}
export function isBlockedIp(ip: string, allowPrivate = allowPrivateNetwork()): boolean {
    const bl = buildBlockList(allowPrivate);
    const family = net.isIP(ip);
    if (family === 0)
        return true;
    if (family === 6) {
        const v4 = embeddedV4(ip);
        if (v4)
            return bl.check(v4, "ipv4");
        return bl.check(ip, "ipv6");
    }
    return bl.check(ip, "ipv4");
}
const BLOCKED_HOSTS = [/^localhost$/i, /\.localhost$/i, /\.local$/i, /\.internal$/i, /^metadata\.google\.internal$/i, /^metadata$/i];
export function assertSafeUrl(raw: string): URL {
    let url: URL;
    try {
        url = new URL(raw);
    }
    catch {
        throw new AppError("SSRF_BLOCKED", "Not a valid URL");
    }
    const allowPrivate = allowPrivateNetwork();
    if (url.protocol !== "https:")
        throw new AppError("SSRF_BLOCKED", "Only https:// URLs are allowed");
    if (url.username || url.password)
        throw new AppError("SSRF_BLOCKED", "Credentials in URLs are not allowed — use the auth settings instead");
    const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.+$/, "");
    if (!host)
        throw new AppError("SSRF_BLOCKED", "The URL has no host");
    if (!allowPrivate && BLOCKED_HOSTS.some((re) => re.test(host)))
        throw new AppError("SSRF_BLOCKED", `Requests to ${host} are blocked`);
    if (/^metadata\.google\.internal$/i.test(host))
        throw new AppError("SSRF_BLOCKED", `Requests to ${host} are blocked`);
    if (net.isIP(host) && isBlockedIp(host, allowPrivate))
        throw new AppError("SSRF_BLOCKED", `Requests to ${host} are blocked (private or reserved address)`);
    return url;
}
type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;
export function guardedLookup(hostname: string, options: dns.LookupOptions | number | undefined, callback: LookupCallback): void {
    const opts: dns.LookupAllOptions = { ...(typeof options === "object" ? options : typeof options === "number" ? { family: options } : {}), all: true };
    dns.lookup(hostname, opts, (err, addresses) => {
        if (err)
            return callback(err, "");
        const list = addresses as dns.LookupAddress[];
        const allowPrivate = allowPrivateNetwork();
        const blocked = list.find((a) => isBlockedIp(a.address, allowPrivate));
        if (blocked || list.length === 0) {
            const e = new Error(`SSRF_BLOCKED: ${hostname} resolves to a blocked address`) as NodeJS.ErrnoException;
            e.code = "SSRF_BLOCKED";
            return callback(e, "");
        }
        if (typeof options === "object" && options?.all)
            return callback(null, list);
        const first = list[0] as dns.LookupAddress;
        return callback(null, first.address, first.family);
    });
}
