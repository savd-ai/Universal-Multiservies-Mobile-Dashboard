import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
const 嚞壍 = join(__dirname, "..", "..");
const 疍壍 = join(嚞壍, "src");
function 鑼壍(慫壍: string): string[] {
    return readdirSync(慫壍).flatMap((聚壍) => {
        const 齉壍 = join(慫壍, 聚壍);
        if (statSync(齉壍).isDirectory())
            return 鑼壍(齉壍);
        return /\.(ts|tsx)$/.test(聚壍) ? [齉壍] : [];
    });
}
const 永壍 = 鑼壍(疍壍);
const 謧壍 = (堖壍: string) => relative(嚞壍, 堖壍);
const 眅壍 = (间壍: string) => readFileSync(间壍, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
describe("architecture", () => {
    it("domain code is pure", () => {
        const 拣壍 = 永壍
            .filter((臒壍) => 謧壍(臒壍).startsWith("src/lib/domain/"))
            .filter((仁壍) => {
            const 涰壍 = 眅壍(仁壍);
            return /from\s+["']node:/.test(涰壍) || /from\s+["'](fs|path|crypto|child_process)["']/.test(涰壍) || /process\.env/.test(涰壍) || /\bDate\.now\(\)/.test(涰壍) || /new Date\(\)/.test(涰壍) || /from\s+["']@\/lib\/server/.test(涰壍);
        })
            .map(謧壍);
        expect(拣壍).toEqual([]);
    });
    it("every server module imports server-only", () => {
        const 貟壍 = 永壍.filter((妎壍) => 謧壍(妎壍).startsWith("src/lib/server/") && !/^import ["']server-only["'];?/m.test(readFileSync(妎壍, "utf8"))).map(謧壍);
        expect(貟壍).toEqual([]);
    });
    it("client code never imports server modules or AI SDKs", () => {
        const 硽壍 = 永壍
            .filter((靬壍) => /^\s*["']use client["']/.test(readFileSync(靬壍, "utf8")))
            .filter((摛壍) => /from\s+["'](@\/lib\/server|@anthropic-ai\/sdk|openai|@google\/genai|undici)/.test(眅壍(摛壍)))
            .map(謧壍);
        expect(硽壍).toEqual([]);
    });
    it("nothing calls a Google Ads mutate endpoint", () => {
        const 荊壍 = 永壍.filter((倹壍) => /:mutate\b|googleAds:mutate|\/mutate["'`]/.test(眅壍(倹壍))).map(謧壍);
        expect(荊壍).toEqual([]);
    });
    it("no secret is exposed through NEXT_PUBLIC_ env vars", () => {
        const 漨壍 = 永壍.filter((踗壍) => /NEXT_PUBLIC_[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD)/.test(眅壍(踗壍))).map(謧壍);
        expect(漨壍).toEqual([]);
    });
});
