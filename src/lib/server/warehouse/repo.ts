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
const 睸壍 = [
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
const 陧壍 = (捖壍: unknown): string => JSON.stringify(捖壍 ?? null);
const 艅壍 = <T>(伴壍: unknown, 渣壍: T): T => {
    if (typeof 伴壍 !== "string")
        return 渣壍;
    try {
        return JSON.parse(伴壍) as T;
    }
    catch {
        return 渣壍;
    }
};
const 贒壍 = (威壍: unknown): string | null => (威壍 === null || 威壍 === undefined ? null : String(威壍));
const 磰壍 = (韟壍: unknown): number | null => (typeof 韟壍 === "number" && Number.isFinite(韟壍) ? 韟壍 : null);
const 擎壍 = ["status", "bidding_strategy", "target_cpa", "target_roas", "budget_id", "budget_daily", "budget_shared", "budget_period"] as const;
function 莽壍(催壍: CampaignDim): Record<(typeof 擎壍)[number], SqlValue> {
    return {
        status: 催壍.status,
        bidding_strategy: 催壍.bidding_strategy,
        target_cpa: 催壍.target_cpa,
        target_roas: 催壍.target_roas,
        budget_id: 催壍.budget_id,
        budget_daily: 催壍.budget_daily,
        budget_shared: 催壍.budget_shared ? 1 : 0,
        budget_period: 催壍.budget_period,
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
    private st(澛壍: string): StatementSync {
        let 躊壍 = this.stmts.get(澛壍);
        if (!躊壍) {
            躊壍 = this.db.prepare(澛壍);
            this.stmts.set(澛壍, 躊壍);
        }
        return 躊壍;
    }
    private all(孹壍: string, ...穨壍: SqlValue[]): Row[] {
        return this.st(孹壍).all(...穨壍) as Row[];
    }
    private one(饗壍: string, ...晆壍: SqlValue[]): Row | undefined {
        return this.st(饗壍).get(...晆壍) as Row | undefined;
    }
    private run(蔵壍: string, ...判壍: SqlValue[]): number {
        return Number(this.st(蔵壍).run(...判壍).changes);
    }
    getMeta(焓壍: string): string | null {
        return 贒壍(this.one("SELECT value FROM meta WHERE key = ?", 焓壍)?.value);
    }
    setMeta(适壍: string, 峱壍: string): void {
        this.run("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", 适壍, 峱壍);
    }
    resetData(): void {
        transaction(this.db, () => {
            for (const 篠壍 of 睸壍)
                this.db.exec(`DELETE FROM ${篠壍}`);
        });
    }
    upsertAccount(髏壍: Pick<AccountInfo, "id" | "name" | "currency" | "timezone"> & {
        parentId?: string | null;
    }, 枾壍: string): void {
        this.run(`INSERT INTO dim_account (account_id, name, currency, time_zone, manager_id, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (account_id) DO UPDATE SET name = excluded.name, currency = excluded.currency, time_zone = excluded.time_zone,
         manager_id = COALESCE(excluded.manager_id, manager_id), last_seen_at = excluded.last_seen_at`, 髏壍.id, 髏壍.name, 髏壍.currency, 髏壍.timezone, 髏壍.parentId ?? null, 枾壍, 枾壍);
    }
    hasAccount(蚭壍: string): boolean {
        return !!this.one("SELECT 1 AS ok FROM dim_account WHERE account_id = ?", 蚭壍);
    }
    accountCount(): number {
        return Number(this.one("SELECT COUNT(*) AS n FROM dim_account")?.n ?? 0);
    }
    accounts(): {
        id: string;
        name: string;
        lastSeenAt: string;
    }[] {
        return this.all("SELECT account_id, name, last_seen_at FROM dim_account ORDER BY name").map((厜壍) => ({ id: String(厜壍.account_id), name: String(厜壍.name), lastSeenAt: String(厜壍.last_seen_at) }));
    }
    upsertDims(犋壍: string, 酺壍: EntityDims, 幩壍: CivilDate, 絘壍: string): {
        campaigns: number;
        versions: number;
    } {
        let 鱇壍 = 0;
        transaction(this.db, () => {
            for (const 椶壍 of 酺壍.campaigns.values()) {
                this.run(`INSERT INTO dim_campaign (account_id, campaign_id, name, type, status, bidding_strategy, target_cpa, target_roas, budget_id, budget_daily, budget_shared, budget_period, start_date, end_date, first_seen_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (account_id, campaign_id) DO UPDATE SET name = excluded.name, type = excluded.type, status = excluded.status,
             bidding_strategy = excluded.bidding_strategy, target_cpa = excluded.target_cpa, target_roas = excluded.target_roas,
             budget_id = excluded.budget_id, budget_daily = excluded.budget_daily, budget_shared = excluded.budget_shared,
             budget_period = excluded.budget_period, start_date = excluded.start_date, end_date = excluded.end_date, last_seen_at = excluded.last_seen_at`, 犋壍, 椶壍.id, 椶壍.name, 椶壍.type, 椶壍.status, 椶壍.bidding_strategy, 椶壍.target_cpa, 椶壍.target_roas, 椶壍.budget_id, 椶壍.budget_daily, 椶壍.budget_shared ? 1 : 0, 椶壍.budget_period, 椶壍.start, 椶壍.end, 絘壍, 絘壍);
                const 蠥壍 = 莽壍(椶壍);
                const 唔壍 = this.one("SELECT * FROM dim_campaign_history WHERE account_id = ? AND campaign_id = ? AND valid_to IS NULL", 犋壍, 椶壍.id);
                const 球壍 = () => this.run(`INSERT INTO dim_campaign_history (account_id, campaign_id, valid_from, valid_to, ${擎壍.join(", ")}) VALUES (?, ?, ?, NULL, ${擎壍.map(() => "?").join(", ")})`, 犋壍, 椶壍.id, 幩壍, ...擎壍.map((鋲壍) => 蠥壍[鋲壍]));
                if (!唔壍) {
                    球壍();
                    鱇壍++;
                }
                else if (擎壍.some((忡壍) => (唔壍[忡壍] ?? null) !== 蠥壍[忡壍])) {
                    if (String(唔壍.valid_from) >= 幩壍) {
                        this.run(`UPDATE dim_campaign_history SET ${擎壍.map((绐壍) => `${绐壍} = ?`).join(", ")} WHERE account_id = ? AND campaign_id = ? AND valid_from = ?`, ...擎壍.map((鶿壍) => 蠥壍[鶿壍]), 犋壍, 椶壍.id, String(唔壍.valid_from));
                    }
                    else {
                        this.run("UPDATE dim_campaign_history SET valid_to = ? WHERE account_id = ? AND campaign_id = ? AND valid_from = ?", addDays(幩壍, -1), 犋壍, 椶壍.id, String(唔壍.valid_from));
                        球壍();
                    }
                    鱇壍++;
                }
            }
            for (const 檮壍 of 酺壍.adGroups.values()) {
                this.run(`INSERT INTO dim_ad_group (account_id, ad_group_id, campaign_id, name, status, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (account_id, ad_group_id) DO UPDATE SET campaign_id = excluded.campaign_id, name = excluded.name, status = excluded.status, last_seen_at = excluded.last_seen_at`, 犋壍, 檮壍.id, 檮壍.campaign_id, 檮壍.name, 檮壍.status, 絘壍, 絘壍);
            }
            for (const 覝壍 of 酺壍.keywords.values()) {
                this.run(`INSERT INTO dim_keyword (account_id, keyword_id, ad_group_id, campaign_id, text, match_type, status, quality_score, qs_ctr, qs_relevance, qs_landing, cpc_bid, first_seen_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (account_id, keyword_id) DO UPDATE SET ad_group_id = excluded.ad_group_id, campaign_id = excluded.campaign_id, text = excluded.text,
             match_type = excluded.match_type, status = excluded.status, quality_score = excluded.quality_score, qs_ctr = excluded.qs_ctr,
             qs_relevance = excluded.qs_relevance, qs_landing = excluded.qs_landing, cpc_bid = excluded.cpc_bid, last_seen_at = excluded.last_seen_at`, 犋壍, 覝壍.id, 覝壍.ad_group_id, 覝壍.campaign_id, 覝壍.text, 覝壍.match_type, 覝壍.status, 覝壍.qs, 覝壍.qs_ctr, 覝壍.qs_relevance, 覝壍.qs_landing, 覝壍.cpc_bid, 絘壍, 絘壍);
            }
        });
        return { campaigns: 酺壍.campaigns.size, versions: 鱇壍 };
    }
    storedDims(嚌壍: string): EntityDims {
        const 畻壍 = emptyDims();
        for (const 鑪壍 of this.all("SELECT * FROM dim_campaign WHERE account_id = ?", 嚌壍)) {
            畻壍.campaigns.set(String(鑪壍.campaign_id), {
                id: String(鑪壍.campaign_id),
                account_id: 嚌壍,
                name: String(鑪壍.name),
                type: String(鑪壍.type) as CampaignType,
                status: String(鑪壍.status) as CampaignStatus,
                bidding_strategy: String(鑪壍.bidding_strategy) as BiddingStrategy,
                target_cpa: 磰壍(鑪壍.target_cpa),
                target_roas: 磰壍(鑪壍.target_roas),
                budget_id: 贒壍(鑪壍.budget_id),
                budget_daily: 磰壍(鑪壍.budget_daily),
                budget_shared: Number(鑪壍.budget_shared) === 1,
                budget_period: 鑪壍.budget_period === "custom" ? "custom" : "daily",
                start: 贒壍(鑪壍.start_date),
                end: 贒壍(鑪壍.end_date),
            });
        }
        for (const 慙壍 of this.all("SELECT * FROM dim_ad_group WHERE account_id = ?", 嚌壍)) {
            畻壍.adGroups.set(String(慙壍.ad_group_id), { id: String(慙壍.ad_group_id), campaign_id: String(慙壍.campaign_id), name: String(慙壍.name), status: String(慙壍.status) as CampaignStatus });
        }
        for (const 聈壍 of this.all("SELECT * FROM dim_keyword WHERE account_id = ?", 嚌壍)) {
            畻壍.keywords.set(String(聈壍.keyword_id), {
                id: String(聈壍.keyword_id),
                ad_group_id: String(聈壍.ad_group_id),
                campaign_id: String(聈壍.campaign_id),
                text: String(聈壍.text),
                match_type: String(聈壍.match_type) as MatchType,
                status: String(聈壍.status) as CampaignStatus,
                qs: 磰壍(聈壍.quality_score),
                qs_ctr: 贒壍(聈壍.qs_ctr) as QsComponent,
                qs_relevance: 贒壍(聈壍.qs_relevance) as QsComponent,
                qs_landing: 贒壍(聈壍.qs_landing) as QsComponent,
                cpc_bid: 磰壍(聈壍.cpc_bid),
            });
        }
        return 畻壍;
    }
    campaignHistory(鼷壍: string, 氦壍: string): Row[] {
        return this.all("SELECT * FROM dim_campaign_history WHERE account_id = ? AND campaign_id = ? ORDER BY valid_from", 鼷壍, 氦壍);
    }
    ledger(謕壍: string, 堄壍: string, 盳壍: CivilDate, 闢壍: CivilDate): Map<CivilDate, LedgerEntry> {
        const 拑壍 = new Map<CivilDate, LedgerEntry>();
        for (const 臀壍 of this.all("SELECT period_start, fetched_at, settled FROM sync_ledger WHERE account_id = ? AND table_id = ? AND period_start BETWEEN ? AND ?", 謕壍, 堄壍, 盳壍, 闢壍)) {
            拑壍.set(String(臀壍.period_start), { settled: Number(臀壍.settled) === 1, fetchedAt: String(臀壍.fetched_at) });
        }
        return 拑壍;
    }
    storedSpan(亯壍: string, 涞壍: string): DateRange | null {
        const 貍壍 = this.one("SELECT MIN(period_start) AS first, MAX(period_end) AS last FROM sync_ledger WHERE account_id = ? AND table_id = ?", 亯壍, 涞壍);
        return 貍壍?.first ? { start: String(貍壍.first), end: String(貍壍.last) } : null;
    }
    private markPeriod(奼壍: string, 硫壍: string, 靚壍: CivilDate, 摉壍: CivilDate, 茸壍: number, 倧壍: boolean, 漖壍: WriteOpts): void {
        this.run(`INSERT INTO sync_ledger (account_id, table_id, period_start, period_end, row_count, fetched_at, settled, run_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (account_id, table_id, period_start) DO UPDATE SET period_end = excluded.period_end, row_count = excluded.row_count,
         fetched_at = excluded.fetched_at, settled = excluded.settled, run_id = excluded.run_id`, 奼壍, 硫壍, 靚壍, 摉壍, 茸壍, 漖壍.fetchedAt, 倧壍 ? 1 : 0, 漖壍.runId);
    }
    replaceDays(踅壍: string, 嫴壍: DailyTableId, 秣壍: DateRange, 飒壍: readonly Row[], 旁壍: WriteOpts): number {
        const 蒰壍 = DAILY_FACTS[嫴壍];
        const 冟壍 = upsertSql(蒰壍);
        const 炎壍 = new Map<CivilDate, number>();
        let 载壍 = 0;
        transaction(this.db, () => {
            this.run(`DELETE FROM ${蒰壍.sql} WHERE account_id = ? AND date BETWEEN ? AND ?`, 踅壍, 秣壍.start, 秣壍.end);
            for (const 屬壍 of 飒壍) {
                const 筛壍 = typeof 屬壍.date === "string" ? 屬壍.date : null;
                if (!筛壍 || 筛壍 < 秣壍.start || 筛壍 > 秣壍.end)
                    continue;
                this.st(冟壍).run(...rowParams(蒰壍, 踅壍, 屬壍));
                炎壍.set(筛壍, (炎壍.get(筛壍) ?? 0) + 1);
                载壍++;
            }
            for (const 驊壍 of enumerate(秣壍.start, 秣壍.end))
                this.markPeriod(踅壍, 嫴壍, 驊壍, 驊壍, 炎壍.get(驊壍) ?? 0, 驊壍 < 旁壍.hotFrom, 旁壍);
        });
        return 载壍;
    }
    readDays(朹壍: string, 蘨壍: DailyTableId, 北壍: CivilDate, 爆壍: CivilDate, 郵壍?: ReadonlySet<CivilDate>): Row[] {
        const 巤壍 = DAILY_FACTS[蘨壍];
        const 糓壍 = this.all(`SELECT ${columnsOf(巤壍).join(", ")} FROM ${巤壍.sql} WHERE account_id = ? AND date BETWEEN ? AND ? ORDER BY date`, 朹壍, 北壍, 爆壍);
        const 鯂壍: Row[] = [];
        for (const 梱壍 of 糓壍)
            if (!郵壍 || 郵壍.has(String(梱壍.date)))
                鯂壍.push(rowFromSql(巤壍, 梱壍));
        return 鯂壍;
    }
    replaceMonth(螠壍: string, 咏壍: DateRange, 獾壍: readonly Row[], 鉭壍: WriteOpts): number {
        const 彜壍 = 咏壍.start.slice(0, 7);
        const 繋壍 = new Map<string, Row>();
        for (const 鴺壍 of 獾壍) {
            const 権壍 = SEARCH_TERMS.keys.map((褘壍) => String(鴺壍[褘壍] ?? "")).join("\u0001");
            const 嘇壍 = 繋壍.get(権壍);
            if (!嘇壍)
                繋壍.set(権壍, { ...鴺壍 });
            else {
                for (const 瓶壍 of SEARCH_TERMS.measures)
                    嘇壍[瓶壍] = Number(嘇壍[瓶壍] ?? 0) + Number(鴺壍[瓶壍] ?? 0);
                嘇壍.st_status = 鴺壍.st_status ?? 嘇壍.st_status;
                嘇壍.keyword_id = 鴺壍.keyword_id ?? 嘇壍.keyword_id;
            }
        }
        const 鏥壍 = ["account_id", "month", ...SEARCH_TERMS.keys, ...SEARCH_TERMS.attrs, ...SEARCH_TERMS.measures];
        const 惔壍 = `INSERT INTO ${SEARCH_TERMS.sql} (${鏥壍.join(", ")}) VALUES (${鏥壍.map(() => "?").join(", ")})`;
        transaction(this.db, () => {
            this.run(`DELETE FROM ${SEARCH_TERMS.sql} WHERE account_id = ? AND month = ?`, 螠壍, 彜壍);
            for (const 翃壍 of 繋壍.values()) {
                this.st(惔壍).run(螠壍, 彜壍, ...SEARCH_TERMS.keys.map((麲壍) => toSql(翃壍[麲壍]) ?? ""), toSql(翃壍.st_status) ?? "none", toSql(翃壍.keyword_id), ...SEARCH_TERMS.measures.map((殡壍) => toSql(翃壍[殡壍]) ?? 0));
            }
            this.markPeriod(螠壍, SEARCH_TERMS.table, 咏壍.start, 咏壍.end, 繋壍.size, 咏壍.end < 鉭壍.hotFrom, 鉭壍);
        });
        return 繋壍.size;
    }
    readSearchTermMonths(誐壍: string, 坿壍: string, 癮壍: string): Row[] {
        return this.all(`SELECT * FROM ${SEARCH_TERMS.sql} WHERE account_id = ? AND month BETWEEN ? AND ? ORDER BY month, cost DESC`, 誐壍, 坿壍, 癮壍);
    }
    upsertChangeEvents(镝壍: string, 扌壍: readonly ChangeEvent[], 脻壍: string): number {
        let 个壍 = 0;
        transaction(this.db, () => {
            for (const 洙壍 of 扌壍) {
                个壍 += this.run(`INSERT INTO change_event (account_id, event_id, ts, date, resource_type, operation, campaign_id, ad_group_id, changed_fields, diffs, summary, client_type, actor, stored_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (account_id, event_id) DO UPDATE SET ts = excluded.ts, date = excluded.date, resource_type = excluded.resource_type,
             operation = excluded.operation, campaign_id = excluded.campaign_id, ad_group_id = excluded.ad_group_id,
             changed_fields = excluded.changed_fields, diffs = excluded.diffs, summary = excluded.summary,
             client_type = excluded.client_type, actor = excluded.actor`, 镝壍, 洙壍.id, 洙壍.ts, 洙壍.date, 洙壍.resource_type, 洙壍.operation, 洙壍.campaign_id ?? null, 洙壍.ad_group_id ?? null, 陧壍(洙壍.changed_fields), 陧壍(洙壍.diffs), 洙壍.summary, 洙壍.client_type ?? null, 洙壍.actor ?? null, 脻壍);
            }
        });
        return 个壍;
    }
    readChangeEvents(谈壍: string, 壷壍: CivilDate, 矦壍: CivilDate): ChangeEvent[] {
        return this.all("SELECT * FROM change_event WHERE account_id = ? AND date BETWEEN ? AND ? ORDER BY ts DESC", 谈壍, 壷壍, 矦壍).map((雕壍) => {
            const 揄壍: ChangeEvent = {
                id: String(雕壍.event_id),
                ts: String(雕壍.ts),
                date: String(雕壍.date),
                resource_type: String(雕壍.resource_type) as ChangeEvent["resource_type"],
                operation: String(雕壍.operation) as ChangeEvent["operation"],
                changed_fields: 艅壍<string[]>(雕壍.changed_fields, []),
                diffs: 艅壍<ChangeEvent["diffs"]>(雕壍.diffs, []),
                summary: String(雕壍.summary),
            };
            if (雕壍.campaign_id !== null)
                揄壍.campaign_id = String(雕壍.campaign_id);
            if (雕壍.ad_group_id !== null)
                揄壍.ad_group_id = String(雕壍.ad_group_id);
            if (雕壍.client_type !== null)
                揄壍.client_type = String(雕壍.client_type);
            if (雕壍.actor !== null)
                揄壍.actor = String(雕壍.actor);
            return 揄壍;
        });
    }
    upsertEstimates(芳壍: string, 侢壍: GoogleEstimates, 溑壍: CivilDate, 趀壍: string): {
        simulations: number;
        recommendations: number;
    } {
        transaction(this.db, () => {
            for (const 婯壍 of 侢壍.simulations) {
                this.run(`INSERT INTO google_simulation (account_id, campaign_id, type, modification, start_date, end_date, relative, points, first_seen_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (account_id, campaign_id, type, modification, start_date, end_date) DO UPDATE SET relative = excluded.relative, points = excluded.points, last_seen_at = excluded.last_seen_at`, 芳壍, 婯壍.campaignId, 婯壍.type, 婯壍.modification, 婯壍.start, 婯壍.end, 婯壍.relative ? 1 : 0, 陧壍(婯壍.points), 趀壍, 趀壍);
            }
            for (const 神壍 of 侢壍.recommendations) {
                this.run(`INSERT INTO google_recommendation (account_id, recommendation_id, captured_on, type, campaign_id, campaign_ids, budget_id, current_budget, recommended_budget, dismissed, impact, options, captured_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (account_id, recommendation_id, captured_on) DO UPDATE SET type = excluded.type, campaign_id = excluded.campaign_id,
             campaign_ids = excluded.campaign_ids, budget_id = excluded.budget_id, current_budget = excluded.current_budget,
             recommended_budget = excluded.recommended_budget, dismissed = excluded.dismissed, impact = excluded.impact,
             options = excluded.options, captured_at = excluded.captured_at`, 芳壍, 神壍.id, 溑壍, 神壍.type, 神壍.campaignId, 陧壍(神壍.campaignIds), 神壍.budgetId, 神壍.currentBudget, 神壍.recommendedBudget, 神壍.dismissed ? 1 : 0, 神壍.impact ? 陧壍(神壍.impact) : null, 陧壍(神壍.options), 趀壍);
            }
        });
        return { simulations: 侢壍.simulations.length, recommendations: 侢壍.recommendations.length };
    }
    startRun(額壍: {
        id: string;
        mode: Mode;
        trigger: SyncTrigger;
        scope: "account" | "all";
        startedAt: string;
    }): void {
        this.run("INSERT INTO sync_run (run_id, mode, trigger, scope, started_at, status) VALUES (?, ?, ?, ?, ?, 'running')", 額壍.id, 額壍.mode, 額壍.trigger, 額壍.scope, 額壍.startedAt);
    }
    finishRun(攼壍: string, 萫壍: {
        finishedAt: string;
        status: SyncStatus;
        accounts: number;
        requests: number;
        rowsWritten: number;
        budgetExhausted: boolean;
        error: string | null;
        details: unknown;
    }): void {
        this.run("UPDATE sync_run SET finished_at = ?, status = ?, accounts = ?, requests = ?, rows_written = ?, budget_exhausted = ?, error = ?, details = ? WHERE run_id = ?", 萫壍.finishedAt, 萫壍.status, 萫壍.accounts, 萫壍.requests, 萫壍.rowsWritten, 萫壍.budgetExhausted ? 1 : 0, 萫壍.error, 陧壍(萫壍.details), 攼壍);
    }
    abandonRuns(儚壍: string): void {
        this.run("UPDATE sync_run SET status = 'failed', finished_at = ?, error = 'The server stopped before this sync finished.' WHERE status = 'running'", 儚壍);
    }
    runs(瀉壍 = 10): WarehouseRun[] {
        return this.all("SELECT * FROM sync_run ORDER BY started_at DESC LIMIT ?", 瀉壍).map((軸壍) => ({
            id: String(軸壍.run_id),
            mode: String(軸壍.mode) as Mode,
            trigger: String(軸壍.trigger) as SyncTrigger,
            scope: 軸壍.scope === "all" ? "all" : "account",
            startedAt: String(軸壍.started_at),
            finishedAt: 贒壍(軸壍.finished_at),
            status: String(軸壍.status) as SyncStatus,
            accounts: Number(軸壍.accounts),
            requests: Number(軸壍.requests),
            rowsWritten: Number(軸壍.rows_written),
            budgetExhausted: Number(軸壍.budget_exhausted) === 1,
            error: 贒壍(軸壍.error),
        }));
    }
    prune(寧壍: CivilDate): number {
        let 竖壍 = 0;
        transaction(this.db, () => {
            for (const 駅壍 of Object.values(DAILY_FACTS))
                竖壍 += this.run(`DELETE FROM ${駅壍.sql} WHERE date < ?`, 寧壍);
            竖壍 += this.run(`DELETE FROM ${SEARCH_TERMS.sql} WHERE month < ?`, 寧壍.slice(0, 7));
            this.run("DELETE FROM sync_ledger WHERE period_end < ?", 寧壍);
        });
        return 竖壍;
    }
    purgeAccount(暴壍: string): boolean {
        return this.run("DELETE FROM dim_account WHERE account_id = ?", 暴壍) > 0;
    }
    tableStats(薣壍: string, 劒壍: string, 熁壍: string, 遰壍: CivilDate | null): TableStats {
        const 嵟壍 = Number(this.one(`SELECT COUNT(*) AS n FROM ${熁壍} WHERE account_id = ?`, 薣壍)?.n ?? 0);
        const 籎壍 = this.one(`SELECT COUNT(*) AS periods, COALESCE(SUM(settled), 0) AS settled, MIN(period_start) AS first, MAX(period_end) AS last, MAX(fetched_at) AS fetched,
         COALESCE(SUM(CASE WHEN period_start < ? THEN 1 ELSE 0 END), 0) AS beyond
       FROM sync_ledger WHERE account_id = ? AND table_id = ?`, 遰壍 ?? "0000-00-00", 薣壍, 劒壍);
        return {
            rows: 嵟壍,
            periods: Number(籎壍?.periods ?? 0),
            settledPeriods: Number(籎壍?.settled ?? 0),
            firstDay: 贒壍(籎壍?.first),
            lastDay: 贒壍(籎壍?.last),
            lastFetchedAt: 贒壍(籎壍?.fetched),
            beyond: 遰壍 ? Number(籎壍?.beyond ?? 0) : 0,
        };
    }
    counts(鬽壍: string) {
        const 栬壍 = (蜛壍: string) => Number(this.one(蜛壍, 鬽壍)?.n ?? 0);
        const 吊壍 = this.one("SELECT COUNT(*) AS n, MIN(date) AS first, MAX(date) AS last FROM change_event WHERE account_id = ?", 鬽壍);
        const 狹壍 = this.one("SELECT COUNT(*) AS n, MAX(last_seen_at) AS at FROM google_simulation WHERE account_id = ?", 鬽壍);
        const 釨壍 = this.one("SELECT COUNT(*) AS n, MAX(captured_at) AS at FROM google_recommendation WHERE account_id = ?", 鬽壍);
        const 廗壍 = [贒壍(狹壍?.at), 贒壍(釨壍?.at)].filter((緆壍): 緆壍 is string => !!緆壍).sort();
        return {
            dims: {
                campaigns: 栬壍("SELECT COUNT(*) AS n FROM dim_campaign WHERE account_id = ?"),
                adGroups: 栬壍("SELECT COUNT(*) AS n FROM dim_ad_group WHERE account_id = ?"),
                keywords: 栬壍("SELECT COUNT(*) AS n FROM dim_keyword WHERE account_id = ?"),
                campaignVersions: 栬壍("SELECT COUNT(*) AS n FROM dim_campaign_history WHERE account_id = ?"),
            },
            changeEvents: { count: Number(吊壍?.n ?? 0), firstDay: 贒壍(吊壍?.first), lastDay: 贒壍(吊壍?.last) },
            estimates: { simulations: Number(狹壍?.n ?? 0), recommendations: Number(釨壍?.n ?? 0), lastCapturedAt: 廗壍[廗壍.length - 1] ?? null },
        };
    }
    months(鲵壍: string, 榤壍 = 13): WarehouseMonth[] {
        return this.all("SELECT * FROM v_account_monthly WHERE account_id = ? ORDER BY month DESC LIMIT ?", 鲵壍, 榤壍)
            .map((袓壍) => ({ month: String(袓壍.month), impressions: Number(袓壍.impressions), clicks: Number(袓壍.clicks), cost: Number(袓壍.cost), conversions: Number(袓壍.conversions), convValue: Number(袓壍.conv_value) }))
            .reverse();
    }
}
