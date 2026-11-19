#!/usr/bin/env node
// Scaffold a code plugin:
//   npm run plugin:new -- <id> [--category ad_platform|analytics|commerce|alerts] [--name "Display Name"]
// Writes src/plugins/custom/<id>/index.ts (definePlugin, demo-only until fetchMetrics/sendAlert is implemented)
// and tests/unit/plugins/custom-<id>.test.ts, then registers the plugin between the marker comments in
// src/plugins/custom/index.ts. Never overwrites anything; refuses reserved and existing ids.
// (--root <dir> points the script at another checkout — used by the scaffold test.)

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CATEGORIES = ["ad_platform", "analytics", "commerce", "alerts"];
const ID_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;
const RESERVED = new Set(["custom", "builtin", "index", "template", "google-ads", "google_ads", "blended", "plugin", "plugins"]);

function fail(message, code = 1) {
  console.error(`✗ ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const out = { positional: [], category: "ad_platform", name: null, root: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const [flag, inline] = a.startsWith("--") ? a.split(/=(.*)/s) : [a, undefined];
    const value = () => inline ?? argv[++i];
    if (flag === "--category") out.category = value();
    else if (flag === "--name") out.name = value();
    else if (flag === "--root") out.root = value();
    else if (flag === "--help" || flag === "-h") out.help = true;
    else if (a.startsWith("--")) fail(`Unknown option ${a}`);
    else out.positional.push(a);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const usage = 'Usage: npm run plugin:new -- <id> [--category ad_platform|analytics|commerce|alerts] [--name "Display Name"]';
if (args.help) {
  console.log(usage);
  process.exit(0);
}
const id = args.positional[0];
if (!id || args.positional.length > 1) fail(usage);
if (!ID_RE.test(id) || id.endsWith("-") || id.includes("--")) fail(`"${id}" is not a valid plugin id — use 2–41 lowercase letters, digits and single dashes (e.g. acme-ads).`);
if (id.startsWith("custom-")) fail(`Ids starting with "custom-" are reserved for no-code REST plugins built in the Plugins page.`);
if (!CATEGORIES.includes(args.category)) fail(`--category must be one of ${CATEGORIES.join(", ")}`);

const root = path.resolve(args.root ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
const customDir = path.join(root, "src", "plugins", "custom");
const indexPath = path.join(customDir, "index.ts");
const pluginDir = path.join(customDir, id);
const pluginPath = path.join(pluginDir, "index.ts");
const testPath = path.join(root, "tests", "unit", "plugins", `custom-${id}.test.ts`);

// Built-in ids are reserved (read from the catalog sources so the list never drifts).
for (const file of ["catalog.ts", "alerts.ts"]) {
  const p = path.join(root, "src", "plugins", "builtin", file);
  if (!existsSync(p)) continue;
  for (const m of readFileSync(p, "utf8").matchAll(/\bid:\s*"([a-z0-9-]+)"/g)) RESERVED.add(m[1]);
}
if (RESERVED.has(id)) fail(`"${id}" is reserved (built-in plugin or internal name) — pick another id.`);
if (!existsSync(indexPath)) fail(`Can't find ${path.relative(root, indexPath)}`);
if (existsSync(pluginDir)) fail(`${path.relative(root, pluginDir)} already exists — nothing was changed.`);
if (existsSync(testPath)) fail(`${path.relative(root, testPath)} already exists — nothing was changed.`);

const camel = id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const ident = `${/^[0-9]/.test(camel) ? `p${camel}` : camel}Plugin`;
const index = readFileSync(indexPath, "utf8");
const markers = ["// plugin-imports:start", "// plugin-imports:end", "// plugin-list:start", "// plugin-list:end"];
for (const mk of markers) {
  const n = index.split(mk).length - 1;
  if (n !== 1) fail(`${path.relative(root, indexPath)} must contain the marker "${mk}" exactly once (found ${n}).`);
}
if (index.includes(`from "./${id}"`) || new RegExp(`\\b${ident}\\b`).test(index)) fail(`${id} is already registered in ${path.relative(root, indexPath)}.`);

const name = (args.name ?? id.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")).trim().slice(0, 60);
if (!name) fail("--name can't be empty");
const abbr = (name.split(/\s+/).map((w) => w[0]).join("").replace(/[^A-Za-z0-9]/g, "") || id).slice(0, 2).toUpperCase().padEnd(2, "X");
const envBase = `PLUGIN_${id.toUpperCase().replace(/-/g, "_")}`;
const q = (s) => JSON.stringify(s);

function metricsPlugin(kind) {
  const envKey = `${envBase}_API_KEY`;
  const describe = { ad_platform: "ad spend, clicks and conversions", analytics: "sessions and conversions", commerce: "orders and store revenue (feeds MER)" }[kind];
  const rowType = { ad_platform: "{ date: string; spend: number; clicks?: number; impressions?: number; conversions?: number; revenue?: number }", analytics: "{ date: string; sessions: number; conversions?: number; revenue?: number }", commerce: "{ date: string; revenue: number; orders?: number }" }[kind];
  const mapping = {
    ad_platform: ["cost: r.spend,", "clicks: r.clicks ?? 0,", "impressions: r.impressions ?? 0,", "conversions: r.conversions ?? 0,", "conv_value: r.revenue ?? 0,"],
    analytics: ["cost: 0,", "clicks: 0,", "impressions: 0,", "conversions: r.conversions ?? 0,", "conv_value: r.revenue ?? 0,", "sessions: r.sessions,"],
    commerce: ["cost: 0,", "clicks: 0,", "impressions: 0,", "conversions: 0,", "conv_value: 0,", "store_revenue: r.revenue,", "orders: r.orders ?? 0,"],
  }[kind].map((l) => `      ${l}`).join("\n");
  return `import "server-only";
import { demoPlatformRowsFromTotals } from "@/lib/domain/demo/generator";
import type { PlatformDailyRow } from "@/lib/domain/schema/facts";
import { definePlugin } from "@/lib/server/plugins/define";

// ${name} — code plugin scaffolded by \`npm run plugin:new\`. It runs on seeded demo data (manifest.live = false)
// until fetchMetrics() talks to the real API. To go live: implement fetchMetrics, add ${envKey} to
// src/lib/server/env/registry.ts (secret: true, so logs redact it) and set live: true.

const PLATFORM_ID = ${q(id)};

export const ${ident} = definePlugin({
  manifest: {
    id: PLATFORM_ID,
    name: ${q(name)},
    version: "0.1.0",
    kind: "code",
    category: ${q(kind)},
    description: ${q(`${name} ${describe} (code plugin — demo data until fetchMetrics is implemented).`)},
    icon: { abbr: ${q(abbr)} },
    capabilities: ["metrics.read"],
    live: false,
    env: [{ key: ${q(envKey)}, label: "API key", secret: true, required: true }],
    refresh: "hourly",
  },
  demoKind: ${q(kind)},
  // Seeded rows shaped relative to Google Ads spend, so dashboards and the Channels page have data meanwhile.
  demo: (range, ctx) => demoPlatformRowsFromTotals(ctx.google.filter((g) => g.date >= range.start && g.date <= range.end), ctx.account, PLATFORM_ID, ${q(kind)}, ctx.seed),
  async fetchMetrics(range, ctx): Promise<PlatformDailyRow[]> {
    // TODO: call the real reporting API. ctx.fetch is SSRF-guarded (https only, no private networks, size and
    // time limits) and ctx.env holds only the keys declared in manifest.env.
    const apiKey = ctx.env.${envKey};
    if (!apiKey) throw new Error("${envKey} is not set");
    const url = \`https://api.example.com/v1/reports?start=\${range.start}&end=\${range.end}\`;
    const res = await ctx.fetch(url, { headers: { Authorization: \`Bearer \${apiKey}\`, Accept: "application/json" } });
    if (!res.ok) throw new Error(\`${name} API answered HTTP \${res.status}\`);
    const body = (await res.json()) as { rows?: ${rowType}[] };
    return (body.rows ?? []).map((r) => ({
      date: r.date,
      account_id: ctx.account.id,
      platform: PLATFORM_ID,
      currency: ctx.account.currency,
${mapping}
    }));
  },
});
`;
}

function alertsPlugin() {
  const envKey = `${envBase}_WEBHOOK_URL`;
  return `import "server-only";
import { plainTextAlert } from "@/lib/domain/alerts/formatters";
import { definePlugin } from "@/lib/server/plugins/define";

// ${name} — alert plugin scaffolded by \`npm run plugin:new\`. Demo-only (manifest.live = false) until sendAlert()
// posts the right payload. To go live: add ${envKey} to src/lib/server/env/registry.ts (secret: true), set
// live: true, and add the id to ALERT_CHANNEL_PLUGINS (contracts/alerts.ts) so alert routes can target it.

export const ${ident} = definePlugin({
  manifest: {
    id: ${q(id)},
    name: ${q(name)},
    version: "0.1.0",
    kind: "code",
    category: "alerts",
    description: ${q(`Alerts posted to ${name} (code plugin — implement sendAlert to go live).`)},
    icon: { abbr: ${q(abbr)} },
    capabilities: ["alerts.send"],
    live: false,
    env: [{ key: ${q(envKey)}, label: "Webhook URL", secret: true, required: true }],
    configFields: [{ key: "url", label: "Webhook URL", type: "secret", required: true, placeholder: "https://" }],
    refresh: "manual",
  },
  async sendAlert(msg, ctx) {
    // TODO: format the message for ${name}. ctx.fetch is SSRF-guarded; never log the URL (it is a secret).
    const url = ctx.config.url ?? ctx.env.${envKey};
    if (!url) return { ok: false, permanent: true, error: "No webhook URL configured" };
    const res = await ctx.fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: plainTextAlert(msg) }), timeoutMs: 10_000 });
    if (res.ok) return { ok: true, status: res.status };
    return { ok: false, status: res.status, permanent: res.status >= 400 && res.status < 500 && res.status !== 429, error: \`HTTP \${res.status}\` };
  },
});
`;
}

function metricsTest(kind) {
  return `import { describe, expect, it } from "vitest";
import { ${ident} } from "@/plugins/custom/${id}";

// Scaffolded by \`npm run plugin:new\` — extend with fetchMetrics tests (stub ctx.fetch) once the API is wired up.

const google = [
  { date: "2026-09-27", cost: 1000, clicks: 400, impressions: 20000, conversions: 25, conv_value: 3000 },
  { date: "2026-09-28", cost: 1200, clicks: 450, impressions: 21000, conversions: 30, conv_value: 3400 },
];

describe("${id} code plugin", () => {
  it("declares a valid, demo-only manifest", () => {
    expect(${ident}.manifest.id).toBe(${q(id)});
    expect(${ident}.manifest.kind).toBe("code");
    expect(${ident}.manifest.category).toBe(${q(kind)});
    expect(${ident}.manifest.live).toBe(false);
  });

  it("produces deterministic demo rows inside the requested range", () => {
    const range = { start: "2026-09-28", end: "2026-09-28" };
    const ctx = { account: { id: "1234567890", currency: "USD" }, google, seed: "scaffold-test" };
    const rows = ${ident}.demo?.(range, ctx) ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.platform).toBe(${q(id)});
    expect(rows[0]?.date).toBe("2026-09-28");
    expect(${ident}.demo?.(range, ctx)).toEqual(rows);
  });
});
`;
}

function alertsTest() {
  return `import { describe, expect, it } from "vitest";
import type { AlertMessage } from "@/lib/domain/contracts/alerts";
import type { PluginContext } from "@/lib/server/plugins/define";
import { ${ident} } from "@/plugins/custom/${id}";

// Scaffolded by \`npm run plugin:new\` — assert the real payload shape once sendAlert is implemented.

const msg: AlertMessage = { kind: "test", accountName: "Acme", accountId: "1", mode: "demo", signals: [], dashboardUrl: "https://dash.example.com", generatedAt: "2026-09-28T12:00:00.000Z" };

describe("${id} alert plugin", () => {
  it("declares a valid alert manifest", () => {
    expect(${ident}.manifest.id).toBe(${q(id)});
    expect(${ident}.manifest.capabilities).toContain("alerts.send");
  });

  it("posts the message through ctx.fetch", async () => {
    const calls: { url: string; body: string }[] = [];
    const ctx = {
      config: { url: "https://hooks.example.com/abc" },
      env: {},
      fetch: async (url: string, init?: RequestInit) => {
        calls.push({ url, body: String(init?.body) });
        return new Response("ok", { status: 200 });
      },
      account: { id: "1", name: "Acme", currency: "USD", timezone: "UTC", isManager: false, mode: "demo" },
      mode: "demo",
      now: new Date("2026-09-28T12:00:00Z"),
    } satisfies PluginContext;
    const res = await ${ident}.sendAlert?.(msg, ctx);
    expect(res?.ok).toBe(true);
    expect(calls[0]?.url).toBe("https://hooks.example.com/abc");
    expect(calls[0]?.body).toContain("[DEMO]");
  });
});
`;
}

const isAlerts = args.category === "alerts";
const pluginSource = isAlerts ? alertsPlugin() : metricsPlugin(args.category);
const testSource = isAlerts ? alertsTest() : metricsTest(args.category);
const nextIndex = index
  .replace("// plugin-imports:end", `import { ${ident} } from "./${id}";\n// plugin-imports:end`)
  .replace(/^([ \t]*)\/\/ plugin-list:end/m, (_, indent) => `${indent}${ident},\n${indent}// plugin-list:end`);

const created = [];
try {
  mkdirSync(pluginDir, { recursive: false });
  created.push(pluginDir);
  writeFileSync(pluginPath, pluginSource, { flag: "wx" });
  mkdirSync(path.dirname(testPath), { recursive: true });
  writeFileSync(testPath, testSource, { flag: "wx" });
  created.push(testPath);
  writeFileSync(indexPath, nextIndex);
} catch (err) {
  for (const p of created.reverse()) rmSync(p, { recursive: true, force: true });
  fail(`Scaffold failed, nothing was kept: ${err instanceof Error ? err.message : String(err)}`, 2);
}

const rel = (p) => path.relative(root, p);
console.log(`✓ Created ${isAlerts ? "alert" : "code"} plugin "${name}" (${id}, ${args.category})
  ${rel(pluginPath)}
  ${rel(testPath)}
  registered in ${rel(indexPath)}

Next: implement ${isAlerts ? "sendAlert()" : "fetchMetrics()"}, declare its env keys in src/lib/server/env/registry.ts,
set live: true, then run  npx vitest run ${rel(testPath)}  and  npm run typecheck.`);
