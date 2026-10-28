import "server-only";
import type { GoogleEstimates } from "@/lib/domain/contracts/estimates";
import { addDays, isCivilDate, maxDate, minDate, type DateRange } from "@/lib/domain/dates";
import type { FactSlice } from "@/lib/domain/query/engine";
import { emptyDims, type ChangeEvent, type EntityDims } from "@/lib/domain/schema/facts";
import type { AccountInfo, CivilDate } from "@/lib/domain/types";
import { Lru, SingleFlight, singleton } from "../cache";
import { accountToday, accountYesterday, now } from "../clock";
import type { GoogleAdsSource, GoogleTableId, HealthResult } from "../datasource/types";
import { googleAdsConfig } from "../env/config";
import { mask } from "../env/status";
import { AppError } from "../http/errors";
import { log } from "../log";
import { fetchCustomer, loadAccountDirectory, type AccountDirectory } from "./accounts";
import { toChangeEvent } from "./change-events";
import { GoogleAdsClient, type ClientDeps } from "./client";
import { asGoogleAdsError, describeGoogleAdsError, GoogleAdsApiError, toAppError } from "./errors";
import { mapCampaignSimulations, mapRecommendations } from "./estimates";
import { countryResolver } from "./geo";
import { text, type GoogleAdsRow } from "./json";
import { mapTableRows, toAdGroupDim, toCampaignDim, toKeywordDim, type MappedRow } from "./mappers";
import { adGroupDimsQuery, campaignDimsQuery, campaignSimulationsQuery, CHANGE_EVENT_DAYS, changeEventsQuery, coverageFor, keywordDimsQuery, recommendationsQuery, TABLE_QUERIES, tableQuery } from "./queries";
import { COLD_TTL_MS, ReportCache, type CachePolicy, type Chunk, type ReportRow } from "./report-cache";
export interface LiveGoogleAdsSource extends GoogleAdsSource {
    healthCheck(): Promise<HealthResult>;
}
interface LiveConfig {
    developerToken?: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    customerId: string;
    loginCustomerId?: string;
    apiVersion: string;
    cacheTtlSeconds: number;
    restatementDays: number;
    maxConcurrency: number;
    timeoutMs: number;
}
const DIMS_TTL_MS = 15 * 60000;
const PARTIAL_DIMS_TTL_MS = 60000;
const DIRECTORY_TTL_MS = 60 * 60000;
const DEGRADED_DIRECTORY_TTL_MS = 5 * 60000;
const ESTIMATES_TTL_MS = 60 * 60000;
const PARTIAL_ESTIMATES_TTL_MS = 60000;
const BACKFILL_LIMIT = 400;
const BACKFILL_BATCH = 200;
const SEEN_LIMIT = 50000;
interface SeenIds {
    campaigns: Set<string>;
    adGroups: Set<string>;
    keywords: Set<string>;
    tried: Set<string>;
}
interface LiveState {
    chunks: Lru<Chunk>;
    reports: ReportCache;
    dims: Lru<EntityDims>;
    directory: Lru<AccountDirectory>;
    changes: Lru<ChangeEvent[]>;
    seen: Map<string, SeenIds>;
    dimFlights: SingleFlight<EntityDims>;
    directoryFlights: SingleFlight<AccountDirectory>;
    changeFlights: SingleFlight<ChangeEvent[]>;
}
interface EstimatesState {
    cache: Lru<GoogleEstimates>;
    flights: SingleFlight<GoogleEstimates>;
}
function liveState(ns: string): LiveState {
    return singleton(`gads:live:${ns}`, () => {
        const chunks = new Lru<Chunk>(25000, COLD_TTL_MS);
        return {
            chunks,
            reports: new ReportCache(chunks, new SingleFlight<void>()),
            dims: new Lru<EntityDims>(100, DIMS_TTL_MS),
            directory: new Lru<AccountDirectory>(8, DIRECTORY_TTL_MS),
            changes: new Lru<ChangeEvent[]>(200, DIMS_TTL_MS),
            seen: new Map<string, SeenIds>(),
            dimFlights: new SingleFlight<EntityDims>(),
            directoryFlights: new SingleFlight<AccountDirectory>(),
            changeFlights: new SingleFlight<ChangeEvent[]>(),
        };
    });
}
const estimatesState = (ns: string): EstimatesState => singleton(`gads:estimates:${ns}`, () => ({ cache: new Lru<GoogleEstimates>(100, ESTIMATES_TTL_MS), flights: new SingleFlight<GoogleEstimates>() }));
const copyEstimates = (e: GoogleEstimates): GoogleEstimates => ({ simulations: [...e.simulations], recommendations: [...e.recommendations], warnings: [...e.warnings] });
function liveConfig(): LiveConfig {
    const c = googleAdsConfig();
    if (!c.clientId || !c.clientSecret || !c.refreshToken || !c.customerId) {
        throw new Error("The live Google Ads source needs GOOGLE_ADS_CLIENT_ID, _CLIENT_SECRET, _REFRESH_TOKEN and _CUSTOMER_ID.");
    }
    return {
        developerToken: c.developerToken || undefined,
        clientId: c.clientId,
        clientSecret: c.clientSecret,
        refreshToken: c.refreshToken,
        customerId: c.customerId,
        loginCustomerId: c.loginCustomerId || undefined,
        apiVersion: c.apiVersion,
        cacheTtlSeconds: c.cacheTtlSeconds,
        restatementDays: c.restatementDays,
        maxConcurrency: c.maxConcurrency,
        timeoutMs: c.timeoutMs,
    };
}
function accountDigits(accountId: string): string {
    const id = typeof accountId === "string" ? accountId.replace(/-/g, "") : "";
    if (!/^\d{1,20}$/.test(id))
        throw new AppError("VALIDATION_ERROR", "Google Ads account ids are digits only");
    return id;
}
function assertRange(range: DateRange): void {
    if (!range || !isCivilDate(range.start) || !isCivilDate(range.end))
        throw new AppError("VALIDATION_ERROR", "Invalid date range");
}
function bucketByDate(rows: readonly MappedRow[]): Map<CivilDate, ReportRow[]> {
    const out = new Map<CivilDate, ReportRow[]>();
    for (const r of rows) {
        if (!r.date)
            continue;
        const row = r as unknown as ReportRow;
        const list = out.get(r.date);
        if (list)
            list.push(row);
        else
            out.set(r.date, [row]);
    }
    return out;
}
function budgetOwners(dims: EntityDims): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const c of dims.campaigns.values()) {
        if (!c.budget_id)
            continue;
        const list = out.get(c.budget_id);
        if (list)
            list.push(c.id);
        else
            out.set(c.budget_id, [c.id]);
    }
    return out;
}
function batches<T>(items: readonly T[], size = BACKFILL_BATCH): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size)
        out.push(items.slice(i, i + size));
    return out;
}
class LiveSource implements LiveGoogleAdsSource {
    readonly mode = "live" as const;
    readonly reason = null;
    readonly apiVersion: string;
    private readonly client: GoogleAdsClient;
    private readonly state: LiveState;
    private readonly estimates: EstimatesState;
    constructor(private readonly cfg: LiveConfig, deps: ClientDeps) {
        this.apiVersion = cfg.apiVersion;
        this.client = new GoogleAdsClient({
            apiVersion: cfg.apiVersion,
            developerToken: cfg.developerToken,
            loginCustomerId: cfg.loginCustomerId,
            timeoutMs: cfg.timeoutMs,
            maxConcurrency: cfg.maxConcurrency,
            credentials: { clientId: cfg.clientId, clientSecret: cfg.clientSecret, refreshToken: cfg.refreshToken },
        }, deps);
        const ns = `${cfg.apiVersion}|${cfg.loginCustomerId ?? "direct"}`;
        this.state = liveState(ns);
        this.estimates = estimatesState(ns);
    }
    private get policy(): CachePolicy {
        return { ttlMs: this.cfg.cacheTtlSeconds * 1000, restatementDays: this.cfg.restatementDays };
    }
    private async guard<T>(fn: () => Promise<T>): Promise<T> {
        try {
            return await fn();
        }
        catch (err) {
            throw toAppError(err);
        }
    }
    private async directory(): Promise<AccountDirectory> {
        const key = `directory|${this.cfg.customerId}`;
        const hit = this.state.directory.get(key);
        if (hit)
            return hit;
        return this.state.directoryFlights.run(key, async () => {
            const dir = await loadAccountDirectory(this.client, { defaultId: this.cfg.customerId, loginCustomerId: this.cfg.loginCustomerId });
            this.state.directory.set(key, dir, dir.degraded ? DEGRADED_DIRECTORY_TTL_MS : DIRECTORY_TTL_MS);
            return dir;
        });
    }
    private async accountInfo(accountId: string): Promise<AccountInfo> {
        const id = accountDigits(accountId);
        const found = (await this.directory()).accounts.find((a) => a.id === id);
        if (!found)
            throw new AppError("NOT_FOUND", `Google Ads account ${mask(id, false)} is not accessible with the configured credentials`);
        return found;
    }
    listAccounts(): Promise<AccountInfo[]> {
        return this.guard(async () => (await this.directory()).accounts.map((a) => ({ ...a })));
    }
    manager(): Promise<{
        id: string;
        name: string;
    } | null> {
        return this.guard(async () => (await this.directory()).manager);
    }
    defaultAccountId(): string {
        return this.cfg.customerId;
    }
    account(accountId: string): Promise<AccountInfo> {
        return this.guard(async () => ({ ...(await this.accountInfo(accountId)) }));
    }
    today(accountId: string): Promise<CivilDate> {
        return this.guard(async () => accountToday((await this.accountInfo(accountId)).timezone));
    }
    dataThrough(accountId: string): Promise<CivilDate> {
        return this.guard(async () => accountYesterday((await this.accountInfo(accountId)).timezone));
    }
    coverage(accountId: string, table: GoogleTableId): Promise<DateRange | null> {
        return this.guard(async () => coverageFor(table, accountToday((await this.accountInfo(accountId)).timezone)));
    }
    getTable(accountId: string, table: GoogleTableId, range: DateRange): Promise<FactSlice> {
        return this.guard(async () => {
            const acct = await this.accountInfo(accountId);
            assertRange(range);
            const today = accountToday(acct.timezone);
            const coverage = coverageFor(table, today);
            const start = maxDate(range.start, coverage.start);
            const end = minDate(range.end, coverage.end);
            if (table === "campaign_hourly" && start !== range.start)
                log.warn("Hourly Google Ads data covers the last 92 days; range clamped", { requested: range.start, from: start });
            const grain = table === "search_term_daily" ? "range" : "daily";
            if (start > end)
                return { rows: [], grain, coverage };
            if (grain === "range") {
                const rows2 = await this.state.reports.range({
                    key: `${acct.id}|${table}|range|${start}|${end}`,
                    hot: end >= addDays(today, -this.cfg.restatementDays),
                    policy: this.policy,
                    load: async () => (await this.fetchTable(acct.id, table, { start, end })) as unknown as ReportRow[],
                });
                return { rows: rows2, grain, coverage };
            }
            const rows = await this.state.reports.daily({
                prefix: `${acct.id}|${table}`,
                start,
                end,
                today,
                policy: this.policy,
                spanDays: TABLE_QUERIES[table].spanDays,
                load: async (r) => bucketByDate(await this.fetchTable(acct.id, table, r)),
            });
            return { rows, grain, coverage };
        });
    }
    private async fetchTable(accountId: string, table: GoogleTableId, range: DateRange): Promise<MappedRow[]> {
        const raw = await this.client.search(accountId, tableQuery(table, range), table);
        const countryOf = table === "campaign_geo_daily"
            ? await countryResolver(this.client, accountId, raw.map((r) => text(r, "userLocationView.countryCriterionId")).filter((id): id is string => id !== undefined))
            : undefined;
        const rows = mapTableRows(table, raw, accountId, countryOf);
        this.remember(accountId, rows);
        return rows;
    }
    private remember(accountId: string, rows: readonly MappedRow[]): void {
        let seen = this.state.seen.get(accountId);
        if (!seen) {
            seen = { campaigns: new Set(), adGroups: new Set(), keywords: new Set(), tried: new Set() };
            this.state.seen.set(accountId, seen);
        }
        const add = (value: Set<string>, id: string | undefined) => {
            if (id && value.size < SEEN_LIMIT)
                value.add(id);
        };
        for (const r of rows) {
            add(seen.campaigns, r.campaign_id);
            add(seen.adGroups, r.ad_group_id);
            add(seen.keywords, r.keyword_id);
        }
    }
    getDims(accountId: string): Promise<EntityDims> {
        return this.guard(async () => {
            const acct = await this.accountInfo(accountId);
            const dims = await this.loadDims(acct.id);
            await this.backfill(acct.id, dims);
            return dims;
        });
    }
    private async loadDims(accountId: string): Promise<EntityDims> {
        const key = `${accountId}|dims`;
        const hit = this.state.dims.get(key);
        if (hit)
            return hit;
        return this.state.dimFlights.run(key, async () => {
            const status = { partial: false };
            const optional = (what: string) => (err: unknown): GoogleAdsRow[] => {
                status.partial = true;
                log.warn(`Google Ads ${what} could not be loaded`, { code: asGoogleAdsError(err).code });
                return [];
            };
            const [campaignRows, adGroupRows, keywordRows] = await Promise.all([
                this.client.search(accountId, campaignDimsQuery(), "campaign_dims"),
                this.client.search(accountId, adGroupDimsQuery(), "ad_group_dims").catch(optional("ad groups")),
                this.client.search(accountId, keywordDimsQuery(), "keyword_dims").catch(optional("keywords")),
            ]);
            const dims = emptyDims();
            for (const r of campaignRows) {
                const c = toCampaignDim(r, accountId);
                if (c)
                    dims.campaigns.set(c.id, c);
            }
            for (const r of adGroupRows) {
                const g = toAdGroupDim(r);
                if (g)
                    dims.adGroups.set(g.id, g);
            }
            for (const r of keywordRows) {
                const k = toKeywordDim(r);
                if (k)
                    dims.keywords.set(k.id, k);
            }
            this.state.dims.set(key, dims, status.partial ? PARTIAL_DIMS_TTL_MS : DIMS_TTL_MS);
            return dims;
        });
    }
    private async backfill(accountId: string, dims: EntityDims): Promise<void> {
        const seen = this.state.seen.get(accountId);
        if (!seen)
            return;
        const pending = (ids: Set<string>, known: Map<string, unknown>, kind: string): string[] => {
            const out: string[] = [];
            for (const id of ids) {
                if (out.length >= BACKFILL_LIMIT)
                    break;
                if (!known.has(id) && !seen.tried.has(`${kind}:${id}`))
                    out.push(id);
            }
            for (const id of out)
                seen.tried.add(`${kind}:${id}`);
            return out;
        };
        const campaigns = pending(seen.campaigns, dims.campaigns, "c");
        const adGroups = pending(seen.adGroups, dims.adGroups, "g");
        const keywords = pending(seen.keywords, dims.keywords, "k");
        if (!campaigns.length && !adGroups.length && !keywords.length)
            return;
        try {
            await Promise.all([
                ...batches(campaigns).map(async (ids) => {
                    for (const r of await this.client.search(accountId, campaignDimsQuery(ids), "campaign_dims_by_id")) {
                        const c = toCampaignDim(r, accountId);
                        if (c)
                            dims.campaigns.set(c.id, c);
                    }
                }),
                ...batches(adGroups).map(async (ids) => {
                    for (const r of await this.client.search(accountId, adGroupDimsQuery(ids), "ad_group_dims_by_id")) {
                        const g = toAdGroupDim(r);
                        if (g)
                            dims.adGroups.set(g.id, g);
                    }
                }),
                ...batches(keywords).map(async (ids) => {
                    const wanted = new Set(ids);
                    const parts = ids.map((id) => id.split("~")).filter((p): p is [
                        string,
                        string
                    ] => p.length === 2 && /^\d+$/.test(p[0] ?? "") && /^\d+$/.test(p[1] ?? ""));
                    if (!parts.length)
                        return;
                    const filter = { adGroupIds: [...new Set(parts.map((p) => p[0]))], criterionIds: [...new Set(parts.map((p) => p[1]))] };
                    for (const r of await this.client.search(accountId, keywordDimsQuery(filter), "keyword_dims_by_id")) {
                        const k = toKeywordDim(r);
                        if (k && wanted.has(k.id))
                            dims.keywords.set(k.id, k);
                    }
                }),
            ]);
        }
        catch (err) {
            log.warn("Could not load names for removed Google Ads entities", { code: asGoogleAdsError(err).code });
        }
    }
    getChangeEvents(accountId: string, range: DateRange): Promise<ChangeEvent[]> {
        return this.guard(async () => {
            const acct = await this.accountInfo(accountId);
            assertRange(range);
            const today = accountToday(acct.timezone);
            const start = maxDate(range.start, addDays(today, -(CHANGE_EVENT_DAYS - 1)));
            const end = minDate(range.end, today);
            if (start > end)
                return [];
            const key = `${acct.id}|changes|${start}|${end}`;
            const hit = this.state.changes.get(key);
            if (hit)
                return [...hit];
            const events = await this.state.changeFlights.run(key, async () => {
                const [rows, dims] = await Promise.all([this.client.search(acct.id, changeEventsQuery(start, end), "change_event"), this.loadDims(acct.id).catch(() => emptyDims())]);
                const ctx = { accountId: acct.id, currency: acct.currency, budgetCampaigns: budgetOwners(dims) };
                const list = rows
                    .map((r) => toChangeEvent(r, ctx))
                    .filter((e): e is ChangeEvent => e !== null && e.date >= start && e.date <= end)
                    .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
                this.state.changes.set(key, list, this.cfg.cacheTtlSeconds * 1000);
                return list;
            });
            return [...events];
        });
    }
    getGoogleEstimates(accountId: string): Promise<GoogleEstimates> {
        return this.guard(async () => {
            const acct = await this.accountInfo(accountId);
            const key = `${acct.id}|estimates`;
            const hit = this.estimates.cache.get(key);
            if (hit)
                return copyEstimates(hit);
            const loaded = await this.estimates.flights.run(key, async () => {
                const read = async (query: string, label: string): Promise<{
                    rows: GoogleAdsRow[];
                } | {
                    code: string;
                }> => {
                    try {
                        return { rows: await this.client.search(acct.id, query, label) };
                    }
                    catch (err) {
                        const code = asGoogleAdsError(err).code;
                        log.warn(`Google Ads ${label} could not be loaded`, { code });
                        return { code };
                    }
                };
                const [sims, recs] = await Promise.all([read(campaignSimulationsQuery(), "campaign_simulation"), read(recommendationsQuery(), "recommendation")]);
                const warnings: string[] = [];
                if ("code" in sims)
                    warnings.push(`Google's campaign simulations could not be loaded (${sims.code}); budget what-ifs use our model.`);
                if ("code" in recs)
                    warnings.push(`Google's budget recommendations could not be loaded (${recs.code}).`);
                const value: GoogleEstimates = {
                    simulations: "rows" in sims ? mapCampaignSimulations(sims.rows) : [],
                    recommendations: "rows" in recs ? mapRecommendations(recs.rows) : [],
                    warnings,
                };
                this.estimates.cache.set(key, value, warnings.length ? PARTIAL_ESTIMATES_TTL_MS : ESTIMATES_TTL_MS);
                return value;
            });
            return copyEstimates(loaded);
        });
    }
    async invalidate(accountId?: string): Promise<void> {
        const s = this.state;
        s.directory.clear();
        if (accountId === undefined) {
            s.chunks.clear();
            s.dims.clear();
            s.changes.clear();
            s.seen.clear();
            this.estimates.cache.clear();
            return;
        }
        const id = accountDigits(accountId);
        s.chunks.delete(`${id}|`);
        s.dims.delete(`${id}|`);
        s.changes.delete(`${id}|`);
        s.seen.delete(id);
        this.estimates.cache.delete(`${id}|`);
    }
    async healthCheck(): Promise<HealthResult> {
        const started = Date.now();
        const checkedAt = now().toISOString();
        try {
            const info = await fetchCustomer(this.client, this.cfg.customerId);
            const account = { id: info.id, name: info.name };
            if (info.isManager) {
                const clients = this.cfg.loginCustomerId ? await this.directory().then((d) => d.accounts.length, () => 0) : 0;
                if (clients === 0) {
                    const e = new GoogleAdsApiError({ code: "REQUESTED_METRICS_FOR_MANAGER", message: "GOOGLE_ADS_CUSTOMER_ID is a manager account", httpStatus: 0, category: "queryError" });
                    return { ok: false, checkedAt, latencyMs: Date.now() - started, errorCode: e.code, detail: describeGoogleAdsError(e), account };
                }
                return { ok: true, checkedAt, latencyMs: Date.now() - started, account, detail: `GOOGLE_ADS_CUSTOMER_ID is a manager account; its ${clients} client account(s) are listed in the account switcher.` };
            }
            return { ok: true, checkedAt, latencyMs: Date.now() - started, account, detail: info.testAccount ? "Connected to a Google Ads test account." : undefined };
        }
        catch (err) {
            const e = asGoogleAdsError(err);
            log.warn("Google Ads health check failed", { code: e.code, status: e.httpStatus, requestId: e.requestId });
            return { ok: false, checkedAt, latencyMs: Date.now() - started, errorCode: e.code, detail: describeGoogleAdsError(e, { loginCustomerId: this.cfg.loginCustomerId }) };
        }
    }
}
export function createLiveGoogleAdsSource(deps: ClientDeps = {}): LiveGoogleAdsSource {
    return new LiveSource(liveConfig(), deps);
}
