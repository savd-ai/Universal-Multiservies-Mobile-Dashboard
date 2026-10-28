import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
const REACT_SERVER = "--conditions=react-server";
const CLOUD_ACCESS_URL = "https://console.cloud.google.com/google/ads-apis/overview";
function relaunchWithServerCondition(): number | null {
    if (process.execArgv.includes(REACT_SERVER))
        return null;
    const child = spawnSync(process.execPath, [...process.execArgv, REACT_SERVER, ...process.argv.slice(1)], { stdio: "inherit", env: process.env });
    return child.status ?? 1;
}
const pad = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));
const padStart = (s: string, n: number) => s.padStart(n);
async function main(): Promise<number> {
    const relaunched = relaunchWithServerCondition();
    if (relaunched !== null)
        return relaunched;
    const envFile = path.resolve(process.cwd(), ".env");
    if (existsSync(envFile))
        process.loadEnvFile?.(envFile);
    const { addDays } = await import("@/lib/domain/dates");
    const { mask, missingLiveKeys } = await import("@/lib/server/env/status");
    const { googleAdsConfig } = await import("@/lib/server/env/config");
    const { redact } = await import("@/lib/server/log");
    const { createLiveGoogleAdsSource } = await import("@/lib/server/google-ads/source");
    const id = (v: string) => mask(v, false);
    try {
        console.log("SAVD · Google Ads connection check (read-only)");
        const missing = missingLiveKeys();
        if (missing.length) {
            console.error(`✗ Missing ${missing.length} required key(s): ${missing.join(", ")}${existsSync(envFile) ? "" : " (no .env file found)"}`);
            return 1;
        }
        const cfg = googleAdsConfig();
        console.log(`  API ${cfg.apiVersion} · customer ${id(cfg.customerId ?? "")} · manager ${cfg.loginCustomerId ? id(cfg.loginCustomerId) : "none"}`);
        console.log(cfg.developerToken
            ? "  Developer token: set — still sent, but ignored by Google since 2026-09-09 (safe to remove)"
            : "  Developer token: not set (optional — access level comes from the OAuth client's Google Cloud project)");
        const source = createLiveGoogleAdsSource();
        const health = await source.healthCheck();
        if (!health.ok) {
            console.error(`✗ Health check failed: ${health.errorCode ?? "UNKNOWN"}`);
            if (health.detail)
                console.error(`  ${redact(health.detail)}`);
            if (/CLOUD_PROJECT|DEVELOPER_TOKEN/.test(health.errorCode ?? "")) {
                console.error(`  Access levels (Test / Explorer / Basic / Standard) belong to the Google Cloud project that owns GOOGLE_ADS_CLIENT_ID: ${CLOUD_ACCESS_URL}`);
            }
            return 1;
        }
        console.log(`✓ Health: ${health.account?.name ?? "?"} (${id(health.account?.id ?? "")}) in ${health.latencyMs ?? "?"} ms${health.detail ? ` — ${health.detail}` : ""}`);
        const [accounts, manager] = await Promise.all([source.listAccounts(), source.manager()]);
        if (manager)
            console.log(`  Manager: ${manager.name} (${id(manager.id)})`);
        console.log(`✓ Accounts (${accounts.length}):`);
        for (const a of accounts)
            console.log(`  ${pad(id(a.id), 12)} ${pad(a.name, 32)} ${pad(a.currency, 4)} ${a.timezone}`);
        const account = accounts.find((a) => a.id === source.defaultAccountId()) ?? accounts[0];
        if (!account) {
            console.error("✗ No client account is accessible with these credentials.");
            return 1;
        }
        const through = await source.dataThrough(account.id);
        const range = { start: addDays(through, -6), end: through };
        const [slice, dims] = await Promise.all([source.getTable(account.id, "campaign_daily", range), source.getDims(account.id)]);
        const totals = new Map<string, {
            cost: number;
            clicks: number;
            conversions: number;
        }>();
        for (const row of slice.rows) {
            const cid = String(row.campaign_id);
            const t = totals.get(cid) ?? { cost: 0, clicks: 0, conversions: 0 };
            t.cost += Number(row.cost) || 0;
            t.clicks += Number(row.clicks) || 0;
            t.conversions += Number(row.conversions) || 0;
            totals.set(cid, t);
        }
        const money = new Intl.NumberFormat("en-US", { style: "currency", currency: account.currency });
        const int = new Intl.NumberFormat("en-US");
        const dec = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
        console.log(`✓ Spend by campaign, ${range.start} → ${range.end} · ${account.name} (${account.currency}, ${account.timezone})`);
        console.log(`  ${pad("Campaign", 36)} ${pad("Id", 12)} ${pad("Type", 10)} ${pad("Status", 8)} ${padStart("Spend", 14)} ${padStart("Clicks", 9)} ${padStart("Conv.", 9)}`);
        const sorted = [...totals.entries()].sort((a, b) => b[1].cost - a[1].cost);
        for (const [cid, t] of sorted) {
            const c = dims.campaigns.get(cid);
            console.log(`  ${pad(c?.name ?? "(unknown campaign)", 36)} ${pad(id(cid), 12)} ${pad(c?.type ?? "—", 10)} ${pad(c?.status ?? "—", 8)} ${padStart(money.format(t.cost), 14)} ${padStart(int.format(t.clicks), 9)} ${padStart(dec.format(t.conversions), 9)}`);
        }
        const sum = sorted.reduce((s, [, t]) => ({ cost: s.cost + t.cost, clicks: s.clicks + t.clicks, conversions: s.conversions + t.conversions }), { cost: 0, clicks: 0, conversions: 0 });
        console.log(`  ${pad(`Total (${sorted.length} campaigns with activity)`, 69)} ${padStart(money.format(sum.cost), 14)} ${padStart(int.format(sum.clicks), 9)} ${padStart(dec.format(sum.conversions), 9)}`);
        return 0;
    }
    catch (err) {
        console.error(`✗ ${redact(err instanceof Error ? err.message : String(err))}`);
        return 1;
    }
}
main().then((code) => process.exit(code), () => process.exit(1));
