// Screenshots for the docs (docs/images/*.png, shared by the Vietnamese and English guides). Starts `next start` on
// DOCS_PORT (default 3200) with a throwaway data directory, creates the first agency admin through /api/auth/setup
// (the demo clients come with it), walks the app signed in at 1440 × 900 in the light theme and writes one PNG per
// step (plus one figure of three phone screens). Build first: `npm run build && npm run docs:screenshots`
// (PLAYWRIGHT_CHANNEL=chrome uses the installed Chrome). Pass shot names to retake only those:
// `npm run docs:screenshots -- 02-tong-quan 13-ngan-sach`.

import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const PORT = Number(process.env.DOCS_PORT ?? 3200);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.resolve("docs/images");
const VIEWPORT = { width: 1440, height: 900 };
/** a 390 × 844 phone (iPhone 14/15 class) at 2× */
const PHONE = { width: 390, height: 844 };
const only = process.argv.slice(2);

// Never photograph a live account: drop Google Ads keys from the inherited env and force demo mode when a local
// .env file exists (the banner then says "forced" instead of naming the missing file).
const hasEnvFile = [".env", ".env.local", ".env.production", ".env.production.local"].some((f) => existsSync(f));
const dataDir = mkdtempSync(path.join(tmpdir(), "savd-docs-"));
const setupCode = `docs-${randomBytes(6).toString("hex")}`;
const ADMIN = { email: "admin@savd.example", name: "SAVD Admin", password: `docs ${randomBytes(9).toString("base64url")}` };
const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GOOGLE_ADS_") && !k.startsWith("AUTH_"))),
  DATA_DIR: dataDir,
  AI_PROVIDER: "demo",
  DEV_MOCK_PLATFORM: "true",
  ALERTS_SCHEDULER_ENABLED: "false",
  AUTH_MODE: "required",
  AUTH_SETUP_TOKEN: setupCode,
  ...(hasEnvFile ? { DASHBOARD_FORCE_DEMO: "true" } : {}),
};

const byRole = (p, role, name, exact = true) => p.getByRole(role, { name, exact });

/** Scroll so the element sits just under the sticky header. */
async function scrollTo(locator, offset = 96) {
  await locator.evaluate((el, off) => {
    el.scrollIntoView({ block: "start" });
    window.scrollBy(0, -off);
  }, offset);
}

/** Union of the elements' boxes plus padding, clamped to the viewport. */
async function around(locators, pad = 20) {
  const boxes = (await Promise.all(locators.map((l) => l.boundingBox()))).filter(Boolean);
  const x0 = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad);
  const y0 = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad);
  const x1 = Math.min(VIEWPORT.width, Math.max(...boxes.map((b) => b.x + b.width)) + pad);
  const y1 = Math.min(VIEWPORT.height, Math.max(...boxes.map((b) => b.y + b.height)) + pad);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

async function settle(page) {
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => !document.querySelector(".animate-shimmer"), null, { timeout: 20_000 }).catch(() => undefined);
  // toasts (2.4 s, 5 s with an action) would cover the content
  await page.waitForFunction(() => !document.querySelector('div.fixed[role="status"]')?.childElementCount, null, { timeout: 8_000 }).catch(() => undefined);
  await page.waitForTimeout(800); // chart transitions
}

// Each shot: page URL, optional steps, optional clip (a function returning the rectangle to keep); `signedOut` uses a
// browser context without the admin session; `phone` takes one screenshot per frame on a phone and lays them out side
// by side in one landscape figure (a single tall phone screenshot would not fit a Word page).
const SHOTS = [
  { name: "01-dang-nhap", url: "/login", signedOut: true },
  { name: "02-tong-quan", url: "/overview" },
  { name: "03-tong-quan-widget", url: "/overview", run: (p) => scrollTo(byRole(p, "heading", "Anomalies")) },
  {
    name: "04-khoang-thoi-gian",
    url: "/overview",
    run: (p) => byRole(p, "button", "More date ranges and comparison").click(),
    clip: (p) => around([p.locator("header").first(), p.getByRole("dialog").last()]),
  },
  {
    name: "05-bo-loc",
    url: "/overview",
    run: async (p) => {
      await byRole(p, "toolbar", "Dashboard filters").getByRole("button", { name: "PMax", exact: true }).click();
      await settle(p);
      await byRole(p, "toolbar", "Dashboard filters").getByRole("button", { name: /^Device/ }).click();
    },
  },
  { name: "06-tuy-bien", url: "/overview", run: (p) => byRole(p, "button", "Customize dashboard").click() },
  {
    name: "07-thu-vien-widget",
    url: "/overview",
    run: async (p) => {
      await byRole(p, "button", "Customize dashboard").click();
      await byRole(p, "button", "+ Add widget").click();
    },
  },
  {
    name: "08-cau-hinh-widget",
    url: "/overview",
    run: async (p) => {
      await byRole(p, "button", "Spend & conversions options").click();
      await byRole(p, "menuitem", "Settings…").click();
    },
  },
  {
    name: "09-menu-dashboard",
    url: "/overview",
    run: (p) => byRole(p, "button", "Dashboard options").click(),
    clip: (p) => around([byRole(p, "button", "Dashboard options"), p.getByRole("menu")], 24),
  },
  { name: "10-chien-dich", url: "/campaigns" },
  { name: "11-chien-dich-ngan-keo", url: "/campaigns?campaign=c3" },
  { name: "12-chien-dich-chi-tiet", url: "/campaigns/c6?tab=changes" },
  { name: "13-ngan-sach", url: "/budget" },
  { name: "14-toi-uu-ngan-sach", url: "/budget?tab=optimizer" },
  { name: "15-du-bao", url: "/budget?tab=forecast" },
  { name: "16-mo-phong-google", url: "/budget?tab=simulators" },
  {
    name: "17-ke-hoach",
    url: "/budget?tab=plans",
    run: async (p) => {
      await byRole(p, "button", "Create a plan").click();
      await byRole(p, "button", "Create plan").click();
      await p.getByRole("dialog").waitFor({ state: "hidden" });
    },
  },
  { name: "18-bat-thuong", url: "/anomalies" },
  // c2's spend jump follows the planted +40% budget raise: the card shows the "Expected" verdict and the change
  { name: "19-boi-canh-thay-doi", url: "/anomalies", run: (p) => scrollTo(p.locator("article").filter({ hasText: /Budget \+40%/ }).first(), 120) },
  { name: "20-giai-thich", url: "/anomalies", run: (p) => p.getByRole("button", { name: "Explain", exact: true }).first().click() },
  { name: "21-quy-tac", url: "/anomalies/rules" },
  { name: "22-thong-bao", url: "/anomalies/notifications" },
  {
    name: "23-y-tuong-ai",
    url: "/ai",
    run: async (p) => {
      await p.getByRole("button", { name: /Generate ideas/ }).click();
      await p.getByText(/Demo suggestions/i).first().waitFor({ timeout: 30_000 });
    },
  },
  { name: "24-blueprint", url: "/ai/blueprint" },
  {
    name: "25-noi-dung-quang-cao",
    url: "/ai/ad-copy",
    run: async (p) => {
      await p.getByLabel("Product or offer").fill("Waterproof trail running shoes");
      await p.getByLabel("Keywords").fill("trail running shoes, waterproof trail shoes");
      await p.getByLabel("Selling points").fill("Free returns, Vibram soles, 2-year warranty");
      await p.getByRole("button", { name: "Generate ad copy" }).click();
      await p.getByRole("button", { name: /^Regenerate/ }).waitFor({ timeout: 30_000 });
      await settle(p);
      await scrollTo(byRole(p, "button", /^Regenerate/, false), 200);
    },
  },
  { name: "26-tu-khoa-phu-dinh", url: "/ai/negatives" },
  {
    name: "27-hoi-ai",
    url: "/overview",
    run: async (p) => {
      await p.getByRole("button", { name: /Ask AI/ }).click();
      const chat = p.getByRole("dialog", { name: /Ask your data/ });
      await chat.getByRole("button", { name: /Top 5 campaigns by ROAS last 7 days/ }).click();
      await chat.getByRole("button", { name: /Open in Explore/ }).first().waitFor({ timeout: 30_000 });
    },
  },
  {
    name: "28-explore",
    url: "/explore",
    run: async (p) => {
      await p.getByText("Spend and ROAS by campaign type").first().click();
      await p.getByRole("button", { name: /Save question/ }).waitFor({ timeout: 20_000 });
    },
  },
  { name: "29-kenh", url: "/channels" },
  { name: "30-plugins", url: "/plugins" },
  {
    name: "31-plugin-rest",
    url: "/plugins?build=1&step=preview",
    run: async (p) => {
      await p.getByRole("button", { name: "Test & preview rows" }).click();
      await p.getByText(/\d+ mapped rows/).first().waitFor({ timeout: 20_000 });
      await settle(p);
      await scrollTo(p.getByText(/\d+ mapped rows/).first(), 140);
    },
  },
  { name: "32-khach-hang", url: "/clients" },
  {
    name: "33-nguoi-dung",
    url: "/access",
    run: async (p) => {
      await byRole(p, "button", "Invite someone").click();
      const d = p.getByRole("dialog", { name: "Invite someone" });
      await d.getByLabel("Name").fill("Mai Nguyen");
      await d.getByLabel("Email").fill("mai@trailgear.example");
      await d.getByLabel("Role").selectOption("client_viewer");
      await d.getByLabel("Client").selectOption({ label: "Trail Gear Outlet" });
    },
  },
  { name: "34-quan-ly-khach-hang", url: "/access/clients" },
  { name: "35-bao-mat", url: "/account" },
  { name: "36-nguon-du-lieu", url: "/data-source" },
  {
    name: "37-kho-du-lieu",
    url: "/data-source/warehouse",
    run: async (p) => {
      await byRole(p, "button", "Sync all accounts").click();
      await p.getByRole("table", { name: "Recent warehouse syncs" }).getByText("OK").first().waitFor({ timeout: 60_000 });
    },
  },
  { name: "38-tuy-chon", url: "/data-source", run: (p) => scrollTo(p.getByText("Display preferences", { exact: true })) },
  {
    name: "39-bang-lenh",
    url: "/overview",
    run: async (p) => {
      await p.keyboard.press("ControlOrMeta+k");
      await p.getByRole("combobox").first().waitFor();
    },
  },
  { name: "40-giao-dien-toi", url: "/overview", theme: "dark" },
  { name: "41-che-do-tv", url: "/tv/overview" },
  {
    name: "42-dien-thoai",
    phone: [
      { url: "/overview" },
      { url: "/overview", run: (p) => byRole(p, "button", "Open navigation").click() },
      {
        url: "/campaigns",
        run: async (p) => {
          const table = p.getByRole("table", { name: "Campaigns" });
          await scrollTo(table, 110);
          // the metrics scroll sideways under the campaign column, which stays put
          await table.evaluate((t) => {
            t.parentElement.scrollLeft = 300;
          });
        },
      },
    ],
  },
];

/** Lay phone screenshots (PNG buffers) side by side on the page background, with rounded screen corners. */
async function composePhones(browser, frames, file) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
  try {
    const page = await ctx.newPage();
    const imgs = frames.map((b) => `<img alt="" src="data:image/png;base64,${b.toString("base64")}" style="width:${PHONE.width}px;height:${PHONE.height}px;border-radius:30px;border:1px solid rgba(60,60,67,0.2);box-shadow:0 20px 44px -26px rgba(0,0,0,0.4)">`);
    await page.setContent(`<body style="margin:0;background:#f2f2f7"><div id="frames" style="display:inline-flex;gap:32px;padding:32px">${imgs.join("")}</div></body>`);
    await page.locator("#frames").screenshot({ path: file });
  } finally {
    await ctx.close();
  }
}

/** Create the first admin through the API and return its session cookie. */
async function signIn() {
  const res = await fetch(`${BASE}/api/auth/setup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: setupCode, ...ADMIN }) });
  const cookie = (res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""]).find((c) => c.startsWith("savd-session="));
  if (!res.ok || !cookie) throw new Error(`setup failed: HTTP ${res.status} ${await res.text()}`);
  return { name: "savd-session", value: cookie.split(";")[0].slice("savd-session=".length), url: BASE };
}

async function waitForServer(timeoutMs = 90_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`the server did not start on ${BASE}`);
}

async function main() {
  if (!existsSync(".next/BUILD_ID")) throw new Error("no production build — run `npm run build` first");
  if (await fetch(`${BASE}/api/health`).then(() => true, () => false)) throw new Error(`port ${PORT} is busy — set DOCS_PORT`);
  mkdirSync(OUT, { recursive: true });

  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], { env, stdio: ["ignore", "ignore", "inherit"] });
  const failures = [];
  let browser;
  try {
    await waitForServer();
    const session = await signIn();
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
    const contexts = {};
    const contextFor = async (theme, signedOut, phone = false) => {
      const key = `${theme}${signedOut ? ":out" : ""}${phone ? ":phone" : ""}`;
      if (!contexts[key]) {
        const device = phone ? { viewport: PHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: VIEWPORT };
        contexts[key] = await browser.newContext({ ...device, locale: "en-US", reducedMotion: "reduce", colorScheme: theme });
        if (!signedOut) await contexts[key].addCookies([session]);
        await contexts[key].addInitScript((t) => {
          try {
            localStorage.setItem("savd-gads-theme", t);
          } catch {
            // storage blocked: the default (light) theme applies
          }
        }, theme);
      }
      return contexts[key];
    };

    for (const shot of SHOTS.filter((s) => !only.length || only.includes(s.name))) {
      if (shot.phone) {
        try {
          const frames = [];
          for (const frame of shot.phone) {
            const page = await (await contextFor(shot.theme ?? "light", false, true)).newPage();
            try {
              await page.goto(`${BASE}${frame.url}`);
              await settle(page);
              if (frame.run) {
                await frame.run(page);
                await settle(page);
              }
              frames.push(await page.screenshot());
            } finally {
              await page.close();
            }
          }
          await composePhones(browser, frames, path.join(OUT, `${shot.name}.png`));
          console.log(`✓ ${shot.name}`);
        } catch (err) {
          failures.push(shot.name);
          console.error(`✗ ${shot.name}: ${err instanceof Error ? err.message.split("\n")[0] : err}`);
        }
        continue;
      }
      const page = await (await contextFor(shot.theme ?? "light", !!shot.signedOut)).newPage();
      try {
        await page.goto(`${BASE}${shot.url}`);
        await settle(page);
        if (shot.run) {
          await shot.run(page);
          await settle(page);
        }
        const clip = shot.clip ? await shot.clip(page) : undefined;
        await page.screenshot({ path: path.join(OUT, `${shot.name}.png`), clip });
        console.log(`✓ ${shot.name}`);
      } catch (err) {
        failures.push(shot.name);
        console.error(`✗ ${shot.name}: ${err instanceof Error ? err.message.split("\n")[0] : err}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser?.close();
    server.kill();
    rmSync(dataDir, { recursive: true, force: true });
  }
  if (failures.length) {
    console.error(`${failures.length} screenshot(s) failed: ${failures.join(", ")}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
