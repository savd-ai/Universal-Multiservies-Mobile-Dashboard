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
        const token = ENV_VARS.find((v) => v.key === "GOOGLE_ADS_DEVELOPER_TOKEN");
        expect(token).toMatchObject({ group: "google_ads", secret: true });
        expect(token?.requiredForLive).toBeFalsy();
        expect(SECRET_KEYS.has("GOOGLE_ADS_DEVELOPER_TOKEN")).toBe(true);
    });
    it("documents the token as optional in .env.example", () => {
        const lines = renderEnvExample().split("\n");
        const i = lines.indexOf("GOOGLE_ADS_DEVELOPER_TOKEN=");
        expect(i).toBeGreaterThan(0);
        expect(lines[i - 1]).toMatch(/^# Optional legacy developer token\. .*2026-09-09/);
        expect(lines[i - 1]).not.toContain("(required for live)");
        expect(lines.filter((l) => l.endsWith("(required for live)"))).toHaveLength(4);
    });
});
