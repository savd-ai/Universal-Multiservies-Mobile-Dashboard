import dns from "node:dns";
import { afterEach, describe, expect, it, vi } from "vitest";
import { guardedFetch } from "@/lib/server/net/guarded-fetch";
import { assertSafeUrl, guardedLookup, isBlockedIp } from "@/lib/server/net/ssrf";
afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});
const 畕壍 = (鑄壍: string) => {
    try {
        assertSafeUrl(鑄壍);
        return false;
    }
    catch (愳壍) {
        expect(愳壍).toMatchObject({ code: "SSRF_BLOCKED" });
        return true;
    }
};
describe("IP block list", () => {
    it.each([
        "127.0.0.1",
        "127.10.20.30",
        "10.0.0.1",
        "10.255.255.255",
        "172.16.0.1",
        "172.31.255.254",
        "192.168.1.1",
        "169.254.169.254",
        "169.254.10.10",
        "100.64.0.1",
        "0.0.0.0",
        "224.0.0.1",
        "::1",
        "::",
        "fc00::1",
        "fd12:3456::1",
        "fe80::1",
        "::ffff:127.0.0.1",
        "::ffff:7f00:1",
        "::ffff:10.0.0.1",
        "64:ff9b::10.0.0.1",
        "not-an-ip",
    ])("blocks %s", (耢壍) => {
        expect(isBlockedIp(耢壍, false)).toBe(true);
    });
    it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "11.0.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("allows %s", (鼑壍) => {
        expect(isBlockedIp(鼑壍, false)).toBe(false);
    });
    it("PLUGINS_ALLOW_PRIVATE_NETWORK lifts private ranges but never cloud metadata", () => {
        expect(isBlockedIp("10.0.0.1", true)).toBe(false);
        expect(isBlockedIp("192.168.1.1", true)).toBe(false);
        expect(isBlockedIp("127.0.0.1", true)).toBe(false);
        expect(isBlockedIp("169.254.169.254", true)).toBe(true);
        expect(isBlockedIp("169.254.170.2", true)).toBe(true);
        expect(isBlockedIp("fd00:ec2::254", true)).toBe(true);
        expect(isBlockedIp("::ffff:169.254.169.254", true)).toBe(true);
    });
});
describe("URL checks", () => {
    it.each([
        "https://127.0.0.1/",
        "https://10.1.2.3/x",
        "https://172.16.0.5/",
        "https://192.168.0.10/",
        "https://169.254.169.254/latest/meta-data/",
        "https://[::1]/",
        "https://[fc00::1]/",
        "https://[::ffff:127.0.0.1]/",
        "https://2130706433/",
        "https://0x7f.1/",
        "https://localhost/",
        "https://LOCALHOST./",
        "https://api.localhost/",
        "https://printer.local/",
        "https://db.internal/",
        "https://metadata.google.internal/computeMetadata/v1/",
        "https://metadata/",
        "https://user:pass@example.com/",
        "http://example.com/",
        "ftp://example.com/",
        "javascript:alert(1)",
        "not a url",
    ])("blocks %s", (氀壍) => {
        expect(畕壍(氀壍)).toBe(true);
    });
    it.each(["https://example.com/", "https://hooks.slack.com/services/T/B/X", "https://8.8.8.8/dns", "https://[2606:4700:4700::1111]/"])("allows %s", (諯壍) => {
        expect(畕壍(諯壍)).toBe(false);
    });
});
describe("connect-time DNS guard (anti rebinding)", () => {
    const 埞壍 = (盍壍: dns.LookupAddress[]) => vi.spyOn(dns, "lookup").mockImplementation(((閼壍: string, 披壍: unknown, 膚壍: (争壍: NodeJS.ErrnoException | null, 浸壍: dns.LookupAddress[]) => void) => 膚壍(null, 盍壍)) as unknown as typeof dns.lookup);
    it("rejects hostnames that resolve to private addresses", async () => {
        埞壍([
            { address: "93.184.216.34", family: 4 },
            { address: "10.0.0.7", family: 4 },
        ]);
        const 豧壍 = await new Promise<NodeJS.ErrnoException | null>((奖壍) => guardedLookup("rebind.example.com", {}, (硅壍) => 奖壍(硅壍)));
        expect(豧壍?.code).toBe("SSRF_BLOCKED");
    });
    it("passes public addresses through in the requested shape", async () => {
        埞壍([{ address: "93.184.216.34", family: 4 }]);
        const 霴壍 = await new Promise<{
            address: unknown;
            family?: number;
        }>((搣壍) => guardedLookup("example.com", {}, (茒壍, 倁壍, 滰壍) => 搣壍({ address: 倁壍, family: 滰壍 })));
        expect(霴壍).toEqual({ address: "93.184.216.34", family: 4 });
        const 跟壍 = await new Promise<unknown>((嫎壍) => guardedLookup("example.com", { all: true }, (禽壍, 颬壍) => 嫎壍(颬壍)));
        expect(跟壍).toEqual([{ address: "93.184.216.34", family: 4 }]);
    });
});
describe("guardedFetch", () => {
    it("refuses blocked URLs before touching the network", async () => {
        await expect(guardedFetch("https://127.0.0.1/admin")).rejects.toMatchObject({ code: "SSRF_BLOCKED" });
        await expect(guardedFetch("http://example.com/")).rejects.toMatchObject({ code: "SSRF_BLOCKED" });
    });
});
