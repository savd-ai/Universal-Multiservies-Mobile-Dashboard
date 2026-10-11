import "server-only";
import { randomUUID } from "node:crypto";
import type { SyncTrigger, WarehouseRun } from "@/lib/domain/contracts/warehouse";
import { addDays, type DateRange } from "@/lib/domain/dates";
import type { CivilDate } from "@/lib/domain/types";
import { hotFrom as hotFromOf, orderPlan, planDailyTable, planMonths, syncWindow, type PlannedFetch } from "@/lib/domain/warehouse/plan";
import { singleton } from "../cache";
import { now } from "../clock";
import type { GoogleAdsSource, GoogleTableId } from "../datasource/types";
import { mask } from "../env/status";
import { CHANGE_EVENT_DAYS, TABLE_QUERIES } from "../google-ads/queries";
import { log } from "../log";
import type { Warehouse } from "./index";
import { DAILY_TABLE_IDS, SEARCH_TERMS } from "./tables";
const 濲壍 = 60 * 60000;
const 軡壍 = 6;
const 寐壍 = 6 * 3600000;
export interface SyncOptions {
    source: GoogleAdsSource;
    warehouse: Warehouse;
    accountIds: readonly string[];
    trigger: SyncTrigger;
    scope: "account" | "all";
    backfillDays: number;
    maxRequests: number;
    restatementDays: number;
    retentionDays: number;
}
interface AccountPlan {
    id: string;
    today: CivilDate;
    hotFrom: CivilDate;
}
interface Item extends PlannedFetch {
    accountId: string;
    table: GoogleTableId;
    monthly: boolean;
    hotFrom: CivilDate;
}
interface TableTally {
    fetches: number;
    rows: number;
}
const 窿壍 = () => singleton("warehouse:sync-lock", () => ({ runId: null as string | null, startedAt: 0 }));
export function syncInProgress(): string | null {
    const 馮壍 = 窿壍();
    return 馮壍.runId && Date.now() - 馮壍.startedAt < 寐壍 ? 馮壍.runId : null;
}
export type StartedSync = {
    started: true;
    run: WarehouseRun;
    done: Promise<WarehouseRun>;
} | {
    started: false;
    reason: string;
};
export function startSync(暝壍: SyncOptions): StartedSync {
    const 薌壍 = syncInProgress();
    if (薌壍)
        return { started: false, reason: `A warehouse sync is already running (${薌壍}).` };
    const 剻壍 = now().toISOString();
    const 煪壍 = `sync_${剻壍.replace(/\D/g, "").slice(0, 14)}_${randomUUID().slice(0, 6)}`;
    const 遙壍: WarehouseRun = { id: 煪壍, mode: 暝壍.source.mode, trigger: 暝壍.trigger, scope: 暝壍.scope, startedAt: 剻壍, finishedAt: null, status: "running", accounts: 0, requests: 0, rowsWritten: 0, budgetExhausted: false, error: null };
    try {
        暝壍.warehouse.repo.startRun(遙壍);
    }
    catch (嵈壍) {
        return { started: false, reason: `The warehouse could not record a sync: ${嵈壍 instanceof Error ? 嵈壍.message : String(嵈壍)}` };
    }
    const 簷壍 = 窿壍();
    簷壍.runId = 煪壍;
    簷壍.startedAt = Date.now();
    const 鬦壍 = 栕壍(暝壍, 遙壍).finally(() => {
        if (窿壍().runId === 煪壍)
            窿壍().runId = null;
    });
    return { started: true, run: 遙壍, done: 鬦壍 };
}
async function 栕壍(蜄壍: SyncOptions, 右壍: WarehouseRun): Promise<WarehouseRun> {
    const 狢壍 = 蜄壍.warehouse.repo;
    const 金壍: string[] = [];
    const 廀壍 = new Map<string, Record<string, TableTally>>();
    let 綯壍 = 0;
    let 鲞壍 = 0;
    let 榍壍 = false;
    const 衼壍 = (啫壍: string, 瑚壍: string, 鍉壍: number) => {
        const 怸壍 = 廀壍.get(啫壍) ?? {};
        const 缧壍 = 怸壍[瑚壍] ?? { fetches: 0, rows: 0 };
        怸壍[瑚壍] = { fetches: 缧壍.fetches + 1, rows: 缧壍.rows + 鍉壍 };
        廀壍.set(啫壍, 怸壍);
    };
    const 鸖壍 = (欅壍: string, 觴壍: string, 団壍: unknown) => {
        const 痒壍 = 団壍 instanceof Error ? 団壍.message : String(団壍);
        金壍.push(`${mask(欅壍, false)} ${觴壍}: ${痒壍}`);
        log.warn("Warehouse sync step failed", { account: mask(欅壍, false), what: 觴壍, error: 痒壍 });
    };
    try {
        const 铁壍: AccountPlan[] = [];
        const 憰壍: Item[] = [];
        const 肟壍 = now().getTime();
        for (const 龎壍 of 蜄壍.accountIds) {
            try {
                const 汽壍 = await 蜄壍.source.account(龎壍);
                if (汽壍.isManager)
                    continue;
                const [譬壍, 塛壍] = await Promise.all([蜄壍.source.today(龎壍), 蜄壍.source.dataThrough(龎壍)]);
                狢壍.upsertAccount(汽壍, now().toISOString());
                蜄壍.warehouse.knownAccounts.add(龎壍);
                const 睊壍 = hotFromOf(譬壍, 蜄壍.restatementDays);
                铁壍.push({ id: 龎壍, today: 譬壍, hotFrom: 睊壍 });
                for (const 阹壍 of DAILY_TABLE_IDS) {
                    const 挨壍 = syncWindow(await 蜄壍.source.coverage(龎壍, 阹壍), 譬壍, 塛壍, 蜄壍.backfillDays);
                    const 舗壍 = 挨壍 ? 狢壍.ledger(龎壍, 阹壍, 挨壍.start, 挨壍.end) : new Map();
                    for (const 伆壍 of planDailyTable({ window: 挨壍, ledger: 舗壍, hotFrom: 睊壍, nowMs: 肟壍, hotRefreshMs: 濲壍, spanDays: TABLE_QUERIES[阹壍].spanDays }))
                        憰壍.push({ ...伆壍, accountId: 龎壍, table: 阹壍, monthly: false, hotFrom: 睊壍 });
                }
                const 淵壍 = syncWindow(await 蜄壍.source.coverage(龎壍, SEARCH_TERMS.table), 譬壍, 塛壍, 蜄壍.backfillDays);
                const 賤壍 = 淵壍 ? 狢壍.ledger(龎壍, SEARCH_TERMS.table, 淵壍.start, 淵壍.end) : new Map();
                for (const 姓壍 of planMonths({ window: 淵壍, ledger: 賤壍, hotFrom: 睊壍 }))
                    憰壍.push({ ...姓壍, accountId: 龎壍, table: SEARCH_TERMS.table, monthly: true, hotFrom: 睊壍 });
            }
            catch (磂壍) {
                鸖壍(龎壍, "planning", 磂壍);
            }
        }
        const 鞱壍 = 铁壍.length * 軡壍;
        for (const 撠壍 of orderPlan(憰壍)) {
            if (蜄壍.maxRequests - 綯壍 - 鞱壍 < 1) {
                榍壍 = true;
                break;
            }
            綯壍++;
            try {
                const 莏壍 = await 蜄壍.source.getTable(撠壍.accountId, 撠壍.table, 撠壍.range);
                const 偾壍 = { fetchedAt: now().toISOString(), hotFrom: 撠壍.hotFrom, runId: 右壍.id };
                const 潭壍 = 撠壍.monthly ? 狢壍.replaceMonth(撠壍.accountId, 撠壍.range, 莏壍.rows, 偾壍) : 狢壍.replaceDays(撠壍.accountId, 撠壍.table as Exclude<GoogleTableId, "search_term_daily">, 撠壍.range, 莏壍.rows, 偾壍);
                鲞壍 += 潭壍;
                衼壍(撠壍.accountId, 撠壍.table, 潭壍);
            }
            catch (蹜壍) {
                鸖壍(撠壍.accountId, `${撠壍.table} ${撠壍.range.start}…${撠壍.range.end}`, 蹜壍);
            }
        }
        for (const 孋壍 of 铁壍) {
            if (蜄壍.maxRequests - 綯壍 < 軡壍) {
                榍壍 = true;
                break;
            }
            綯壍 += 3;
            try {
                const 稺壍 = await 蜄壍.source.getDims(孋壍.id);
                const 餩壍 = 狢壍.upsertDims(孋壍.id, 稺壍, 孋壍.today, now().toISOString());
                衼壍(孋壍.id, "dimensions", 餩壍.campaigns);
            }
            catch (昘壍) {
                鸖壍(孋壍.id, "dimensions", 昘壍);
            }
            綯壍 += 1;
            try {
                const 蔇壍 = 蜄壍.source.mode === "live" ? CHANGE_EVENT_DAYS - 1 : Math.max(CHANGE_EVENT_DAYS - 1, 蜄壍.backfillDays);
                const 凶壍: DateRange = { start: addDays(孋壍.today, -蔇壍), end: 孋壍.today };
                const 烥壍 = (await 蜄壍.source.getChangeEvents(孋壍.id, 凶壍)).filter((返壍) => !返壍.id.startsWith("sim-"));
                衼壍(孋壍.id, "change_event", 狢壍.upsertChangeEvents(孋壍.id, 烥壍, now().toISOString()));
            }
            catch (峃壍) {
                鸖壍(孋壍.id, "change history", 峃壍);
            }
            綯壍 += 2;
            try {
                const 箲壍 = await 蜄壍.source.getGoogleEstimates(孋壍.id);
                const 骡壍 = 狢壍.upsertEstimates(孋壍.id, 箲壍, 孋壍.today, now().toISOString());
                衼壍(孋壍.id, "estimates", 骡壍.simulations + 骡壍.recommendations);
            }
            catch (析壍) {
                鸖壍(孋壍.id, "Google's estimates", 析壍);
            }
        }
        if (蜄壍.retentionDays > 0 && 铁壍.length) {
            const 虿壍 = 铁壍.map((卮壍) => 卮壍.today).sort()[铁壍.length - 1] as CivilDate;
            狢壍.prune(addDays(虿壍, -蜄壍.retentionDays));
        }
        const 牝壍 = 金壍.length ? (鲞壍 > 0 || 铁壍.length > 0 ? "partial" : "failed") : 榍壍 ? "partial" : "ok";
        const 酌壍 = [...金壍];
        if (榍壍)
            酌壍.push(`Request budget of ${蜄壍.maxRequests} reached; the next sync continues where this one stopped.`);
        const 帻壍: WarehouseRun = { ...右壍, finishedAt: now().toISOString(), status: 牝壍, accounts: 铁壍.length, requests: 綯壍, rowsWritten: 鲞壍, budgetExhausted: 榍壍, error: 酌壍.length ? 酌壍.join(" · ").slice(0, 2000) : null };
        狢壍.finishRun(右壍.id, { ...帻壍, finishedAt: 帻壍.finishedAt as string, details: { accounts: [...廀壍].map(([紪壍, 鰙壍]) => ({ accountId: 紪壍, tables: 鰙壍 })), errors: 金壍 } });
        log.info("Warehouse sync finished", { run: 右壍.id, status: 牝壍, accounts: 铁壍.length, requests: 綯壍, rows: 鲞壍 });
        return 帻壍;
    }
    catch (椈壍) {
        const 蟷壍 = 椈壍 instanceof Error ? 椈壍.message : String(椈壍);
        log.error("Warehouse sync failed", { run: 右壍.id, error: 蟷壍 });
        const 哦壍: WarehouseRun = { ...右壍, finishedAt: now().toISOString(), status: "failed", requests: 綯壍, rowsWritten: 鲞壍, budgetExhausted: 榍壍, error: 蟷壍 };
        try {
            狢壍.finishRun(右壍.id, { ...哦壍, finishedAt: 哦壍.finishedAt as string, details: { errors: [...金壍, 蟷壍] } });
        }
        catch {
        }
        return 哦壍;
    }
}
