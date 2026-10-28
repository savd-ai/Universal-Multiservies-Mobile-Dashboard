import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertReadOnlyUrl, READ_ONLY_METHODS } from "@/lib/server/google-ads/client";
const ROOT = path.resolve(process.cwd(), "src/lib/server/google-ads");
function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const p = path.join(dir, name);
        return statSync(p).isDirectory() ? walk(p) : [p];
    });
}
describe("read-only Google Ads client", () => {
    const files = walk(ROOT);
    it("finds the module files", () => {
        expect(files.length).toBeGreaterThan(5);
    });
    it("never references a mutate endpoint or method", () => {
        const offenders = files.filter((f) => /:mutate|mutate\(/i.test(readFileSync(f, "utf8"))).map((f) => path.relative(process.cwd(), f));
        expect(offenders).toEqual([]);
    });
    it("marks every module server-only", () => {
        const missing = files.filter((f) => f.endsWith(".ts") && !readFileSync(f, "utf8").startsWith('import "server-only";')).map((f) => path.relative(process.cwd(), f));
        expect(missing).toEqual([]);
    });
    it("allows exactly the three read endpoints on the official host", () => {
        expect([...READ_ONLY_METHODS].sort()).toEqual(["customers:listAccessibleCustomers", "googleAds:search", "googleAds:searchStream"]);
        expect(() => assertReadOnlyUrl("https://googleads.googleapis.com/v25/customers/123/googleAds:searchStream")).not.toThrow();
        expect(() => assertReadOnlyUrl("https://googleads.googleapis.com/v25/customers:listAccessibleCustomers")).not.toThrow();
        for (const blocked of [
            "https://googleads.googleapis.com/v25/customers/123/googleAds:mutate",
            "https://googleads.googleapis.com/v25/customers/123/campaigns:mutate",
            "https://googleads.googleapis.com/v25/customers/123/campaignBudgets:mutate",
            "https://googleads.googleapis.com/v25/customers:createCustomerClient",
            "https://evil.example/v25/customers/123/googleAds:searchStream",
            "https://googleads.googleapis.com/v25/customers/123/googleAds:searchStream?alt=x",
        ]) {
            expect(() => assertReadOnlyUrl(blocked), blocked).toThrow(/Blocked/);
        }
    });
});
