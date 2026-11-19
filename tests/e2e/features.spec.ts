import { expect, test } from "@playwright/test";

// Feature journeys in demo mode (pinned anchor, fresh data dir): campaign drawer + simulated pause, anomaly
// lifecycle, AI ideas, Ask-AI chat, custom REST plugin preview, Explore starter question, budget tabs.

test("campaign drawer opens from the table and a pause is simulated (read-only)", async ({ page }) => {
  await page.goto("/campaigns");
  await page.getByText("PMax — Full Catalog", { exact: true }).first().click();
  await expect(page).toHaveURL(/campaign=c3/);
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: "PMax — Full Catalog" })).toBeVisible();
  await expect(drawer.getByText(/daily budget/i).first()).toBeVisible();

  await drawer.getByRole("button", { name: "Pause campaign" }).click();
  await expect(page.getByText(/simulated/i).first()).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Enable campaign" })).toBeVisible({ timeout: 10_000 });
  await drawer.getByRole("button", { name: "Enable campaign" }).click();
  await expect(drawer.getByRole("button", { name: "Pause campaign" })).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press("Escape");
  await expect(page).not.toHaveURL(/campaign=/);
});

test("anomaly lifecycle: acknowledge and reopen a signal", async ({ page }) => {
  await page.goto("/anomalies");
  await expect(page.getByText("CPA up 92%").first()).toBeVisible({ timeout: 20_000 });
  const card = page.locator("article, section, div").filter({ has: page.getByText("CPA up 92%", { exact: true }) }).filter({ has: page.getByRole("button", { name: "Acknowledge" }) }).last();
  await card.getByRole("button", { name: "Acknowledge" }).click();
  await page.getByRole("tab", { name: /Acknowledged/ }).or(page.getByRole("button", { name: /Acknowledged/ })).first().click();
  await expect(page.getByText("CPA up 92%").first()).toBeVisible();
  await page.getByRole("button", { name: "Reopen" }).first().click();
});

test("a spend jump caused by the account's own budget raise is explained by the change history", async ({ page }) => {
  await page.goto("/anomalies");
  await expect(page.getByText("CPA up 92%").first()).toBeVisible({ timeout: 20_000 });
  // demo: c2's budget was raised 40% two days before the anchor, so its spend signal is "Expected"
  await expect(page.getByText(/Budget \+40%/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Analyze the impact of/ }).first()).toBeVisible();
});

test("AI ideas are generated from account data (demo engine)", async ({ page }) => {
  await page.goto("/ai");
  await page.getByRole("button", { name: /Generate ideas/ }).click();
  await expect(page.getByText(/Demo suggestions/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /Add to plan/ }).first()).toBeVisible();
});

test("Ask AI answers with real query results", async ({ page }) => {
  await page.goto("/overview");
  await page.getByRole("button", { name: /Ask AI/ }).click();
  const chat = page.getByRole("dialog", { name: /Ask your data/ });
  await chat.getByRole("button", { name: /Top 5 campaigns by ROAS last 7 days/ }).click();
  await expect(chat.getByText(/Top 5 campaigns by ROAS/).first()).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByRole("button", { name: /Open in Explore/ }).first()).toBeVisible({ timeout: 30_000 });
});

test("custom REST plugin previews rows from the mock platform", async ({ page }) => {
  await page.goto("/plugins?build=1&step=preview");
  const preview = page.getByRole("button", { name: "Test & preview rows" });
  if (!(await preview.isVisible())) {
    await page.getByRole("button", { name: "Build a custom plugin" }).click();
    await page.getByRole("tab", { name: /Preview/ }).or(page.getByRole("button", { name: /Preview & save/ })).first().click();
  }
  await page.getByRole("button", { name: "Test & preview rows" }).click();
  await expect(page.getByText(/\d+ mapped rows/).first()).toBeVisible({ timeout: 20_000 });
});

test("Explore opens a starter question and renders it", async ({ page }) => {
  await page.goto("/explore");
  await page.getByText("Spend and ROAS by campaign type").first().click();
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByRole("button", { name: /Save question/ })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("tab", { name: /Table/ }).first().click();
  await expect(page.getByRole("cell", { name: "Search", exact: true }).first()).toBeVisible();
});

test("budget planner tabs render", async ({ page }) => {
  await page.goto("/budget");
  await expect(page.getByText(/Spent to date/i).first()).toBeVisible({ timeout: 20_000 });
  for (const tab of ["Optimizer", "Forecast", "Simulators", "Plans"]) {
    await page.getByRole("radio", { name: tab }).or(page.getByRole("tab", { name: tab })).or(page.getByRole("link", { name: tab })).first().click();
    await expect(page).toHaveURL(new RegExp(`tab=${tab.toLowerCase()}`));
  }
});

test("Simulators shows Google's estimates next to our model and which one leads", async ({ page }) => {
  await page.goto("/budget?tab=simulators");
  await expect(page.getByText("Google's simulators and our model").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("What if one campaign's daily budget changes?").first()).toBeVisible();
  await expect(page.getByText("Campaign what-if").first()).toBeVisible();
  await expect(page.getByText("Google's budget recommendations").first()).toBeVisible();
  // the optimizer says which curves priced the split
  await page.goto("/budget?tab=optimizer");
  await expect(page.getByText(/Google's budget simulators price \d+ of \d+ budgets/).first()).toBeVisible({ timeout: 20_000 });
});

test("the SQLite warehouse syncs every demo account and shows what it stored", async ({ page }) => {
  await page.goto("/data-source/warehouse");
  await expect(page.getByText("SQLite warehouse").first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Sync all accounts" }).click();
  const runs = page.getByRole("table", { name: "Recent warehouse syncs" });
  await expect(runs.getByText("OK").first()).toBeVisible({ timeout: 30_000 });
  const tables = page.getByRole("table", { name: /^Warehouse tables for / });
  await expect(tables.getByText("fact_campaign_daily")).toBeVisible();
  await expect(tables.getByText("400 days").first()).toBeVisible();
  // monthly totals straight from the warehouse (ECharts replaces the chart's label with its own data description)
  await expect(page.getByText("Spend by month")).toBeVisible();
  await expect(page.getByRole("img", { name: /Bar chart/ }).first()).toBeVisible();
});
