import { devices, expect, test, type Page } from "@playwright/test";

// Phones: a 360 px Android screen (the narrowest common width). Every page fits without sideways scrolling (wide tables
// scroll inside their own card), the layout viewport is never widened (which would zoom the whole page out), the
// navigation lives in a drawer, the campaign column stays put while the metrics scroll, and lists come before their
// settings panels.

test.use({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: devices["Pixel 7"].userAgent });

const PAGES = ["/overview", "/campaigns", "/campaigns/c1", "/budget", "/budget?tab=optimizer", "/anomalies", "/anomalies/rules", "/ai", "/ai/ad-copy", "/explore", "/channels", "/plugins", "/data-source", "/data-source/warehouse", "/clients", "/access", "/account"];

/** Elements that stick out of the screen (outside any sideways-scrolling container) or out of a clipping card. */
async function overflowing(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bad: Element[] = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest("[aria-hidden=true], canvas, svg, .sr-only, [data-radix-popper-content-wrapper]")) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width < 2 || r.height < 2 || (cs.position === "absolute" && parseFloat(cs.width) <= 1)) continue;
      let verdict = r.right > vw + 1 ? "page" : "ok";
      for (let q = el.parentElement; q && q !== document.body; q = q.parentElement) {
        const qs = getComputedStyle(q);
        if (qs.overflowX === "auto" || qs.overflowX === "scroll") {
          verdict = "ok";
          break;
        }
        if ((qs.overflowX === "hidden" || qs.overflowX === "clip") && qs.textOverflow !== "ellipsis" && qs.whiteSpace !== "nowrap") {
          const qr = q.getBoundingClientRect();
          verdict = r.right > qr.right + 2 && r.left < qr.right ? "clipped" : "ok";
          break;
        }
      }
      if (verdict !== "ok") bad.push(el);
    }
    return bad.filter((el) => !bad.some((o) => o !== el && o.contains(el))).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} "${(el.textContent ?? "").trim().slice(0, 30)}"`);
  });
}

for (const path of PAGES) {
  test(`${path} fits a phone screen`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // let lazy widgets and tables render
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => window.innerWidth)).toBe(360);
    expect(await overflowing(page)).toEqual([]);
  });
}

test("the top bar keeps to two rows: menu, account, alerts, Ask AI and the user button, then the date range", async ({ page }) => {
  await page.goto("/overview");
  const header = page.locator("header").first();
  await expect(header.getByRole("button", { name: /Account menu/ })).toBeVisible();
  const [bar, menu, user] = await Promise.all([header.boundingBox(), header.getByRole("button", { name: "Open navigation" }).boundingBox(), header.getByRole("button", { name: /Account menu/ }).boundingBox()]);
  // the user button sits on the first row, next to the menu button (it used to wrap onto a row of its own)
  expect(Math.abs((user?.y ?? 0) - (menu?.y ?? 100))).toBeLessThan(8);
  expect(bar?.height ?? 999).toBeLessThan(130);
});

test("the navigation drawer opens, navigates and closes", async ({ page }) => {
  await page.goto("/overview");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
  await page.getByRole("button", { name: "Open navigation" }).tap();
  const drawer = page.getByRole("dialog", { name: "Navigation" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link", { name: /Campaigns/ }).tap();
  await expect(page).toHaveURL(/\/campaigns/);
  await expect(drawer).toBeHidden();
  await page.getByRole("button", { name: "Open navigation" }).tap();
  await page.getByRole("button", { name: "Close navigation" }).tap();
  await expect(page.getByRole("dialog", { name: "Navigation" })).toBeHidden();
});

test("the campaign column stays visible while the metrics scroll sideways", async ({ page }) => {
  await page.goto("/campaigns");
  const table = page.getByRole("table", { name: "Campaigns" });
  const name = table.getByRole("rowheader").first();
  await expect(name).toBeVisible();
  const before = await name.boundingBox();
  await table.evaluate((t) => {
    (t.parentElement as HTMLElement).scrollLeft = 400;
  });
  await expect.poll(async () => (await name.boundingBox())?.x).toBeLessThanOrEqual((before?.x ?? 0) + 1);
  const box = await name.boundingBox();
  const card = await table.evaluate((t) => (t.parentElement as HTMLElement).getBoundingClientRect().left);
  // stuck to the card's left edge, not scrolled out of view
  expect(box?.x ?? -1).toBeGreaterThanOrEqual(card - 1);
});

test("signals come before the detection rules on a phone", async ({ page }) => {
  await page.goto("/anomalies");
  const firstSignal = page.getByRole("button", { name: "Acknowledge" }).first();
  await expect(firstSignal).toBeVisible();
  const rules = page.getByRole("complementary", { name: "Detection rules" });
  const [s, r] = await Promise.all([firstSignal.boundingBox(), rules.boundingBox()]);
  expect(s?.y ?? Infinity).toBeLessThan(r?.y ?? 0);
});
