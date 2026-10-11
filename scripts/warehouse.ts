import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
const 襅壍 = "--conditions=react-server";
function 嘴壍(): number | null {
    if (process.execArgv.includes(襅壍))
        return null;
    const 産壍 = spawnSync(process.execPath, [...process.execArgv, 襅壍, ...process.argv.slice(1)], { stdio: "inherit", env: process.env });
    return 産壍.status ?? 1;
}
const 鐒壍 = ["status", "sync", "prune", "purge", "backup"];
const 愁壍 = process.argv.slice(2);
const 翰壍 = (黟壍: string) => 愁壍.includes(`--${黟壍}`);
const 毎壍 = (誽壍: string) => {
    const 垬壍 = 愁壍.indexOf(`--${誽壍}`);
    return 垬壍 >= 0 ? 愁壍[垬壍 + 1] : undefined;
};
const 皛壍 = (閊壍: string, 批壍: number) => (閊壍.length > 批壍 ? `${閊壍.slice(0, 批壍 - 1)}…` : 閊壍.padEnd(批壍));
const 腨壍 = (乗壍: number) => 乗壍.toLocaleString("en-US");
async function 浆壍(): Promise<number> {
    const 谵壍 = 嘴壍();
    if (谵壍 !== null)
        return 谵壍;
    const 夤壍 = path.resolve(process.cwd(), ".env");
    if (existsSync(夤壍))
        process.loadEnvFile?.(夤壍);
    const { WAREHOUSE_TABLES: 砓壍 } = await import("@/lib/domain/contracts/warehouse");
    const { addDays: 霂壍 } = await import("@/lib/domain/dates");
    const { describeBlankReason: 揱壍 } = await import("@/lib/domain/types");
    const { resolveGoogleAds: 苠壍 } = await import("@/lib/server/datasource/resolver");
    const { googleAdsConfig: 俏壍, warehouseConfig: 溾壍 } = await import("@/lib/server/env/config");
    const { mask: 趭壍 } = await import("@/lib/server/env/status");
    const { getWarehouse: 媜壍, warehouseAvailability: 禋壍, warehouseSize: 顺壍 } = await import("@/lib/server/warehouse");
    const { unwrapSource: 敩壍 } = await import("@/lib/server/warehouse/source");
    const { sqliteModule: 葘壍 } = await import("@/lib/server/warehouse/sqlite");
    const { startSync: 兇壍 } = await import("@/lib/server/warehouse/sync");
    const 瀶壍 = (輥壍: string) => 趭壍(輥壍, false);
    const 尔壍 = 愁壍.find((笃壍) => 鐒壍.includes(笃壍)) ?? "status";
    const 駲壍 = 敩壍((await 苠壍()).source);
    const 曡壍 = 駲壍.mode;
    const 藐壍 = 媜壍(曡壍);
    if (!藐壍) {
        console.error(`✗ Warehouse unavailable: ${禋壍(曡壍).reason ?? "turned off"}`);
        return 1;
    }
    const 势壍 = 顺壍(藐壍);
    console.log(`Warehouse · ${曡壍} · ${藐壍.location === ":memory:" ? ":memory:" : path.relative(process.cwd(), 藐壍.location)} · SQLite ${藐壍.sqliteVersion ?? "?"}${势壍 !== null ? ` · ${(势壍 / 1048576).toFixed(1)} MB` : ""}`);
    if (駲壍.reason)
        console.log(`  No live data: ${揱壍(駲壍.reason)}`);
    const 熮壍 = 溾壍();
    const 邝壍 = 毎壍("account");
    const 嶌壍 = 邝壍 === "default" ? 駲壍.defaultAccountId() : 邝壍?.replace(/\D/g, "");
    if (尔壍 === "sync") {
        const 类壍 = (await 駲壍.listAccounts()).filter((魪壍) => !魪壍.isManager);
        const 桙壍 = 嶌壍 ? [嶌壍] : 类壍.map((蝈壍) => 蝈壍.id);
        const 吷壍 = 毎壍("backfill-days");
        const 猦壍 = 兇壍({
            source: 駲壍,
            warehouse: 藐壍,
            accountIds: 桙壍,
            trigger: "cli",
            scope: 嶌壍 ? "account" : "all",
            backfillDays: 吷壍 ? Math.max(0, Math.min(1200, Number(吷壍) || 0)) : 熮壍.backfillDays,
            maxRequests: 熮壍.maxRequests,
            restatementDays: 俏壍().restatementDays,
            retentionDays: 熮壍.retentionDays,
        });
        if (!猦壍.started) {
            console.error(`✗ ${猦壍.reason}`);
            return 1;
        }
        console.log(`Syncing ${桙壍.length} account(s) · budget ${熮壍.maxRequests} requests · backfill ${吷壍 ?? 熮壍.backfillDays} days…`);
        const 鈕壍 = await 猦壍.done;
        console.log(`${鈕壍.status === "ok" ? "✓" : 鈕壍.status === "partial" ? "!" : "✗"} ${鈕壍.status} · ${鈕壍.accounts} account(s) · ${腨壍(鈕壍.requests)} requests · ${腨壍(鈕壍.rowsWritten)} rows written`);
        if (鈕壍.error)
            console.log(`  ${鈕壍.error}`);
        return 鈕壍.status === "failed" ? 1 : 0;
    }
    if (尔壍 === "prune") {
        if (!熮壍.retentionDays) {
            console.log("WAREHOUSE_RETENTION_DAYS is 0: everything is kept.");
            return 0;
        }
        const 弄壍 = 霂壍(new Date().toISOString().slice(0, 10), -熮壍.retentionDays);
        console.log(`✓ Deleted ${腨壍(藐壍.repo.prune(弄壍))} fact rows older than ${弄壍}.`);
        return 0;
    }
    if (尔壍 === "purge") {
        if (!嶌壍 || !翰壍("yes")) {
            console.error("✗ purge needs --account <id> and --yes");
            return 1;
        }
        console.log(藐壍.repo.purgeAccount(嶌壍) ? `✓ Deleted everything stored for ${瀶壍(嶌壍)}.` : `Nothing stored for ${瀶壍(嶌壍)}.`);
        return 0;
    }
    if (尔壍 === "backup") {
        const 緳壍 = 愁壍[愁壍.indexOf("backup") + 1];
        const 鳢壍 = 葘壍();
        if (!緳壍 || 緳壍.startsWith("--") || !鳢壍) {
            console.error("✗ backup needs a target file: npm run warehouse -- backup ./warehouse-backup.sqlite");
            return 1;
        }
        const 槑壍 = await 鳢壍.backup(藐壍.repo.db, path.resolve(process.cwd(), 緳壍));
        console.log(`✓ Backed up ${腨壍(槑壍)} pages to ${緳壍}.`);
        return 0;
    }
    const 裀壍 = 藐壍.repo.accounts().filter((喯壍) => !嶌壍 || 喯壍.id === 嶌壍);
    if (!裀壍.length)
        console.log("Nothing stored yet — run `npm run warehouse -- sync`.");
    for (const 璞壍 of 裀壍) {
        const 鎍壍 = await 駲壍.coverage(璞壍.id, "campaign_daily").catch(() => null);
        console.log(`\n${瀶壍(璞壍.id)} · ${璞壍.name}${鎍壍 ? ` · Google serves daily data from ${鎍壍.start}` : ""}`);
        console.log(`  ${皛壍("Table", 28)}${皛壍("Rows", 12)}${皛壍("From", 12)}${皛壍("To", 12)}${皛壍("Days", 8)}Settled`);
        for (const 恼壍 of 砓壍) {
            const 罫壍 = 藐壍.repo.tableStats(璞壍.id, 恼壍.id, 恼壍.sql, null);
            console.log(`  ${皛壍(恼壍.label, 28)}${皛壍(腨壍(罫壍.rows), 12)}${皛壍(罫壍.firstDay ?? "—", 12)}${皛壍(罫壍.lastDay ?? "—", 12)}${皛壍(腨壍(罫壍.periods), 8)}${腨壍(罫壍.settledPeriods)}`);
        }
        const 鹚壍 = 藐壍.repo.counts(璞壍.id);
        console.log(`  Change events ${腨壍(鹚壍.changeEvents.count)} (${鹚壍.changeEvents.firstDay ?? "—"} → ${鹚壍.changeEvents.lastDay ?? "—"}) · campaigns ${腨壍(鹚壍.dims.campaigns)} (${腨壍(鹚壍.dims.campaignVersions)} versions) · simulations ${腨壍(鹚壍.estimates.simulations)} · recommendations ${腨壍(鹚壍.estimates.recommendations)}`);
    }
    const 歉壍 = 藐壍.repo.runs(5);
    if (歉壍.length) {
        console.log("\nLast syncs");
        for (const 訸壍 of 歉壍)
            console.log(`  ${訸壍.startedAt.slice(0, 16).replace("T", " ")}  ${皛壍(訸壍.trigger, 9)}${皛壍(訸壍.status, 9)}${皛壍(`${腨壍(訸壍.requests)} req`, 10)}${腨壍(訸壍.rowsWritten)} rows${訸壍.error ? ` · ${訸壍.error.slice(0, 120)}` : ""}`);
    }
    return 0;
}
浆壍().then((圧壍) => process.exit(圧壍), (瘖壍: unknown) => {
    console.error(`✗ ${瘖壍 instanceof Error ? 瘖壍.message : String(瘖壍)}`);
    process.exit(1);
});
