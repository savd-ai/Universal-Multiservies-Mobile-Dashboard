import { expect, test as setup } from "@playwright/test";
import { ADMIN_STATE } from "../../playwright.config";

// Creates the first agency admin on a fresh server (or signs in again when the server is reused) and saves the
// session for the other tests.

export const ADMIN = { email: "admin@savd.test", name: "E2E Admin", password: "e2e admin passphrase" };

setup("sign in as the first agency admin", async ({ page }) => {
  await page.goto("/overview");
  if (page.url().includes("/setup")) {
    await page.getByLabel("Setup code").fill("e2e-fake-setup-token-4Lp8");
    await page.getByLabel("Your name").fill(ADMIN.name);
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
    await page.getByLabel("Repeat password").fill(ADMIN.password);
    await page.getByRole("button", { name: /Create admin and sign in/ }).click();
  } else {
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password").fill(ADMIN.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  }
  await expect(page).toHaveURL(/\/overview/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.context().storageState({ path: ADMIN_STATE });
});
