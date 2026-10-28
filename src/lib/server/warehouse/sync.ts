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
const HOT_REFRESH_MS = 60 * 60000;
const EXTRA_REQUESTS = 6;
const STALE_LOCK_MS = 6 * 3600000;
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
const lock = () => singleton("warehouse:sync-lock", () => ({ runId: null as string | null, startedAt: 0 }));
export function syncInProgress(): string | null {
    const l = lock();
    return l.runId && Date.now() - l.startedAt < STALE_LOCK_MS ? l.runId : null;
}
export type StartedSync = {
    started: true;
    run: WarehouseRun;
    done: Promise<WarehouseRun>;
} | {
    started: false;
    reason: string;
};
export function startSync(o: SyncOptions): StartedSync {
    const busy = syncInProgress();
    if (busy)
        return { started: false, reason: `A warehouse sync is already running (${busy}).` };
    const startedAt = now().toISOString();
    const id = `sync_${startedAt.replace(/\D/g, "").slice(0, 14)}_${randomUUID().slice(0, 6)}`;
    const run: WarehouseRun = { id, mode: o.source.mode, trigger: o.trigger, scope: o.scope, startedAt, finishedAt: null, status: "running", accounts: 0, requests: 0, rowsWritten: 0, budgetExhausted: false, error: null };
    try {
        o.warehouse.repo.startRun(run);
    }
    catch (err) {
        return { started: false, reason: `The warehouse could not record a sync: ${err instanceof Error ? err.message : String(err)}` };
    }
    const l = lock();
    l.runId = id;
    l.startedAt = Date.now();
    const done = execute(o, run).finally(() => {
        if (lock().runId === id)
            lock().runId = null;
    });
    return { started: true, run, done };
}
async function execute(o: SyncOptions, run: WarehouseRun): Promise<WarehouseRun> {
    const repo = o.warehouse.repo;
    const errors: string[] = [];
    const tally = new Map<string, Record<string, TableTally>>();
    let requests = 0;
    let rowsWritten = 0;
    let budgetExhausted = false;
    const count = (accountId: string, table: string, rows: number) => {
        const t = tally.get(accountId) ?? {};
        const cur = t[table] ?? { fetches: 0, rows: 0 };
        t[table] = { fetches: cur.fetches + 1, rows: cur.rows + rows };
        tally.set(accountId, t);
    };
    const fail = (accountId: string, what: string, err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${mask(accountId, false)} ${what}: ${message}`);
        log.warn("Warehouse sync step failed", { account: mask(accountId, false), what, error: message });
    };
    try {
        const accounts: AccountPlan[] = [];
        const items: Item[] = [];
        const nowMs = now().getTime();
        for (const id of o.accountIds) {
            try {
                const info = await o.source.account(id);
                if (info.isManager)
                    continue;
                const [today, dataThrough] = await Promise.all([o.source.today(id), o.source.dataThrough(id)]);
                repo.upsertAccount(info, now().toISOString());
                o.warehouse.knownAccounts.add(id);
                const hotFrom = hotFromOf(today, o.restatementDays);
                accounts.push({ id, today, hotFrom });
                for (const table of DAILY_TABLE_IDS) {
                    const window = syncWindow(await o.source.coverage(id, table), today, dataThrough, o.backfillDays);
                    const ledger = window ? repo.ledger(id, table, window.start, window.end) : new Map();
                    for (const f of planDailyTable({ window, ledger, hotFrom, nowMs, hotRefreshMs: HOT_REFRESH_MS, spanDays: TABLE_QUERIES[table].spanDays }))
                        items.push({ ...f, accountId: id, table, monthly: false, hotFrom });
                }
                const stWindow = syncWindow(await o.source.coverage(id, SEARCH_TERMS.table), today, dataThrough, o.backfillDays);
                const stLedger = stWindow ? repo.ledger(id, SEARCH_TERMS.table, stWindow.start, stWindow.end) : new Map();
                for (const f of planMonths({ window: stWindow, ledger: stLedger, hotFrom }))
                    items.push({ ...f, accountId: id, table: SEARCH_TERMS.table, monthly: true, hotFrom });
            }
            catch (err) {
                fail(id, "planning", err);
            }
        }
        const reserve = accounts.length * EXTRA_REQUESTS;
        for (const item of orderPlan(items)) {
            if (o.maxRequests - requests - reserve < 1) {
                budgetExhausted = true;
                break;
            }
            requests++;
            try {
                const slice = await o.source.getTable(item.accountId, item.table, item.range);
                const opts = { fetchedAt: now().toISOString(), hotFrom: item.hotFrom, runId: run.id };
                const written = item.monthly ? repo.replaceMonth(item.accountId, item.range, slice.rows, opts) : repo.replaceDays(item.accountId, item.table as Exclude<GoogleTableId, "search_term_daily">, item.range, slice.rows, opts);
                rowsWritten += written;
                count(item.accountId, item.table, written);
            }
            catch (err) {
                fail(item.accountId, `${item.table} ${item.range.start}…${item.range.end}`, err);
            }
        }
        for (const a of accounts) {
            if (o.maxRequests - requests < EXTRA_REQUESTS) {
                budgetExhausted = true;
                break;
            }
            requests += 3;
            try {
                const dims = await o.source.getDims(a.id);
                const r = repo.upsertDims(a.id, dims, a.today, now().toISOString());
                count(a.id, "dimensions", r.campaigns);
            }
            catch (err) {
                fail(a.id, "dimensions", err);
            }
            requests += 1;
            try {
                const back = o.source.mode === "live" ? CHANGE_EVENT_DAYS - 1 : Math.max(CHANGE_EVENT_DAYS - 1, o.backfillDays);
                const range: DateRange = { start: addDays(a.today, -back), end: a.today };
                const events = (await o.source.getChangeEvents(a.id, range)).filter((e) => !e.id.startsWith("sim-"));
                count(a.id, "change_event", repo.upsertChangeEvents(a.id, events, now().toISOString()));
            }
            catch (err) {
                fail(a.id, "change history", err);
            }
            requests += 2;
            try {
                const est = await o.source.getGoogleEstimates(a.id);
                const r = repo.upsertEstimates(a.id, est, a.today, now().toISOString());
                count(a.id, "estimates", r.simulations + r.recommendations);
            }
            catch (err) {
                fail(a.id, "Google's estimates", err);
            }
        }
        if (o.retentionDays > 0 && accounts.length) {
            const latest = accounts.map((a) => a.today).sort()[accounts.length - 1] as CivilDate;
            repo.prune(addDays(latest, -o.retentionDays));
        }
        const status = errors.length ? (rowsWritten > 0 || accounts.length > 0 ? "partial" : "failed") : budgetExhausted ? "partial" : "ok";
        const notes = [...errors];
        if (budgetExhausted)
            notes.push(`Request budget of ${o.maxRequests} reached; the next sync continues where this one stopped.`);
        const finished: WarehouseRun = { ...run, finishedAt: now().toISOString(), status, accounts: accounts.length, requests, rowsWritten, budgetExhausted, error: notes.length ? notes.join(" · ").slice(0, 2000) : null };
        repo.finishRun(run.id, { ...finished, finishedAt: finished.finishedAt as string, details: { accounts: [...tally].map(([accountId, tables]) => ({ accountId, tables })), errors } });
        log.info("Warehouse sync finished", { run: run.id, status, accounts: accounts.length, requests, rows: rowsWritten });
        return finished;
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error("Warehouse sync failed", { run: run.id, error: message });
        const failed: WarehouseRun = { ...run, finishedAt: now().toISOString(), status: "failed", requests, rowsWritten, budgetExhausted, error: message };
        try {
            repo.finishRun(run.id, { ...failed, finishedAt: failed.finishedAt as string, details: { errors: [...errors, message] } });
        }
        catch {
        }
        return failed;
    }
}
