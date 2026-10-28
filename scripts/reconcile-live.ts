import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
const REACT_SERVER = "--conditions=react-server";
function relaunchWithServerCondition(): number | null {
    if (process.execArgv.includes(REACT_SERVER))
        return null;
    const child = spawnSync(process.execPath, [...process.execArgv, REACT_SERVER, ...process.argv.slice(1)], { stdio: "inherit", env: process.env });
    return child.status ?? 1;
}
const arg = (name: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
};
const pad = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));
const padStart = (s: string, n: number) => s.padStart(n);
type Totals = {
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    conv_value: number;
};
const MEASURES = ["impressions", "clicks", "cost", "conversions", "conv_value"] as const;
const zero = (): Totals => ({ impressions: 0, clicks: 0, cost: 0, conversions: 0, conv_value: 0 });
function sum(rows: readonly Record<string, unknown>[], keep?: (r: Record<string, unknown>) => boolean): Totals {
    const t = zero();
    for (const r of rows) {
        if (keep && !keep(r))
            continue;
        for (const m of MEASURES)
            t[m] += Number(r[m]) || 0;
    }
    return t;
}
const pct = (a: number, b: number) => (b === 0 ? (a === 0 ? "0.0%" : "n/a") : `${(((a - b) / b) * 100).toFixed(1)}%`);
async function resolveAccount(listAccounts: () => Promise<{
    id: string;
}[]>, raw: string): Promise<string> {
    if (!/[•*…]/.test(raw))
        return raw.replace(/\D/g, "");
    const [head = "", tail = ""] = raw.split(/[•*…]+/).map((part) => part.replace(/\D/g, ""));
    const hits = (await listAccounts()).filter((a) => a.id.startsWith(head) && a.id.endsWith(tail));
    if (hits.length !== 1)
        throw new Error(`--account ${raw} matches ${hits.length} accessible accounts — pass the full id`);
    return (hits[0] as {
        id: string;
    }).id;
}
async function main(): Promise<number> {
    const relaunched = relaunchWithServerCondition();
    if (relaunched !== null)
        return relaunched;
    const envFile = path.resolve(process.cwd(), ".env");
    if (existsSync(envFile))
        process.loadEnvFile?.(envFile);
    const { addDays } = await import("@/lib/domain/dates");
    const { mask, missingLiveKeys } = await import("@/lib/server/env/status");
    const { redact } = await import("@/lib/server/log");
    const { createLiveGoogleAdsSource } = await import("@/lib/server/google-ads/source");
    const id = (v: string) => mask(v, false);
    if (missingLiveKeys().length) {
        console.error(`✗ Missing required keys: ${missingLiveKeys().join(", ")} — see npm run check:google-ads`);
        return 1;
    }
    const source = createLiveGoogleAdsSource();
    const days = Math.max(1, Math.min(31, Number(arg("days") ?? 7)));
    try {
        const accountArg = arg("account");
        const accountId = accountArg ? await resolveAccount(() => source.listAccounts(), accountArg) : source.defaultAccountId();
        const account = await source.account(accountId);
        const through = await source.dataThrough(accountId);
        const range = { start: addDays(through, -(days - 1)), end: through };
        console.log(`SAVD · live reconciliation (read-only) · ${account.name} (${id(account.id)}) · ${account.currency} · ${account.timezone}`);
        console.log(`  Window ${range.start} → ${range.end} (${days} days, data through ${through})`);
        const base = await source.getTable(accountId, "campaign_daily", range);
        const baseT = sum(base.rows);
        if (baseT.impressions === 0 && baseT.clicks === 0 && baseT.cost === 0) {
            console.log(`  No impressions, clicks or spend in the window (${base.rows.length} campaign_daily rows) — nothing to reconcile.`);
            return 0;
        }
        const dims = await source.getDims(accountId);
        console.log(`  Dims: ${dims.campaigns.size} campaigns · ${dims.adGroups.size} ad groups · ${dims.keywords.size} keywords`);
        const money = new Intl.NumberFormat("en-US", { style: "currency", currency: account.currency });
        const fmt = (t: Totals) => `${padStart(money.format(t.cost), 14)} ${padStart(t.clicks.toLocaleString("en-US"), 9)} ${padStart(t.impressions.toLocaleString("en-US"), 11)} ${padStart(t.conversions.toFixed(1), 8)} ${padStart(money.format(t.conv_value), 12)}`;
        console.log("");
        console.log(`  ${pad("Table", 24)} ${padStart("Rows", 7)} ${padStart("Spend", 14)} ${padStart("Clicks", 9)} ${padStart("Impr.", 11)} ${padStart("Conv.", 8)} ${padStart("Conv. value", 12)}  Δ spend / Δ clicks vs campaign_daily`);
        console.log(`  ${pad("campaign_daily", 24)} ${padStart(String(base.rows.length), 7)} ${fmt(baseT)}`);
        const typeOf = (cid: unknown) => dims.campaigns.get(String(cid))?.type ?? "?";
        const NOTES: Record<string, string> = {
            campaign_device_daily: "should match",
            campaign_hourly: "should match (no IS)",
            campaign_geo_daily: "user_location_view: only rows with a location",
            ad_group_daily: "PMax has no ad groups",
            keyword_daily: "keyword traffic only (no DSA / PMax / broad AI)",
            search_term_daily: "range grain, ORDER BY cost LIMIT 5000",
        };
        const perDay: Record<string, Map<string, number>> = {};
        for (const table of ["campaign_device_daily", "campaign_hourly", "campaign_geo_daily", "ad_group_daily", "keyword_daily", "search_term_daily"] as const) {
            try {
                const slice = await source.getTable(accountId, table, range);
                const t = sum(slice.rows);
                const ref = table === "ad_group_daily" || table === "keyword_daily" ? sum(base.rows, (r) => typeOf(r.campaign_id) !== "PMax") : baseT;
                console.log(`  ${pad(table, 24)} ${padStart(String(slice.rows.length), 7)} ${fmt(t)}  ${pct(t.cost, ref.cost)} / ${pct(t.clicks, ref.clicks)} · ${NOTES[table]}${ref === baseT ? "" : " (vs non-PMax)"}`);
                if (slice.grain === "daily" && (table === "campaign_device_daily" || table === "campaign_hourly")) {
                    const m = new Map<string, number>();
                    for (const r of slice.rows)
                        m.set(String(r.date), (m.get(String(r.date)) ?? 0) + (Number(r.cost) || 0));
                    perDay[table] = m;
                }
            }
            catch (err) {
                console.log(`  ${pad(table, 24)} ✗ ${redact(err instanceof Error ? err.message : String(err)).slice(0, 160)}`);
            }
        }
        const baseDay = new Map<string, number>();
        for (const r of base.rows)
            baseDay.set(String(r.date), (baseDay.get(String(r.date)) ?? 0) + (Number(r.cost) || 0));
        let worst = 0;
        for (const [date, v] of baseDay) {
            for (const m of Object.values(perDay))
                worst = Math.max(worst, Math.abs((m.get(date) ?? 0) - v));
        }
        console.log(`  Per-day spend, campaign vs device/hourly: largest gap ${money.format(worst)} over ${baseDay.size} days`);
        const isRows = base.rows.filter((r) => Number(r.is_eligible) > 0);
        const eligible = isRows.reduce((s, r) => s + Number(r.is_eligible), 0);
        const searchImpr = isRows.reduce((s, r) => s + (Number(r.is_search_impr) || 0), 0);
        const lostBudget = isRows.reduce((s, r) => s + (Number(r.is_lost_budget) || 0), 0);
        console.log(`  Impression share: ${isRows.length} campaign-days with IS · search IS ${eligible ? ((searchImpr / eligible) * 100).toFixed(1) : "—"}% · lost to budget ${eligible ? ((lostBudget / eligible) * 100).toFixed(1) : "—"}%`);
        const byCampaign = new Map<string, Totals>();
        for (const r of base.rows) {
            const cid = String(r.campaign_id);
            const t = byCampaign.get(cid) ?? zero();
            for (const m of MEASURES)
                t[m] += Number(r[m]) || 0;
            byCampaign.set(cid, t);
        }
        console.log("");
        console.log(`  Campaigns with spend (compare with Google Ads → Campaigns, ${range.start} → ${range.end}):`);
        for (const [cid, t] of [...byCampaign].filter(([, t2]) => t2.cost > 0).sort((a, b) => b[1].cost - a[1].cost).slice(0, 15)) {
            const c = dims.campaigns.get(cid);
            console.log(`  ${pad(c?.name ?? "(unknown)", 40)} ${pad(id(cid), 11)} ${pad(c?.type ?? "?", 9)} ${fmt(t)}`);
        }
        console.log("");
        try {
            const events = await source.getChangeEvents(accountId, { start: addDays(through, -29), end: through });
            const byType = new Map<string, number>();
            const byClient = new Map<string, number>();
            for (const e of events) {
                byType.set(e.resource_type, (byType.get(e.resource_type) ?? 0) + 1);
                byClient.set(e.client_type ?? "?", (byClient.get(e.client_type ?? "?") ?? 0) + 1);
            }
            console.log(`  change_event (30 d): ${events.length} · by resource ${[...byType].map(([k, v]) => `${k} ${v}`).join(", ") || "—"} · by client ${[...byClient].map(([k, v]) => `${k} ${v}`).join(", ") || "—"}`);
        }
        catch (err) {
            console.log(`  change_event ✗ ${redact(err instanceof Error ? err.message : String(err)).slice(0, 200)}`);
        }
        try {
            const est = await source.getGoogleEstimates(accountId);
            const byType = new Map<string, number>();
            for (const s of est.simulations)
                byType.set(`${s.type}/${s.modification}`, (byType.get(`${s.type}/${s.modification}`) ?? 0) + 1);
            console.log(`  campaign_simulation: ${est.simulations.length} (${[...byType].map(([k, v]) => `${k} ${v}`).join(", ") || "none"}) · points ${est.simulations.reduce((s, x) => s + x.points.length, 0)}`);
            console.log(`  recommendation (CAMPAIGN_BUDGET): ${est.recommendations.length}${est.warnings.length ? ` · warnings: ${est.warnings.map((w) => redact(w)).join(" | ")}` : ""}`);
        }
        catch (err) {
            console.log(`  estimates ✗ ${redact(err instanceof Error ? err.message : String(err)).slice(0, 200)}`);
        }
        return 0;
    }
    catch (err) {
        console.error(`✗ ${redact(err instanceof Error ? err.message : String(err))}`);
        return 1;
    }
}
main().then((code) => process.exit(code), () => process.exit(1));
