import { expect, test } from "@playwright/test";

// Shell smoke: every page renders its headline without runtime errors, the demo banner explains why, and secrets
// never reach the browser.

const PAGES: [string, string][] = [
  ["/overview", "What is actually driving your growth?"],
  ["/campaigns", "Every campaign, measured"],
  ["/budget", "Spend smarter, not louder"],
  ["/anomalies", "Signal, before it becomes cost"],
  ["/ai", "Campaigns your data is asking for"],
  ["/explore", "Ask the data a better question"],
  ["/channels", "Every platform, one ledger"],
  ["/plugins", "One spine, every channel"],
  ["/data-source", "Own the pipeline"],
  ["/data-source/warehouse", "Own the pipeline"],
  ["/clients", "Every client, one view"],
  ["/access", "Who sees what"],
];

for (const [path, headline] of PAGES) {
  test(`${path} renders`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(headline);
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: /Overview/ })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("demo banner states the exact reason", async ({ page }) => {
  await page.goto("/overview");
  await expect(page.getByRole("note")).toContainText("Demo mode is forced on");
});

test("theme choice persists across reloads", async ({ page }) => {
  await page.goto("/overview");
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("switch", { name: "Dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("command palette navigates", async ({ page }) => {
  await page.goto("/overview");
  await page.keyboard.press("ControlOrMeta+k");
  const input = page.getByRole("combobox").or(page.getByPlaceholder(/search|type a command/i)).first();
  await expect(input).toBeVisible();
  await input.fill("Budget planner");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/budget/);
});

test(".env is never served and status only exposes masked values", async ({ request }) => {
  expect((await request.get("/.env")).status()).toBe(404);
  const raw = await (await request.get("/api/status")).text();
  expect(raw).not.toContain("e2e-fake-developer-token-7Q2x");
  expect(raw).not.toContain("e2e-fake-cron-secret-9Kd3");
  const status = JSON.parse(raw);
  expect(status.mode).toBe("demo");
  expect(status.reason.code).toBe("forced");
  for (const e of status.env as { secret: boolean; set: boolean; masked: string | null }[]) {
    if (e.secret && e.set) expect(e.masked).toMatch(/^[•*…]+.{0,4}$/);
  }
});

test("writes without a same-origin JSON request are rejected (CSRF)", async ({ request }) => {
  const res = await request.post("/api/dashboards", { data: { template: "blank" }, headers: { Origin: "https://evil.example" } });
  expect(res.status()).toBe(403);
});
