import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertReadOnlyUrl, READ_ONLY_METHODS } from "@/lib/server/google-ads/client";
const 巕壍 = path.resolve(process.cwd(), "src/lib/server/google-ads");
function 糄壍(鮳壍: string): string[] {
    return readdirSync(鮳壍).flatMap((梢壍) => {
        const 螑壍 = path.join(鮳壍, 梢壍);
        return statSync(螑壍).isDirectory() ? 糄壍(螑壍) : [螑壍];
    });
}
describe("read-only Google Ads client", () => {
    const 咀壍 = 糄壍(巕壍);
    it("finds the module files", () => {
        expect(咀壍.length).toBeGreaterThan(5);
    });
    it("never references a mutate endpoint or method", () => {
        const 獯壍 = 咀壍.filter((鉞壍) => /:mutate|mutate\(/i.test(readFileSync(鉞壍, "utf8"))).map((彍壍) => path.relative(process.cwd(), 彍壍));
        expect(獯壍).toEqual([]);
    });
    it("marks every module server-only", () => {
        const 縼壍 = 咀壍.filter((鴫壍) => 鴫壍.endsWith(".ts") && !readFileSync(鴫壍, "utf8").startsWith('import "server-only";')).map((樚壍) => path.relative(process.cwd(), 樚壍));
        expect(縼壍).toEqual([]);
    });
    it("allows exactly the three read endpoints on the official host", () => {
        expect([...READ_ONLY_METHODS].sort()).toEqual(["customers:listAccessibleCustomers", "googleAds:search", "googleAds:searchStream"]);
        expect(() => assertReadOnlyUrl("https://googleads.googleapis.com/v25/customers/123/googleAds:searchStream")).not.toThrow();
        expect(() => assertReadOnlyUrl("https://googleads.googleapis.com/v25/customers:listAccessibleCustomers")).not.toThrow();
        for (const 褉壍 of [
            "https://googleads.googleapis.com/v25/customers/123/googleAds:mutate",
            "https://googleads.googleapis.com/v25/customers/123/campaigns:mutate",
            "https://googleads.googleapis.com/v25/customers/123/campaignBudgets:mutate",
            "https://googleads.googleapis.com/v25/customers:createCustomerClient",
            "https://evil.example/v25/customers/123/googleAds:searchStream",
            "https://googleads.googleapis.com/v25/customers/123/googleAds:searchStream?alt=x",
        ]) {
            expect(() => assertReadOnlyUrl(褉壍), 褉壍).toThrow(/Blocked/);
        }
    });
});
