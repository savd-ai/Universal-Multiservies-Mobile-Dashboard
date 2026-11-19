import { expect, test, type Page } from "@playwright/test";

// Overview dashboard: the prototype's seven widgets on real (demo) data, customize → remove/undo/add persists,
// URL-backed filters and dashboard tabs.

const WIDGETS = ["Key metrics", "Spend & conversions", "Budget pacing", "Anomalies", "Campaign performance", "AI campaign ideas", "Cross-channel"];

async function widget(page: Page, title: string) {
  return page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: title, exact: true }) });
}

test("default dashboard shows the prototype widgets with data", async ({ page }) => {
  await page.goto("/overview");
  for (const t of WIDGETS) await expect(page.getByRole("heading", { level: 2, name: t, exact: true })).toBeVisible();
  const kpis = await widget(page, "Key metrics");
  await expect(kpis.getByText("Spend", { exact: true })).toBeVisible();
  await expect(kpis.getByText(/^\$\d/).first()).toBeVisible();
  const pacing = await widget(page, "Budget pacing");
  await expect(pacing.getByText("projected of budget")).toBeVisible();
  const anomalies = await widget(page, "Anomalies");
  await expect(anomalies.getByText(/Critical/i).first()).toBeVisible();
  const campaigns = await widget(page, "Campaign performance");
  await expect(campaigns.getByRole("row")).toHaveCount(7); // header + 6
});

test("customize: remove a widget, undo, add from the gallery; layout persists", async ({ page }) => {
  await page.goto("/overview");
  await page.getByRole("button", { name: "Customize dashboard" }).click();
  await expect(page.getByRole("region", { name: "Layout editor" })).toBeVisible();

  await page.getByRole("button", { name: "Remove Cross-channel" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Cross-channel", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Undo/ }).first().click();
  await expect(page.getByRole("heading", { level: 2, name: "Cross-channel", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "+ Add widget" }).click();
  const gallery = page.getByRole("dialog", { name: "Widget gallery" });
  await gallery.getByPlaceholder("Search widgets…").fill("heatmap");
  await gallery.getByRole("button", { name: /Hour × weekday/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Hour × weekday", exact: true })).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 5_000 });

  await page.getByRole("button", { name: "Done" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: "Hour × weekday", exact: true })).toBeVisible();

  // clean up: reset to the template
  await page.getByRole("button", { name: "Customize dashboard" }).click();
  await page.getByRole("button", { name: "Reset layout" }).click();
  await page.getByRole("button", { name: "Reset layout" }).last().click();
  await expect(page.getByRole("heading", { level: 2, name: "Hour × weekday", exact: true })).toHaveCount(0);
});

test("type chips filter widgets and live in the URL", async ({ page }) => {
  await page.goto("/overview");
  await page.getByRole("toolbar", { name: "Dashboard filters" }).getByRole("button", { name: "PMax", exact: true }).click();
  await expect(page).toHaveURL(/types=PMax/);
  const campaigns = await widget(page, "Campaign performance");
  await expect(campaigns.getByRole("row")).toHaveCount(2); // header + the PMax campaign
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page).not.toHaveURL(/types=/);
});

test("dashboard tabs switch dashboards", async ({ page }) => {
  await page.goto("/overview");
  await page.getByRole("navigation", { name: "Dashboards" }).getByRole("link", { name: /Executive/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The account at a glance");
  await page.getByRole("navigation", { name: "Dashboards" }).getByRole("link", { name: /Monitoring/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Quiet until it matters");
});

test("TV mode renders a dashboard without the shell", async ({ page }) => {
  await page.goto("/tv/overview");
  await expect(page.getByRole("link", { name: /Exit TV/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Key metrics", exact: true })).toBeVisible();
});
