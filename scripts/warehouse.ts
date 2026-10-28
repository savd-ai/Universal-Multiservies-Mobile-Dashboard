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
const COMMANDS = ["status", "sync", "prune", "purge", "backup"];
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const arg = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
};
const pad = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));
const num = (n: number) => n.toLocaleString("en-US");
async function main(): Promise<number> {
    const relaunched = relaunchWithServerCondition();
    if (relaunched !== null)
        return relaunched;
    const envFile = path.resolve(process.cwd(), ".env");
    if (existsSync(envFile))
        process.loadEnvFile?.(envFile);
    const { WAREHOUSE_TABLES } = await import("@/lib/domain/contracts/warehouse");
    const { addDays } = await import("@/lib/domain/dates");
    const { describeBlankReason: describeDemoReason } = await import("@/lib/domain/types");
    const { resolveGoogleAds } = await import("@/lib/server/datasource/resolver");
    const { googleAdsConfig, warehouseConfig } = await import("@/lib/server/env/config");
    const { mask } = await import("@/lib/server/env/status");
    const { getWarehouse, warehouseAvailability, warehouseSize } = await import("@/lib/server/warehouse");
    const { unwrapSource } = await import("@/lib/server/warehouse/source");
    const { sqliteModule } = await import("@/lib/server/warehouse/sqlite");
    const { startSync } = await import("@/lib/server/warehouse/sync");
    const id = (v: string) => mask(v, false);
    const command = args.find((a) => COMMANDS.includes(a)) ?? "status";
    const source = unwrapSource((await resolveGoogleAds()).source);
    const mode = source.mode;
    const w = getWarehouse(mode);
    if (!w) {
        console.error(`✗ Warehouse unavailable: ${warehouseAvailability(mode).reason ?? "turned off"}`);
        return 1;
    }
    const size = warehouseSize(w);
    console.log(`Warehouse · ${mode} · ${w.location === ":memory:" ? ":memory:" : path.relative(process.cwd(), w.location)} · SQLite ${w.sqliteVersion ?? "?"}${size !== null ? ` · ${(size / 1048576).toFixed(1)} MB` : ""}`);
    if (source.reason)
        console.log(`  No live data: ${describeDemoReason(source.reason)}`);
    const cfg = warehouseConfig();
    const rawAccount = arg("account");
    const accountArg = rawAccount === "default" ? source.defaultAccountId() : rawAccount?.replace(/\D/g, "");
    if (command === "sync") {
        const listed = (await source.listAccounts()).filter((a) => !a.isManager);
        const accountIds = accountArg ? [accountArg] : listed.map((a) => a.id);
        const backfill = arg("backfill-days");
        const started = startSync({
            source,
            warehouse: w,
            accountIds,
            trigger: "cli",
            scope: accountArg ? "account" : "all",
            backfillDays: backfill ? Math.max(0, Math.min(1200, Number(backfill) || 0)) : cfg.backfillDays,
            maxRequests: cfg.maxRequests,
            restatementDays: googleAdsConfig().restatementDays,
            retentionDays: cfg.retentionDays,
        });
        if (!started.started) {
            console.error(`✗ ${started.reason}`);
            return 1;
        }
        console.log(`Syncing ${accountIds.length} account(s) · budget ${cfg.maxRequests} requests · backfill ${backfill ?? cfg.backfillDays} days…`);
        const run = await started.done;
        console.log(`${run.status === "ok" ? "✓" : run.status === "partial" ? "!" : "✗"} ${run.status} · ${run.accounts} account(s) · ${num(run.requests)} requests · ${num(run.rowsWritten)} rows written`);
        if (run.error)
            console.log(`  ${run.error}`);
        return run.status === "failed" ? 1 : 0;
    }
    if (command === "prune") {
        if (!cfg.retentionDays) {
            console.log("WAREHOUSE_RETENTION_DAYS is 0: everything is kept.");
            return 0;
        }
        const before = addDays(new Date().toISOString().slice(0, 10), -cfg.retentionDays);
        console.log(`✓ Deleted ${num(w.repo.prune(before))} fact rows older than ${before}.`);
        return 0;
    }
    if (command === "purge") {
        if (!accountArg || !flag("yes")) {
            console.error("✗ purge needs --account <id> and --yes");
            return 1;
        }
        console.log(w.repo.purgeAccount(accountArg) ? `✓ Deleted everything stored for ${id(accountArg)}.` : `Nothing stored for ${id(accountArg)}.`);
        return 0;
    }
    if (command === "backup") {
        const target = args[args.indexOf("backup") + 1];
        const mod = sqliteModule();
        if (!target || target.startsWith("--") || !mod) {
            console.error("✗ backup needs a target file: npm run warehouse -- backup ./warehouse-backup.sqlite");
            return 1;
        }
        const pages = await mod.backup(w.repo.db, path.resolve(process.cwd(), target));
        console.log(`✓ Backed up ${num(pages)} pages to ${target}.`);
        return 0;
    }
    const stored = w.repo.accounts().filter((a) => !accountArg || a.id === accountArg);
    if (!stored.length)
        console.log("Nothing stored yet — run `npm run warehouse -- sync`.");
    for (const a of stored) {
        const google = await source.coverage(a.id, "campaign_daily").catch(() => null);
        console.log(`\n${id(a.id)} · ${a.name}${google ? ` · Google serves daily data from ${google.start}` : ""}`);
        console.log(`  ${pad("Table", 28)}${pad("Rows", 12)}${pad("From", 12)}${pad("To", 12)}${pad("Days", 8)}Settled`);
        for (const t of WAREHOUSE_TABLES) {
            const s = w.repo.tableStats(a.id, t.id, t.sql, null);
            console.log(`  ${pad(t.label, 28)}${pad(num(s.rows), 12)}${pad(s.firstDay ?? "—", 12)}${pad(s.lastDay ?? "—", 12)}${pad(num(s.periods), 8)}${num(s.settledPeriods)}`);
        }
        const c = w.repo.counts(a.id);
        console.log(`  Change events ${num(c.changeEvents.count)} (${c.changeEvents.firstDay ?? "—"} → ${c.changeEvents.lastDay ?? "—"}) · campaigns ${num(c.dims.campaigns)} (${num(c.dims.campaignVersions)} versions) · simulations ${num(c.estimates.simulations)} · recommendations ${num(c.estimates.recommendations)}`);
    }
    const runs = w.repo.runs(5);
    if (runs.length) {
        console.log("\nLast syncs");
        for (const r of runs)
            console.log(`  ${r.startedAt.slice(0, 16).replace("T", " ")}  ${pad(r.trigger, 9)}${pad(r.status, 9)}${pad(`${num(r.requests)} req`, 10)}${num(r.rowsWritten)} rows${r.error ? ` · ${r.error.slice(0, 120)}` : ""}`);
    }
    return 0;
}
main().then((code) => process.exit(code), (err: unknown) => {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
});
