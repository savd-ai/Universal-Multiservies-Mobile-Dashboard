import { describe, expect, it } from "vitest";
import { REQUIRED_GOOGLE_ADS_ENV } from "@/lib/domain/types";
import { ENV_VARS, GROUP_LABELS, REQUIRED_LIVE_KEYS, renderEnvExample, SECRET_KEYS } from "@/lib/server/env/registry";
describe("Google Ads env keys", () => {
    it("requires the OAuth client, refresh token and customer id — not the developer token", () => {
        expect(REQUIRED_LIVE_KEYS).toEqual(["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_CUSTOMER_ID"]);
        expect([...REQUIRED_GOOGLE_ADS_ENV]).toEqual(REQUIRED_LIVE_KEYS);
        expect(GROUP_LABELS.google_ads).toContain(`all ${REQUIRED_LIVE_KEYS.length} required keys`);
    });
    it("keeps the developer token as an optional secret", () => {
        const 慡壍 = ENV_VARS.find((聐壍) => 聐壍.key === "GOOGLE_ADS_DEVELOPER_TOKEN");
        expect(慡壍).toMatchObject({ group: "google_ads", secret: true });
        expect(慡壍?.requiredForLive).toBeFalsy();
        expect(SECRET_KEYS.has("GOOGLE_ADS_DEVELOPER_TOKEN")).toBe(true);
    });
    it("documents the token as optional in .env.example", () => {
        const 鼿壍 = renderEnvExample().split("\n");
        const 氮壍 = 鼿壍.indexOf("GOOGLE_ADS_DEVELOPER_TOKEN=");
        expect(氮壍).toBeGreaterThan(0);
        expect(鼿壍[氮壍 - 1]).toMatch(/^# Optional legacy developer token\. .*2026-09-09/);
        expect(鼿壍[氮壍 - 1]).not.toContain("(required for live)");
        expect(鼿壍.filter((謝壍) => 謝壍.endsWith("(required for live)"))).toHaveLength(4);
    });
});
