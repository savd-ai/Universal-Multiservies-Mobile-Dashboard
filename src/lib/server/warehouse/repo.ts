import "server-only";
import type { StatementSync } from "node:sqlite";
import type { GoogleEstimates } from "@/lib/domain/contracts/estimates";
import type { SyncStatus, SyncTrigger, WarehouseMonth, WarehouseRun } from "@/lib/domain/contracts/warehouse";
import { addDays, enumerate, type DateRange } from "@/lib/domain/dates";
import { emptyDims, type BiddingStrategy, type CampaignDim, type ChangeEvent, type EntityDims, type QsComponent } from "@/lib/domain/schema/facts";
import type { AccountInfo, CampaignStatus, CampaignType, CivilDate, MatchType, Mode } from "@/lib/domain/types";
import type { LedgerEntry } from "@/lib/domain/warehouse/plan";
import { transaction, type Db } from "./sqlite";
import { columnsOf, DAILY_FACTS, rowFromSql, rowParams, SEARCH_TERMS, toSql, upsertSql, type DailyTableId } from "./tables";
type Row = Record<string, unknown>;
type SqlValue = string | number | null;
const DATA_TABLES = [
    "sync_ledger",
    "fact_campaign_daily",
    "fact_campaign_device_daily",
    "fact_campaign_geo_daily",
    "fact_campaign_hourly",
    "fact_ad_group_daily",
    "fact_keyword_daily",
    "fact_search_term_monthly",
    "change_event",
    "google_simulation",
    "google_recommendation",
    "dim_campaign_history",
    "dim_keyword",
    "dim_ad_group",
    "dim_campaign",
    "dim_account",
    "sync_run",
] as const;
const json = (v: unknown): string => JSON.stringify(v ?? null);
const parse = <T>(v: unknown, fallback: T): T => {
    if (typeof v !== "string")
        return fallback;
    try {
        return JSON.parse(v) as T;
    }
    catch {
        return fallback;
    }
};
const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const VERSIONED = ["status", "bidding_strategy", "target_cpa", "target_roas", "budget_id", "budget_daily", "budget_shared", "budget_period"] as const;
function versionOf(c: CampaignDim): Record<(typeof VERSIONED)[number], SqlValue> {
    return {
        status: c.status,
        bidding_strategy: c.bidding_strategy,
        target_cpa: c.target_cpa,
        target_roas: c.target_roas,
        budget_id: c.budget_id,
        budget_daily: c.budget_daily,
        budget_shared: c.budget_shared ? 1 : 0,
        budget_period: c.budget_period,
    };
}
export interface TableStats {
    rows: number;
    periods: number;
    settledPeriods: number;
    firstDay: CivilDate | null;
    lastDay: CivilDate | null;
    lastFetchedAt: string | null;
    beyond: number;
}
export interface WriteOpts {
    fetchedAt: string;
    hotFrom: CivilDate;
    runId: string | null;
}
export class WarehouseRepo {
    private readonly stmts = new Map<string, StatementSync>();
    constructor(readonly db: Db) { }
    private st(sql: string): StatementSync {
        let s = this.stmts.get(sql);
        if (!s) {
            s = this.db.prepare(sql);
            this.stmts.set(sql, s);
        }
        return s;
    }
    private all(sql: string, ...params: SqlValue[]): Row[] {
        return this.st(sql).all(...params) as Row[];
    }
    private one(sql: string, ...params: SqlValue[]): Row | undefined {
        return this.st(sql).get(...params) as Row | undefined;
    }
    private run(sql: string, ...params: SqlValue[]): number {
        return Number(this.st(sql).run(...params).changes);
    }
    getMeta(key: string): string | null {
        return str(this.one("SELECT value FROM meta WHERE key = ?", key)?.value);
    }
    setMeta(key: string, value: string): void {
        this.run("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", key, value);
    }
    resetData(): void {
        transaction(this.db, () => {
            for (const t of DATA_TABLES)
                this.db.exec(`DELETE FROM ${t}`);
        });
    }
    upsertAccount(a: Pick<AccountInfo, "id" | "name" | "currency" | "timezone"> & {
        parentId?: string | null;
    }, nowIso: string): void {
        this.run(`INSERT INTO dim_account (account_id, name, currency, time_zone, manager_id, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (account_id) DO UPDATE SET name = excluded.name, currency = excluded.currency, time_zone = excluded.time_zone,
         manager_id = COALESCE(excluded.manager_id, manager_id), last_seen_at = excluded.last_seen_at`, a.id, a.name, a.currency, a.timezone, a.parentId ?? null, nowIso, nowIso);
    }
    hasAccount(accountId: string): boolean {
        return !!this.one("SELECT 1 AS ok FROM dim_account WHERE account_id = ?", accountId);
    }
    accountCount(): number {
        return Number(this.one("SELECT COUNT(*) AS n FROM dim_account")?.n ?? 0);
    }
    accounts(): {
        id: string;
        name: string;
        lastSeenAt: string;
    }[] {
        return this.all("SELECT account_id, name, last_seen_at FROM dim_account ORDER BY name").map((r) => ({ id: String(r.account_id), name: String(r.name), lastSeenAt: String(r.last_seen_at) }));
    }
    upsertDims(accountId: string, dims: EntityDims, asOf: CivilDate, nowIso: string): {
        campaigns: number;
        versions: number;
    } {
        let versions = 0;
        transaction(this.db, () => {
            for (const c of dims.campaigns.values()) {
                this.run(`INSERT INTO dim_campaign (account_id, campaign_id, name, type, status, bidding_strategy, target_cpa, target_roas, budget_id, budget_daily, budget_shared, budget_period, start_date, end_date, first_seen_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (account_id, campaign_id) DO UPDATE SET name = excluded.name, type = excluded.type, status = excluded.status,
             bidding_strategy = excluded.bidding_strategy, target_cpa = excluded.target_cpa, target_roas = excluded.target_roas,
             budget_id = excluded.budget_id, budget_daily = excluded.budget_daily, budget_shared = excluded.budget_shared,
             budget_period = excluded.budget_period, start_date = excluded.start_date, end_date = excluded.end_date, last_seen_at = excluded.last_seen_at`, accountId, c.id, c.name, c.type, c.status, c.bidding_strategy, c.target_cpa, c.target_roas, c.budget_id, c.budget_daily, c.budget_shared ? 1 : 0, c.budget_period, c.start, c.end, nowIso, nowIso);
                const next = versionOf(c);
                const cur = this.one("SELECT * FROM dim_campaign_history WHERE account_id = ? AND campaign_id = ? AND valid_to IS NULL", accountId, c.id);
                const insert = () => this.run(`INSERT INTO dim_campaign_history (account_id, campaign_id, valid_from, valid_to, ${VERSIONED.join(", ")}) VALUES (?, ?, ?, NULL, ${VERSIONED.map(() => "?").join(", ")})`, accountId, c.id, asOf, ...VERSIONED.map((k) => next[k]));
                if (!cur) {
                    insert();
                    versions++;
                }
                else if (VERSIONED.some((k) => (cur[k] ?? null) !== next[k])) {
                    if (String(cur.valid_from) >= asOf) {
                        this.run(`UPDATE dim_campaign_history SET ${VERSIONED.map((k) => `${k} = ?`).join(", ")} WHERE account_id = ? AND campaign_id = ? AND valid_from = ?`, ...VERSIONED.map((k) => next[k]), accountId, c.id, String(cur.valid_from));
                    }
                    else {
                        this.run("UPDATE dim_campaign_history SET valid_to = ? WHERE account_id = ? AND campaign_id = ? AND valid_from = ?", addDays(asOf, -1), accountId, c.id, String(cur.valid_from));
                        insert();
                    }
                    versions++;
                }
            }
            for (const g of dims.adGroups.values()) {
                this.run(`INSERT INTO dim_ad_group (account_id, ad_group_id, campaign_id, name, status, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (account_id, ad_group_id) DO UPDATE SET campaign_id = excluded.campaign_id, name = excluded.name, status = excluded.status, last_seen_at = excluded.last_seen_at`, accountId, g.id, g.campaign_id, g.name, g.status, nowIso, nowIso);
            }
            for (const k of dims.keywords.values()) {
                this.run(`INSERT INTO dim_keyword (account_id, keyword_id, ad_group_id, campaign_id, text, match_type, status, quality_score, qs_ctr, qs_relevance, qs_landing, cpc_bid, first_seen_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (account_id, keyword_id) DO UPDATE SET ad_group_id = excluded.ad_group_id, campaign_id = excluded.campaign_id, text = excluded.text,
             match_type = excluded.match_type, status = excluded.status, quality_score = excluded.quality_score, qs_ctr = excluded.qs_ctr,
             qs_relevance = excluded.qs_relevance, qs_landing = excluded.qs_landing, cpc_bid = excluded.cpc_bid, last_seen_at = excluded.last_seen_at`, accountId, k.id, k.ad_group_id, k.campaign_id, k.text, k.match_type, k.status, k.qs, k.qs_ctr, k.qs_relevance, k.qs_landing, k.cpc_bid, nowIso, nowIso);
            }
        });
        return { campaigns: dims.campaigns.size, versions };
    }
    storedDims(accountId: string): EntityDims {
        const dims = emptyDims();
        for (const r of this.all("SELECT * FROM dim_campaign WHERE account_id = ?", accountId)) {
            dims.campaigns.set(String(r.campaign_id), {
                id: String(r.campaign_id),
                account_id: accountId,
                name: String(r.name),
                type: String(r.type) as CampaignType,
                status: String(r.status) as CampaignStatus,
                bidding_strategy: String(r.bidding_strategy) as BiddingStrategy,
                target_cpa: numOrNull(r.target_cpa),
                target_roas: numOrNull(r.target_roas),
                budget_id: str(r.budget_id),
                budget_daily: numOrNull(r.budget_daily),
                budget_shared: Number(r.budget_shared) === 1,
                budget_period: r.budget_period === "custom" ? "custom" : "daily",
                start: str(r.start_date),
                end: str(r.end_date),
            });
        }
        for (const r of this.all("SELECT * FROM dim_ad_group WHERE account_id = ?", accountId)) {
            dims.adGroups.set(String(r.ad_group_id), { id: String(r.ad_group_id), campaign_id: String(r.campaign_id), name: String(r.name), status: String(r.status) as CampaignStatus });
        }
        for (const r of this.all("SELECT * FROM dim_keyword WHERE account_id = ?", accountId)) {
            dims.keywords.set(String(r.keyword_id), {
                id: String(r.keyword_id),
                ad_group_id: String(r.ad_group_id),
                campaign_id: String(r.campaign_id),
                text: String(r.text),
                match_type: String(r.match_type) as MatchType,
                status: String(r.status) as CampaignStatus,
                qs: numOrNull(r.quality_score),
                qs_ctr: str(r.qs_ctr) as QsComponent,
                qs_relevance: str(r.qs_relevance) as QsComponent,
                qs_landing: str(r.qs_landing) as QsComponent,
                cpc_bid: numOrNull(r.cpc_bid),
            });
        }
        return dims;
    }
    campaignHistory(accountId: string, campaignId: string): Row[] {
        return this.all("SELECT * FROM dim_campaign_history WHERE account_id = ? AND campaign_id = ? ORDER BY valid_from", accountId, campaignId);
    }
    ledger(accountId: string, table: string, start: CivilDate, end: CivilDate): Map<CivilDate, LedgerEntry> {
        const out = new Map<CivilDate, LedgerEntry>();
        for (const r of this.all("SELECT period_start, fetched_at, settled FROM sync_ledger WHERE account_id = ? AND table_id = ? AND period_start BETWEEN ? AND ?", accountId, table, start, end)) {
            out.set(String(r.period_start), { settled: Number(r.settled) === 1, fetchedAt: String(r.fetched_at) });
        }
        return out;
    }
    storedSpan(accountId: string, table: string): DateRange | null {
        const r = this.one("SELECT MIN(period_start) AS first, MAX(period_end) AS last FROM sync_ledger WHERE account_id = ? AND table_id = ?", accountId, table);
        return r?.first ? { start: String(r.first), end: String(r.last) } : null;
    }
    private markPeriod(accountId: string, table: string, start: CivilDate, end: CivilDate, rows: number, settled: boolean, o: WriteOpts): void {
        this.run(`INSERT INTO sync_ledger (account_id, table_id, period_start, period_end, row_count, fetched_at, settled, run_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (account_id, table_id, period_start) DO UPDATE SET period_end = excluded.period_end, row_count = excluded.row_count,
         fetched_at = excluded.fetched_at, settled = excluded.settled, run_id = excluded.run_id`, accountId, table, start, end, rows, o.fetchedAt, settled ? 1 : 0, o.runId);
    }
    replaceDays(accountId: string, table: DailyTableId, range: DateRange, rows: readonly Row[], o: WriteOpts): number {
        const spec = DAILY_FACTS[table];
        const insert = upsertSql(spec);
        const perDay = new Map<CivilDate, number>();
        let written = 0;
        transaction(this.db, () => {
            this.run(`DELETE FROM ${spec.sql} WHERE account_id = ? AND date BETWEEN ? AND ?`, accountId, range.start, range.end);
            for (const r of rows) {
                const d = typeof r.date === "string" ? r.date : null;
                if (!d || d < range.start || d > range.end)
                    continue;
                this.st(insert).run(...rowParams(spec, accountId, r));
                perDay.set(d, (perDay.get(d) ?? 0) + 1);
                written++;
            }
            for (const d of enumerate(range.start, range.end))
                this.markPeriod(accountId, table, d, d, perDay.get(d) ?? 0, d < o.hotFrom, o);
        });
        return written;
    }
    readDays(accountId: string, table: DailyTableId, start: CivilDate, end: CivilDate, only?: ReadonlySet<CivilDate>): Row[] {
        const spec = DAILY_FACTS[table];
        const rows = this.all(`SELECT ${columnsOf(spec).join(", ")} FROM ${spec.sql} WHERE account_id = ? AND date BETWEEN ? AND ? ORDER BY date`, accountId, start, end);
        const out: Row[] = [];
        for (const r of rows)
            if (!only || only.has(String(r.date)))
                out.push(rowFromSql(spec, r));
        return out;
    }
    replaceMonth(accountId: string, month: DateRange, rows: readonly Row[], o: WriteOpts): number {
        const m = month.start.slice(0, 7);
        const byKey = new Map<string, Row>();
        for (const r of rows) {
            const key = SEARCH_TERMS.keys.map((k) => String(r[k] ?? "")).join("\u0001");
            const cur = byKey.get(key);
            if (!cur)
                byKey.set(key, { ...r });
            else {
                for (const k of SEARCH_TERMS.measures)
                    cur[k] = Number(cur[k] ?? 0) + Number(r[k] ?? 0);
                cur.st_status = r.st_status ?? cur.st_status;
                cur.keyword_id = r.keyword_id ?? cur.keyword_id;
            }
        }
        const cols = ["account_id", "month", ...SEARCH_TERMS.keys, ...SEARCH_TERMS.attrs, ...SEARCH_TERMS.measures];
        const sql = `INSERT INTO ${SEARCH_TERMS.sql} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
        transaction(this.db, () => {
            this.run(`DELETE FROM ${SEARCH_TERMS.sql} WHERE account_id = ? AND month = ?`, accountId, m);
            for (const r of byKey.values()) {
                this.st(sql).run(accountId, m, ...SEARCH_TERMS.keys.map((k) => toSql(r[k]) ?? ""), toSql(r.st_status) ?? "none", toSql(r.keyword_id), ...SEARCH_TERMS.measures.map((k) => toSql(r[k]) ?? 0));
            }
            this.markPeriod(accountId, SEARCH_TERMS.table, month.start, month.end, byKey.size, month.end < o.hotFrom, o);
        });
        return byKey.size;
    }
    readSearchTermMonths(accountId: string, fromMonth: string, toMonth: string): Row[] {
        return this.all(`SELECT * FROM ${SEARCH_TERMS.sql} WHERE account_id = ? AND month BETWEEN ? AND ? ORDER BY month, cost DESC`, accountId, fromMonth, toMonth);
    }
    upsertChangeEvents(accountId: string, events: readonly ChangeEvent[], nowIso: string): number {
        let n = 0;
        transaction(this.db, () => {
            for (const e of events) {
                n += this.run(`INSERT INTO change_event (account_id, event_id, ts, date, resource_type, operation, campaign_id, ad_group_id, changed_fields, diffs, summary, client_type, actor, stored_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (account_id, event_id) DO UPDATE SET ts = excluded.ts, date = excluded.date, resource_type = excluded.resource_type,
             operation = excluded.operation, campaign_id = excluded.campaign_id, ad_group_id = excluded.ad_group_id,
             changed_fields = excluded.changed_fields, diffs = excluded.diffs, summary = excluded.summary,
             client_type = excluded.client_type, actor = excluded.actor`, accountId, e.id, e.ts, e.date, e.resource_type, e.operation, e.campaign_id ?? null, e.ad_group_id ?? null, json(e.changed_fields), json(e.diffs), e.summary, e.client_type ?? null, e.actor ?? null, nowIso);
            }
        });
        return n;
    }
    readChangeEvents(accountId: string, start: CivilDate, end: CivilDate): ChangeEvent[] {
        return this.all("SELECT * FROM change_event WHERE account_id = ? AND date BETWEEN ? AND ? ORDER BY ts DESC", accountId, start, end).map((r) => {
            const e: ChangeEvent = {
                id: String(r.event_id),
                ts: String(r.ts),
                date: String(r.date),
                resource_type: String(r.resource_type) as ChangeEvent["resource_type"],
                operation: String(r.operation) as ChangeEvent["operation"],
                changed_fields: parse<string[]>(r.changed_fields, []),
                diffs: parse<ChangeEvent["diffs"]>(r.diffs, []),
                summary: String(r.summary),
            };
            if (r.campaign_id !== null)
                e.campaign_id = String(r.campaign_id);
            if (r.ad_group_id !== null)
                e.ad_group_id = String(r.ad_group_id);
            if (r.client_type !== null)
                e.client_type = String(r.client_type);
            if (r.actor !== null)
                e.actor = String(r.actor);
            return e;
        });
    }
    upsertEstimates(accountId: string, est: GoogleEstimates, capturedOn: CivilDate, nowIso: string): {
        simulations: number;
        recommendations: number;
    } {
        transaction(this.db, () => {
            for (const s of est.simulations) {
                this.run(`INSERT INTO google_simulation (account_id, campaign_id, type, modification, start_date, end_date, relative, points, first_seen_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (account_id, campaign_id, type, modification, start_date, end_date) DO UPDATE SET relative = excluded.relative, points = excluded.points, last_seen_at = excluded.last_seen_at`, accountId, s.campaignId, s.type, s.modification, s.start, s.end, s.relative ? 1 : 0, json(s.points), nowIso, nowIso);
            }
            for (const r of est.recommendations) {
                this.run(`INSERT INTO google_recommendation (account_id, recommendation_id, captured_on, type, campaign_id, campaign_ids, budget_id, current_budget, recommended_budget, dismissed, impact, options, captured_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (account_id, recommendation_id, captured_on) DO UPDATE SET type = excluded.type, campaign_id = excluded.campaign_id,
             campaign_ids = excluded.campaign_ids, budget_id = excluded.budget_id, current_budget = excluded.current_budget,
             recommended_budget = excluded.recommended_budget, dismissed = excluded.dismissed, impact = excluded.impact,
             options = excluded.options, captured_at = excluded.captured_at`, accountId, r.id, capturedOn, r.type, r.campaignId, json(r.campaignIds), r.budgetId, r.currentBudget, r.recommendedBudget, r.dismissed ? 1 : 0, r.impact ? json(r.impact) : null, json(r.options), nowIso);
            }
        });
        return { simulations: est.simulations.length, recommendations: est.recommendations.length };
    }
    startRun(r: {
        id: string;
        mode: Mode;
        trigger: SyncTrigger;
        scope: "account" | "all";
        startedAt: string;
    }): void {
        this.run("INSERT INTO sync_run (run_id, mode, trigger, scope, started_at, status) VALUES (?, ?, ?, ?, ?, 'running')", r.id, r.mode, r.trigger, r.scope, r.startedAt);
    }
    finishRun(id: string, f: {
        finishedAt: string;
        status: SyncStatus;
        accounts: number;
        requests: number;
        rowsWritten: number;
        budgetExhausted: boolean;
        error: string | null;
        details: unknown;
    }): void {
        this.run("UPDATE sync_run SET finished_at = ?, status = ?, accounts = ?, requests = ?, rows_written = ?, budget_exhausted = ?, error = ?, details = ? WHERE run_id = ?", f.finishedAt, f.status, f.accounts, f.requests, f.rowsWritten, f.budgetExhausted ? 1 : 0, f.error, json(f.details), id);
    }
    abandonRuns(nowIso: string): void {
        this.run("UPDATE sync_run SET status = 'failed', finished_at = ?, error = 'The server stopped before this sync finished.' WHERE status = 'running'", nowIso);
    }
    runs(limit = 10): WarehouseRun[] {
        return this.all("SELECT * FROM sync_run ORDER BY started_at DESC LIMIT ?", limit).map((r) => ({
            id: String(r.run_id),
            mode: String(r.mode) as Mode,
            trigger: String(r.trigger) as SyncTrigger,
            scope: r.scope === "all" ? "all" : "account",
            startedAt: String(r.started_at),
            finishedAt: str(r.finished_at),
            status: String(r.status) as SyncStatus,
            accounts: Number(r.accounts),
            requests: Number(r.requests),
            rowsWritten: Number(r.rows_written),
            budgetExhausted: Number(r.budget_exhausted) === 1,
            error: str(r.error),
        }));
    }
    prune(before: CivilDate): number {
        let n = 0;
        transaction(this.db, () => {
            for (const spec of Object.values(DAILY_FACTS))
                n += this.run(`DELETE FROM ${spec.sql} WHERE date < ?`, before);
            n += this.run(`DELETE FROM ${SEARCH_TERMS.sql} WHERE month < ?`, before.slice(0, 7));
            this.run("DELETE FROM sync_ledger WHERE period_end < ?", before);
        });
        return n;
    }
    purgeAccount(accountId: string): boolean {
        return this.run("DELETE FROM dim_account WHERE account_id = ?", accountId) > 0;
    }
    tableStats(accountId: string, table: string, sqlTable: string, googleFrom: CivilDate | null): TableStats {
        const rows = Number(this.one(`SELECT COUNT(*) AS n FROM ${sqlTable} WHERE account_id = ?`, accountId)?.n ?? 0);
        const l = this.one(`SELECT COUNT(*) AS periods, COALESCE(SUM(settled), 0) AS settled, MIN(period_start) AS first, MAX(period_end) AS last, MAX(fetched_at) AS fetched,
         COALESCE(SUM(CASE WHEN period_start < ? THEN 1 ELSE 0 END), 0) AS beyond
       FROM sync_ledger WHERE account_id = ? AND table_id = ?`, googleFrom ?? "0000-00-00", accountId, table);
        return {
            rows,
            periods: Number(l?.periods ?? 0),
            settledPeriods: Number(l?.settled ?? 0),
            firstDay: str(l?.first),
            lastDay: str(l?.last),
            lastFetchedAt: str(l?.fetched),
            beyond: googleFrom ? Number(l?.beyond ?? 0) : 0,
        };
    }
    counts(accountId: string) {
        const n = (sql: string) => Number(this.one(sql, accountId)?.n ?? 0);
        const ev = this.one("SELECT COUNT(*) AS n, MIN(date) AS first, MAX(date) AS last FROM change_event WHERE account_id = ?", accountId);
        const sims = this.one("SELECT COUNT(*) AS n, MAX(last_seen_at) AS at FROM google_simulation WHERE account_id = ?", accountId);
        const recs = this.one("SELECT COUNT(*) AS n, MAX(captured_at) AS at FROM google_recommendation WHERE account_id = ?", accountId);
        const at = [str(sims?.at), str(recs?.at)].filter((v): v is string => !!v).sort();
        return {
            dims: {
                campaigns: n("SELECT COUNT(*) AS n FROM dim_campaign WHERE account_id = ?"),
                adGroups: n("SELECT COUNT(*) AS n FROM dim_ad_group WHERE account_id = ?"),
                keywords: n("SELECT COUNT(*) AS n FROM dim_keyword WHERE account_id = ?"),
                campaignVersions: n("SELECT COUNT(*) AS n FROM dim_campaign_history WHERE account_id = ?"),
            },
            changeEvents: { count: Number(ev?.n ?? 0), firstDay: str(ev?.first), lastDay: str(ev?.last) },
            estimates: { simulations: Number(sims?.n ?? 0), recommendations: Number(recs?.n ?? 0), lastCapturedAt: at[at.length - 1] ?? null },
        };
    }
    months(accountId: string, limit = 13): WarehouseMonth[] {
        return this.all("SELECT * FROM v_account_monthly WHERE account_id = ? ORDER BY month DESC LIMIT ?", accountId, limit)
            .map((r) => ({ month: String(r.month), impressions: Number(r.impressions), clicks: Number(r.clicks), cost: Number(r.cost), conversions: Number(r.conversions), convValue: Number(r.conv_value) }))
            .reverse();
    }
}
