import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

// The "setup" project creates the first admin (fake setup code below) and saves the signed-in state; every other
// test starts signed in as that admin unless it opts out with an empty storageState.
export const ADMIN_STATE = "test-results/.auth/admin.json";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  // PLAYWRIGHT_CHANNEL=chrome uses the installed Google Chrome instead of downloading Playwright's Chromium
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, channel: process.env.PLAYWRIGHT_CHANNEL || undefined } },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, channel: process.env.PLAYWRIGHT_CHANNEL || undefined, storageState: ADMIN_STATE },
    },
  ],
  webServer: {
    // Demo mode only: no Google credentials, pinned anchor date, throwaway data directory.
    // fresh data dir every run (seeded dashboards, no leftovers from earlier runs)
    command: `node -e "require('fs').rmSync('.e2e-data',{recursive:true,force:true})" && npm run build && npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DEMO_ANCHOR_DATE: "2026-09-28",
      DATA_DIR: ".e2e-data",
      DASHBOARD_FORCE_DEMO: "true",
      AI_PROVIDER: "demo",
      DEV_MOCK_PLATFORM: "true",
      PLUGINS_ALLOW_PRIVATE_NETWORK: "true",
      AUTH_MODE: "required",
      // fake secrets: the redaction tests assert these never appear in any response
      AUTH_SETUP_TOKEN: "e2e-fake-setup-token-4Lp8",
      GOOGLE_ADS_DEVELOPER_TOKEN: "e2e-fake-developer-token-7Q2x",
      CRON_SECRET: "e2e-fake-cron-secret-9Kd3",
    },
  },
});
