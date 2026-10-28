import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
const ROOT = join(__dirname, "..", "..");
const SRC = join(ROOT, "src");
function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        if (statSync(p).isDirectory())
            return files(p);
        return /\.(ts|tsx)$/.test(name) ? [p] : [];
    });
}
const all = files(SRC);
const rel = (p: string) => relative(ROOT, p);
const code = (p: string) => readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
describe("architecture", () => {
    it("domain code is pure", () => {
        const offenders = all
            .filter((p) => rel(p).startsWith("src/lib/domain/"))
            .filter((p) => {
            const c = code(p);
            return /from\s+["']node:/.test(c) || /from\s+["'](fs|path|crypto|child_process)["']/.test(c) || /process\.env/.test(c) || /\bDate\.now\(\)/.test(c) || /new Date\(\)/.test(c) || /from\s+["']@\/lib\/server/.test(c);
        })
            .map(rel);
        expect(offenders).toEqual([]);
    });
    it("every server module imports server-only", () => {
        const offenders = all.filter((p) => rel(p).startsWith("src/lib/server/") && !/^import ["']server-only["'];?/m.test(readFileSync(p, "utf8"))).map(rel);
        expect(offenders).toEqual([]);
    });
    it("client code never imports server modules or AI SDKs", () => {
        const offenders = all
            .filter((p) => /^\s*["']use client["']/.test(readFileSync(p, "utf8")))
            .filter((p) => /from\s+["'](@\/lib\/server|@anthropic-ai\/sdk|openai|@google\/genai|undici)/.test(code(p)))
            .map(rel);
        expect(offenders).toEqual([]);
    });
    it("nothing calls a Google Ads mutate endpoint", () => {
        const offenders = all.filter((p) => /:mutate\b|googleAds:mutate|\/mutate["'`]/.test(code(p))).map(rel);
        expect(offenders).toEqual([]);
    });
    it("no secret is exposed through NEXT_PUBLIC_ env vars", () => {
        const offenders = all.filter((p) => /NEXT_PUBLIC_[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD)/.test(code(p))).map(rel);
        expect(offenders).toEqual([]);
    });
});
