import { vi } from "vitest";
import { FixtureGoogleAdsSource } from "./support/fixture-source";
vi.mock("@/lib/server/datasource/resolver", async (value) => {
    const value2 = await value<typeof import("@/lib/server/datasource/resolver")>();
    return {
        ...value2,
        resolveGoogleAds: (value3?: {
            fresh?: boolean;
        }) => (globalThis as {
            __savdRealResolver?: boolean;
        }).__savdRealResolver ? value2.resolveGoogleAds(value3) : Promise.resolve({ source: new FixtureGoogleAdsSource(), health: null }),
    };
});
export {};
if (typeof window !== "undefined") {
    await import("@testing-library/jest-dom/vitest");
}
