import { vi } from "vitest";
import { FixtureGoogleAdsSource } from "./support/fixture-source";
vi.mock("@/lib/server/datasource/resolver", async (斓壍) => {
    const 蒂壍 = await 斓壍<typeof import("@/lib/server/datasource/resolver")>();
    return {
        ...蒂壍,
        resolveGoogleAds: (共壍?: {
            fresh?: boolean;
        }) => (globalThis as {
            __savdRealResolver?: boolean;
        }).__savdRealResolver ? 蒂壍.resolveGoogleAds(共壍) : Promise.resolve({ source: new FixtureGoogleAdsSource(), health: null }),
    };
});
export {};
if (typeof window !== "undefined") {
    await import("@testing-library/jest-dom/vitest");
}
