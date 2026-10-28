import "server-only";
import type { GoogleEstimates } from "@/lib/domain/contracts/estimates";
import { addDays, enumerate, maxDate, minDate, type DateRange } from "@/lib/domain/dates";
import type { FactSlice } from "@/lib/domain/query/engine";
import type { ChangeEvent, EntityDims } from "@/lib/domain/schema/facts";
import type { AccountInfo, CivilDate, BlankReason, Mode } from "@/lib/domain/types";
import { hotFrom as hotFromOf } from "@/lib/domain/warehouse/plan";
import { now } from "../clock";
import type { GoogleAdsSource, GoogleTableId } from "../datasource/types";
import { CHANGE_EVENT_DAYS } from "../google-ads/queries";
import { log } from "../log";
import type { Warehouse } from "./index";
import { isDailyTable, type DailyTableId } from "./tables";
const WRITE_THROUGH_EVERY_MS = 10 * 60000;
export interface WarehouseSourceOptions {
    reads: boolean;
    restatementDays: number;
}
function extend(google: DateRange | null, stored: DateRange | null): DateRange | null {
    if (!stored)
        return google;
    if (!google)
        return stored;
    return { start: minDate(google.start, stored.start), end: maxDate(google.end, stored.end) };
}
export class WarehouseSource implements GoogleAdsSource {
    readonly mode: Mode;
    readonly reason: BlankReason | null;
    readonly apiVersion: string;
    private readonly lastWrite = new Map<string, number>();
    private readonly merged = new WeakMap<EntityDims, EntityDims>();
    private warned = false;
    constructor(readonly inner: GoogleAdsSource, readonly warehouse: Warehouse, private readonly opts: WarehouseSourceOptions) {
        this.mode = inner.mode;
        this.reason = inner.reason;
        this.apiVersion = inner.apiVersion;
    }
    private fail(what: string, err: unknown): void {
        if (this.warned)
            return;
        this.warned = true;
        log.warn(`Warehouse ${what} failed; using Google Ads directly`, { error: err instanceof Error ? err.message : String(err) });
    }
    private due(key: string): boolean {
        const t = now().getTime();
        const last = this.lastWrite.get(key);
        if (last !== undefined && t - last < WRITE_THROUGH_EVERY_MS)
            return false;
        this.lastWrite.set(key, t);
        return true;
    }
    private async ensureAccount(accountId: string): Promise<void> {
        if (this.warehouse.knownAccounts.has(accountId))
            return;
        const info = await this.inner.account(accountId);
        this.warehouse.repo.upsertAccount(info, now().toISOString());
        this.warehouse.knownAccounts.add(accountId);
    }
    listAccounts(): Promise<AccountInfo[]> {
        return this.inner.listAccounts();
    }
    manager(): Promise<{
        id: string;
        name: string;
    } | null> {
        return this.inner.manager();
    }
    defaultAccountId(): string {
        return this.inner.defaultAccountId();
    }
    account(accountId: string): Promise<AccountInfo> {
        return this.inner.account(accountId);
    }
    today(accountId: string): Promise<CivilDate> {
        return this.inner.today(accountId);
    }
    dataThrough(accountId: string): Promise<CivilDate> {
        return this.inner.dataThrough(accountId);
    }
    async invalidate(accountId?: string): Promise<void> {
        this.lastWrite.clear();
        await this.inner.invalidate(accountId);
    }
    async coverage(accountId: string, table: GoogleTableId): Promise<DateRange | null> {
        const google = await this.inner.coverage(accountId, table);
        if (!this.opts.reads || !isDailyTable(table))
            return google;
        try {
            return extend(google, this.warehouse.repo.storedSpan(accountId, table));
        }
        catch (err) {
            this.fail("coverage", err);
            return google;
        }
    }
    async getTable(accountId: string, table: GoogleTableId, range: DateRange): Promise<FactSlice> {
        if (!this.opts.reads || !isDailyTable(table))
            return this.inner.getTable(accountId, table, range);
        let plan: {
            stored: CivilDate[];
            fetch: CivilDate[];
            coverage: DateRange | null;
            google: DateRange | null;
            hotFrom: CivilDate;
        };
        try {
            plan = await this.plan(accountId, table, range);
        }
        catch (err) {
            this.fail("read", err);
            return this.inner.getTable(accountId, table, range);
        }
        const rows: Record<string, unknown>[] = [];
        if (plan.stored.length) {
            try {
                rows.push(...this.warehouse.repo.readDays(accountId, table, plan.stored[0] as CivilDate, plan.stored[plan.stored.length - 1] as CivilDate, new Set(plan.stored)));
            }
            catch (err) {
                this.fail("read", err);
                return this.inner.getTable(accountId, table, range);
            }
        }
        for (const run of runsOf(plan.fetch)) {
            const slice = await this.inner.getTable(accountId, table, run);
            rows.push(...slice.rows);
            await this.writeThrough(accountId, table, run, slice.rows, plan.hotFrom);
        }
        rows.sort((a, b) => (String(a.date) < String(b.date) ? -1 : String(a.date) > String(b.date) ? 1 : 0));
        return { rows, grain: "daily", coverage: plan.coverage ?? undefined };
    }
    private async plan(accountId: string, table: DailyTableId, range: DateRange) {
        const [google, today] = await Promise.all([this.inner.coverage(accountId, table), this.inner.today(accountId)]);
        const repo = this.warehouse.repo;
        const coverage = extend(google, repo.storedSpan(accountId, table));
        const hotFrom = hotFromOf(today, this.opts.restatementDays);
        const stored: CivilDate[] = [];
        const fetch: CivilDate[] = [];
        if (!coverage)
            return { stored, fetch, coverage, google, hotFrom };
        const start = maxDate(range.start, coverage.start);
        const end = minDate(range.end, coverage.end);
        if (start > end)
            return { stored, fetch, coverage, google, hotFrom };
        const ledger = repo.ledger(accountId, table, start, end);
        const inGoogle = (d: CivilDate) => !!google && d >= google.start && d <= google.end;
        for (const d of enumerate(start, end)) {
            const entry = ledger.get(d);
            if (entry?.settled)
                stored.push(d);
            else if (inGoogle(d))
                fetch.push(d);
            else if (entry)
                stored.push(d);
        }
        return { stored, fetch, coverage, google, hotFrom };
    }
    private async writeThrough(accountId: string, table: DailyTableId, run: DateRange, rows: readonly Record<string, unknown>[], hotFrom: CivilDate): Promise<void> {
        const end = minDate(run.end, addDays(hotFrom, -1));
        if (end < run.start)
            return;
        try {
            await this.ensureAccount(accountId);
            this.warehouse.repo.replaceDays(accountId, table, { start: run.start, end }, rows, { fetchedAt: now().toISOString(), hotFrom, runId: null });
        }
        catch (err) {
            this.fail("write-through", err);
        }
    }
    async getDims(accountId: string): Promise<EntityDims> {
        const dims = await this.inner.getDims(accountId);
        if (this.mode !== "live" || !this.opts.reads)
            return dims;
        const hit = this.merged.get(dims);
        if (hit)
            return hit;
        try {
            const stored = this.warehouse.repo.storedDims(accountId);
            const missing = (m: Map<string, unknown>, s: Map<string, unknown>) => [...s.keys()].some((id) => !m.has(id));
            if (!missing(dims.campaigns, stored.campaigns) && !missing(dims.adGroups, stored.adGroups) && !missing(dims.keywords, stored.keywords))
                return dims;
            const out: EntityDims = { campaigns: new Map(stored.campaigns), adGroups: new Map(stored.adGroups), keywords: new Map(stored.keywords) };
            for (const [id, c] of dims.campaigns)
                out.campaigns.set(id, c);
            for (const [id, g] of dims.adGroups)
                out.adGroups.set(id, g);
            for (const [id, k] of dims.keywords)
                out.keywords.set(id, k);
            this.merged.set(dims, out);
            return out;
        }
        catch (err) {
            this.fail("dimension lookup", err);
            return dims;
        }
    }
    async getChangeEvents(accountId: string, range: DateRange): Promise<ChangeEvent[]> {
        const fresh = await this.inner.getChangeEvents(accountId, range);
        if (this.mode !== "live")
            return fresh;
        try {
            if (fresh.length && this.due(`events|${accountId}|${range.start}|${range.end}`)) {
                await this.ensureAccount(accountId);
                this.warehouse.repo.upsertChangeEvents(accountId, fresh, now().toISOString());
            }
            if (!this.opts.reads)
                return fresh;
            const googleFrom = addDays(await this.inner.today(accountId), -(CHANGE_EVENT_DAYS - 1));
            if (range.start >= googleFrom)
                return fresh;
            const older = this.warehouse.repo.readChangeEvents(accountId, range.start, minDate(range.end, addDays(googleFrom, -1)));
            const seen = new Set(fresh.map((e) => e.id));
            return [...fresh, ...older.filter((e) => !seen.has(e.id))].sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
        }
        catch (err) {
            this.fail("change history", err);
            return fresh;
        }
    }
    async getGoogleEstimates(accountId: string): Promise<GoogleEstimates> {
        const est = await this.inner.getGoogleEstimates(accountId);
        if (this.mode !== "live" || (!est.simulations.length && !est.recommendations.length))
            return est;
        try {
            if (this.due(`estimates|${accountId}`)) {
                await this.ensureAccount(accountId);
                this.warehouse.repo.upsertEstimates(accountId, est, await this.inner.today(accountId), now().toISOString());
            }
        }
        catch (err) {
            this.fail("estimate snapshot", err);
        }
        return est;
    }
}
function runsOf(days: readonly CivilDate[]): DateRange[] {
    const runs: DateRange[] = [];
    for (const d of days) {
        const last = runs[runs.length - 1];
        if (last && addDays(last.end, 1) === d)
            last.end = d;
        else
            runs.push({ start: d, end: d });
    }
    return runs;
}
export function isWarehouseSource(s: GoogleAdsSource): s is WarehouseSource {
    return s instanceof WarehouseSource;
}
export function unwrapSource(s: GoogleAdsSource): GoogleAdsSource {
    return isWarehouseSource(s) ? s.inner : s;
}
