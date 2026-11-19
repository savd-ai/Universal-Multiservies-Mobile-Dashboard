import { expect, test } from "@playwright/test";

// Sign-in and multi-tenancy journeys: the login wall, a wrong password, the cross-client Clients page, and a
// client viewer invited from Access who only sees their own account and can't change anything.

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("pages redirect to sign-in and a wrong password is refused", async ({ page }) => {
    await page.goto("/campaigns");
    await expect(page).toHaveURL(/\/login\?next=%2Fcampaigns/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome back");
    await page.getByLabel("Email").fill("admin@savd.test");
    await page.getByLabel("Password").fill("not the password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("Email or password is incorrect")).toBeVisible();
  });

  test("the API answers 401 without a session", async ({ request }) => {
    expect((await request.get("/api/status")).status()).toBe(401);
    expect((await request.get("/api/health")).status()).toBe(200);
  });
});

test("the Clients page lists every demo client for the agency", async ({ page }) => {
  await page.goto("/clients");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Every client, one view");
  await expect(page.getByText("Acme Running Co.", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Trail Gear Outlet", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/critical/).first()).toBeVisible();
});

test("a client viewer only sees their own account and can't edit", async ({ page, browser }) => {
  await page.goto("/access");
  await page.getByRole("button", { name: "Invite someone" }).click();
  const invite = page.getByRole("dialog", { name: "Invite someone" });
  await invite.getByLabel("Name").fill("Viv Viewer");
  await invite.getByLabel("Email").fill("viv@trailgear.test");
  await invite.getByLabel("Role").selectOption("client_viewer");
  await invite.getByLabel("Client").selectOption({ label: "Trail Gear Outlet" });
  await invite.getByRole("button", { name: "Create invite link" }).click();
  const linkDialog = page.getByRole("dialog", { name: /Send this link to viv@trailgear.test/ });
  const url = (await linkDialog.locator("pre").innerText()).trim();
  expect(url).toMatch(/\/invite\/[\w-]{20,}$/);

  const guest = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const p = await guest.newPage();
  await p.goto(new URL(url).pathname);
  await expect(p.getByRole("heading", { level: 1 })).toHaveText("Set your password");
  await p.getByLabel("Password", { exact: true }).fill("viv's long password");
  await p.getByLabel("Repeat password").fill("viv's long password");
  await p.getByRole("button", { name: /Create account and sign in/ }).click();
  await expect(p).toHaveURL(/\/overview/, { timeout: 30_000 });
  // one account → the breadcrumb shows it without a switcher
  await expect(p.locator("header").first()).toContainText(/Trail Gear Outlet/i);
  await expect(p.getByRole("button", { name: "Switch account" })).toHaveCount(0);
  await expect(p.getByRole("button", { name: "Customize dashboard" })).toHaveCount(0);
  await expect(p.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: /Data source/ })).toHaveCount(0);
  await p.goto("/data-source");
  await expect(p.getByRole("heading", { level: 1 })).toHaveText("Not for your role");
  await p.goto("/anomalies/rules");
  await expect(p.getByRole("heading", { level: 1 })).toHaveText("Not for your role");
  await p.goto("/budget?tab=optimizer");
  await expect(p.getByText(/(Google's budget simulators price|Our model prices) (all )?\d+/).first()).toBeVisible({ timeout: 30_000 });
  // LiveGuard: the simulated apply is shown but blocked for the role
  await expect(p.getByTitle("Your role can't make changes here.").filter({ has: p.getByRole("button", { name: "Apply daily budgets" }) })).toBeVisible();
  await expect(p.getByRole("button", { name: "Save as targets" })).toHaveCount(0);
  const other = await p.request.get("/api/status", { headers: { "x-savd-account": "4821193307" } });
  expect(other.status()).toBe(403);
  await guest.close();
});
