import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Accessibility smoke: no serious or critical axe violations on the main pages (both themes for the Overview) and the
// sign-in page.

for (const path of ["/overview", "/campaigns", "/anomalies", "/anomalies/history", "/budget", "/budget?tab=simulators", "/clients", "/access", "/account", "/data-source/warehouse"]) {
  test(`${path} has no serious accessibility violations`, async ({ page }) => {
    await page.goto(path);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.length} × ${v.help}`)).toEqual([]);
  });
}

test("overview in dark mode has no serious contrast problems", async ({ page }) => {
  await page.goto("/overview");
  await page.evaluate(() => localStorage.setItem("savd-gads-theme", "dark"));
  await page.reload();
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.nodes.length)).toEqual([]);
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/login has no serious accessibility violations", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("heading", { level: 1 }).waitFor();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.length} × ${v.help}`)).toEqual([]);
  });
});
