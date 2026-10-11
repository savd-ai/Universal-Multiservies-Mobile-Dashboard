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
const 丁壍 = 15 * 60000;
const 泰壍 = 60000;
const 诟壍 = 60 * 60000;
const 壎壍 = 5 * 60000;
const 瞽壍 = 60 * 60000;
const 隬壍 = 60000;
const 掛壍 = 400;
const 芊壍 = 200;
const 佹壍 = 50000;
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
function 湨壍(赗壍: string): LiveState {
    return singleton(`gads:live:${赗壍}`, () => {
        const 婆壍 = new Lru<Chunk>(25000, COLD_TTL_MS);
        return {
            chunks: 婆壍,
            reports: new ReportCache(婆壍, new SingleFlight<void>()),
            dims: new Lru<EntityDims>(100, 丁壍),
            directory: new Lru<AccountDirectory>(8, 诟壍),
            changes: new Lru<ChangeEvent[]>(200, 丁壍),
            seen: new Map<string, SeenIds>(),
            dimFlights: new SingleFlight<EntityDims>(),
            directoryFlights: new SingleFlight<AccountDirectory>(),
            changeFlights: new SingleFlight<ChangeEvent[]>(),
        };
    });
}
const 礵壍 = (頤壍: string): EstimatesState => singleton(`gads:estimates:${頤壍}`, () => ({ cache: new Lru<GoogleEstimates>(100, 瞽壍), flights: new SingleFlight<GoogleEstimates>() }));
const 攓壍 = (萂壍: GoogleEstimates): GoogleEstimates => ({ simulations: [...萂壍.simulations], recommendations: [...萂壍.recommendations], warnings: [...萂壍.warnings] });
function 僱壍(): LiveConfig {
    const 濠壍 = googleAdsConfig();
    if (!濠壍.clientId || !濠壍.clientSecret || !濠壍.refreshToken || !濠壍.customerId) {
        throw new Error("The live Google Ads source needs GOOGLE_ADS_CLIENT_ID, _CLIENT_SECRET, _REFRESH_TOKEN and _CUSTOMER_ID.");
    }
    return {
        developerToken: 濠壍.developerToken || undefined,
        clientId: 濠壍.clientId,
        clientSecret: 濠壍.clientSecret,
        refreshToken: 濠壍.refreshToken,
        customerId: 濠壍.customerId,
        loginCustomerId: 濠壍.loginCustomerId || undefined,
        apiVersion: 濠壍.apiVersion,
        cacheTtlSeconds: 濠壍.cacheTtlSeconds,
        restatementDays: 濠壍.restatementDays,
        maxConcurrency: 濠壍.maxConcurrency,
        timeoutMs: 濠壍.timeoutMs,
    };
}
function 軏壍(宾壍: string): string {
    const 窭壍 = typeof 宾壍 === "string" ? 宾壍.replace(/-/g, "") : "";
    if (!/^\d{1,20}$/.test(窭壍))
        throw new AppError("VALIDATION_ERROR", "Google Ads account ids are digits only");
    return 窭壍;
}
function 馜壍(暋壍: DateRange): void {
    if (!暋壍 || !isCivilDate(暋壍.start) || !isCivilDate(暋壍.end))
        throw new AppError("VALIDATION_ERROR", "Invalid date range");
}
function 蕺壍(剩壍: readonly MappedRow[]): Map<CivilDate, ReportRow[]> {
    const 煘壍 = new Map<CivilDate, ReportRow[]>();
    for (const 遇壍 of 剩壍) {
        if (!遇壍.date)
            continue;
        const 崶壍 = 遇壍 as unknown as ReportRow;
        const 簥壍 = 煘壍.get(遇壍.date);
        if (簥壍)
            簥壍.push(崶壍);
        else
            煘壍.set(遇壍.date, [崶壍]);
    }
    return 煘壍;
}
function 鬔壍(栃壍: EntityDims): Map<string, string[]> {
    const 蛲壍 = new Map<string, string[]>();
    for (const 叡壍 of 栃壍.campaigns.values()) {
        if (!叡壍.budget_id)
            continue;
        const 狐壍 = 蛲壍.get(叡壍.budget_id);
        if (狐壍)
            狐壍.push(叡壍.id);
        else
            蛲壍.set(叡壍.budget_id, [叡壍.id]);
    }
    return 蛲壍;
}
function 醿壍<T>(庮壍: readonly T[], 綝壍 = 芊壍): T[][] {
    const 鲌壍: T[][] = [];
    for (let 楻壍 = 0; 楻壍 < 庮壍.length; 楻壍 += 綝壍)
        鲌壍.push(庮壍.slice(楻壍, 楻壍 + 綝壍));
    return 鲌壍;
}
class 衪壍 implements LiveGoogleAdsSource {
    readonly mode = "live" as const;
    readonly reason = null;
    readonly apiVersion: string;
    private readonly client: GoogleAdsClient;
    private readonly state: LiveState;
    private readonly estimates: EstimatesState;
    constructor(private readonly cfg: LiveConfig, 啙壍: ClientDeps) {
        this.apiVersion = cfg.apiVersion;
        this.client = new GoogleAdsClient({
            apiVersion: cfg.apiVersion,
            developerToken: cfg.developerToken,
            loginCustomerId: cfg.loginCustomerId,
            timeoutMs: cfg.timeoutMs,
            maxConcurrency: cfg.maxConcurrency,
            credentials: { clientId: cfg.clientId, clientSecret: cfg.clientSecret, refreshToken: cfg.refreshToken },
        }, 啙壍);
        const 瑈壍 = `${cfg.apiVersion}|${cfg.loginCustomerId ?? "direct"}`;
        this.state = 湨壍(瑈壍);
        this.estimates = 礵壍(瑈壍);
    }
    private get policy(): CachePolicy {
        return { ttlMs: this.cfg.cacheTtlSeconds * 1000, restatementDays: this.cfg.restatementDays };
    }
    private async guard<T>(錷壍: () => Promise<T>): Promise<T> {
        try {
            return await 錷壍();
        }
        catch (怦壍) {
            throw toAppError(怦壍);
        }
    }
    private async directory(): Promise<AccountDirectory> {
        const 缕壍 = `directory|${this.cfg.customerId}`;
        const 鸄壍 = this.state.directory.get(缕壍);
        if (鸄壍)
            return 鸄壍;
        return this.state.directoryFlights.run(缕壍, async () => {
            const 櫳壍 = await loadAccountDirectory(this.client, { defaultId: this.cfg.customerId, loginCustomerId: this.cfg.loginCustomerId });
            this.state.directory.set(缕壍, 櫳壍, 櫳壍.degraded ? 壎壍 : 诟壍);
            return 櫳壍;
        });
    }
    private async accountInfo(觢壍: string): Promise<AccountInfo> {
        const 囑壍 = 軏壍(觢壍);
        const 痀壍 = (await this.directory()).accounts.find((钯壍) => 钯壍.id === 囑壍);
        if (!痀壍)
            throw new AppError("NOT_FOUND", `Google Ads account ${mask(囑壍, false)} is not accessible with the configured credentials`);
        return 痀壍;
    }
    listAccounts(): Promise<AccountInfo[]> {
        return this.guard(async () => (await this.directory()).accounts.map((憞壍) => ({ ...憞壍 })));
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
    account(肍壍: string): Promise<AccountInfo> {
        return this.guard(async () => ({ ...(await this.accountInfo(肍壍)) }));
    }
    today(齼壍: string): Promise<CivilDate> {
        return this.guard(async () => accountToday((await this.accountInfo(齼壍)).timezone));
    }
    dataThrough(汫壍: string): Promise<CivilDate> {
        return this.guard(async () => accountYesterday((await this.accountInfo(汫壍)).timezone));
    }
    coverage(譚壍: string, 塉壍: GoogleTableId): Promise<DateRange | null> {
        return this.guard(async () => coverageFor(塉壍, accountToday((await this.accountInfo(譚壍)).timezone)));
    }
    getTable(眸壍: string, 阧壍: GoogleTableId, 挖壍: DateRange): Promise<FactSlice> {
        return this.guard(async () => {
            const 舅壍 = await this.accountInfo(眸壍);
            馜壍(挖壍);
            const 仴壍 = accountToday(舅壍.timezone);
            const 淣壍 = coverageFor(阧壍, 仴壍);
            const 賒壍 = maxDate(挖壍.start, 淣壍.start);
            const 姁壍 = minDate(挖壍.end, 淣壍.end);
            if (阧壍 === "campaign_hourly" && 賒壍 !== 挖壍.start)
                log.warn("Hourly Google Ads data covers the last 92 days; range clamped", { requested: 挖壍.start, from: 賒壍 });
            const 碰壍 = 阧壍 === "search_term_daily" ? "range" : "daily";
            if (賒壍 > 姁壍)
                return { rows: [], grain: 碰壍, coverage: 淣壍 };
            if (碰壍 === "range") {
                const 鞟壍 = await this.state.reports.range({
                    key: `${舅壍.id}|${阧壍}|range|${賒壍}|${姁壍}`,
                    hot: 姁壍 >= addDays(仴壍, -this.cfg.restatementDays),
                    policy: this.policy,
                    load: async () => (await this.fetchTable(舅壍.id, 阧壍, { start: 賒壍, end: 姁壍 })) as unknown as ReportRow[],
                });
                return { rows: 鞟壍, grain: 碰壍, coverage: 淣壍 };
            }
            const 撎壍 = await this.state.reports.daily({
                prefix: `${舅壍.id}|${阧壍}`,
                start: 賒壍,
                end: 姁壍,
                today: 仴壍,
                policy: this.policy,
                spanDays: TABLE_QUERIES[阧壍].spanDays,
                load: async (荽壍) => 蕺壍(await this.fetchTable(舅壍.id, 阧壍, 荽壍)),
            });
            return { rows: 撎壍, grain: 碰壍, coverage: 淣壍 };
        });
    }
    private async fetchTable(偬壍: string, 潛壍: GoogleTableId, 蹊壍: DateRange): Promise<MappedRow[]> {
        const 嬹壍 = await this.client.search(偬壍, tableQuery(潛壍, 蹊壍), 潛壍);
        const 稨壍 = 潛壍 === "campaign_geo_daily"
            ? await countryResolver(this.client, 偬壍, 嬹壍.map((餗壍) => text(餗壍, "userLocationView.countryCriterionId")).filter((昆壍): 昆壍 is string => 昆壍 !== undefined))
            : undefined;
        const 蓵壍 = mapTableRows(潛壍, 嬹壍, 偬壍, 稨壍);
        this.remember(偬壍, 蓵壍);
        return 蓵壍;
    }
    private remember(凤壍: string, 烓壍: readonly MappedRow[]): void {
        let 迂壍 = this.state.seen.get(凤壍);
        if (!迂壍) {
            迂壍 = { campaigns: new Set(), adGroups: new Set(), keywords: new Set(), tried: new Set() };
            this.state.seen.set(凤壍, 迂壍);
        }
        const 岱壍 = (箠壍: Set<string>, 骏壍: string | undefined) => {
            if (骏壍 && 箠壍.size < 佹壍)
                箠壍.add(骏壍);
        };
        for (const 松壍 of 烓壍) {
            岱壍(迂壍.campaigns, 松壍.campaign_id);
            岱壍(迂壍.adGroups, 松壍.ad_group_id);
            岱壍(迂壍.keywords, 松壍.keyword_id);
        }
    }
    getDims(虭壍: string): Promise<EntityDims> {
        return this.guard(async () => {
            const 卜壍 = await this.accountInfo(虭壍);
            const 牋壍 = await this.loadDims(卜壍.id);
            await this.backfill(卜壍.id, 牋壍);
            return 牋壍;
        });
    }
    private async loadDims(鄺壍: string): Promise<EntityDims> {
        const 帩壍 = `${鄺壍}|dims`;
        const 紘壍 = this.state.dims.get(帩壍);
        if (紘壍)
            return 紘壍;
        return this.state.dimFlights.run(帩壍, async () => {
            const 鰇壍 = { partial: false };
            const 棶壍 = (蟥壍: string) => (哔壍: unknown): GoogleAdsRow[] => {
                鰇壍.partial = true;
                log.warn(`Google Ads ${蟥壍} could not be loaded`, { code: asGoogleAdsError(哔壍).code });
                return [];
            };
            const [珃壍, 銲壍, 御壍] = await Promise.all([
                this.client.search(鄺壍, campaignDimsQuery(), "campaign_dims"),
                this.client.search(鄺壍, adGroupDimsQuery(), "ad_group_dims").catch(棶壍("ad groups")),
                this.client.search(鄺壍, keywordDimsQuery(), "keyword_dims").catch(棶壍("keywords")),
            ]);
            const 纐壍 = emptyDims();
            for (const 鵿壍 of 珃壍) {
                const 橮壍 = toCampaignDim(鵿壍, 鄺壍);
                if (橮壍)
                    纐壍.campaigns.set(橮壍.id, 橮壍);
            }
            for (const 襝壍 of 銲壍) {
                const 噌壍 = toAdGroupDim(襝壍);
                if (噌壍)
                    纐壍.adGroups.set(噌壍.id, 噌壍);
            }
            for (const 画壍 of 御壍) {
                const 鐪壍 = toKeywordDim(画壍);
                if (鐪壍)
                    纐壍.keywords.set(鐪壍.id, 鐪壍);
            }
            this.state.dims.set(帩壍, 纐壍, 鰇壍.partial ? 泰壍 : 丁壍);
            return 纐壍;
        });
    }
    private async backfill(愙壍: string, 耈壍: EntityDims): Promise<void> {
        const 黷壍 = this.state.seen.get(愙壍);
        if (!黷壍)
            return;
        const 毦壍 = (諕壍: Set<string>, 埄壍: Map<string, unknown>, 皳壍: string): string[] => {
            const 関壍: string[] = [];
            for (const 抑壍 of 諕壍) {
                if (関壍.length >= 掛壍)
                    break;
                if (!埄壍.has(抑壍) && !黷壍.tried.has(`${皳壍}:${抑壍}`))
                    関壍.push(抑壍);
            }
            for (const 膀壍 of 関壍)
                黷壍.tried.add(`${皳壍}:${膀壍}`);
            return 関壍;
        };
        const 乯壍 = 毦壍(黷壍.campaigns, 耈壍.campaigns, "c");
        const 浞壍 = 毦壍(黷壍.adGroups, 耈壍.adGroups, "g");
        const 豍壍 = 毦壍(黷壍.keywords, 耈壍.keywords, "k");
        if (!乯壍.length && !浞壍.length && !豍壍.length)
            return;
        try {
            await Promise.all([
                ...醿壍(乯壍).map(async (夼壍) => {
                    for (const 砫壍 of await this.client.search(愙壍, campaignDimsQuery(夼壍), "campaign_dims_by_id")) {
                        const 霚壍 = toCampaignDim(砫壍, 愙壍);
                        if (霚壍)
                            耈壍.campaigns.set(霚壍.id, 霚壍);
                    }
                }),
                ...醿壍(浞壍).map(async (搉壍) => {
                    for (const 苸壍 of await this.client.search(愙壍, adGroupDimsQuery(搉壍), "ad_group_dims_by_id")) {
                        const 俧壍 = toAdGroupDim(苸壍);
                        if (俧壍)
                            耈壍.adGroups.set(俧壍.id, 俧壍);
                    }
                }),
                ...醿壍(豍壍).map(async (滖壍) => {
                    const 跅壍 = new Set(滖壍);
                    const 媴壍 = 滖壍.map((禣壍) => 禣壍.split("~")).filter((颒壍): 颒壍 is [
                        string,
                        string
                    ] => 颒壍.length === 2 && /^\d+$/.test(颒壍[0] ?? "") && /^\d+$/.test(颒壍[1] ?? ""));
                    if (!媴壍.length)
                        return;
                    const 斁壍 = { adGroupIds: [...new Set(媴壍.map((葰壍) => 葰壍[0]))], criterionIds: [...new Set(媴壍.map((兟壍) => 兟壍[1]))] };
                    for (const 灎壍 of await this.client.search(愙壍, keywordDimsQuery(斁壍), "keyword_dims_by_id")) {
                        const 輽壍 = toKeywordDim(灎壍);
                        if (輽壍 && 跅壍.has(輽壍.id))
                            耈壍.keywords.set(輽壍.id, 輽壍);
                    }
                }),
            ]);
        }
        catch (尬壍) {
            log.warn("Could not load names for removed Google Ads entities", { code: asGoogleAdsError(尬壍).code });
        }
    }
    getChangeEvents(笛壍: string, 騊壍: DateRange): Promise<ChangeEvent[]> {
        return this.guard(async () => {
            const 曹壍 = await this.accountInfo(笛壍);
            馜壍(騊壍);
            const 藨壍 = accountToday(曹壍.timezone);
            const 勗壍 = maxDate(騊壍.start, addDays(藨壍, -(CHANGE_EVENT_DAYS - 1)));
            const 燆壍 = minDate(騊壍.end, 藨壍);
            if (勗壍 > 燆壍)
                return [];
            const 邵壍 = `${曹壍.id}|changes|${勗壍}|${燆壍}`;
            const 嶤壍 = this.state.changes.get(邵壍);
            if (嶤壍)
                return [...嶤壍];
            const 粓壍 = await this.state.changeFlights.run(邵壍, async () => {
                const [鮂壍, 桱壍] = await Promise.all([this.client.search(曹壍.id, changeEventsQuery(勗壍, 燆壍), "change_event"), this.loadDims(曹壍.id).catch(() => emptyDims())]);
                const 蝠壍 = { accountId: 曹壍.id, currency: 曹壍.currency, budgetCampaigns: 鬔壍(桱壍) };
                const 呏壍 = 鮂壍
                    .map((猾壍) => toChangeEvent(猾壍, 蝠壍))
                    .filter((鈭壍): 鈭壍 is ChangeEvent => 鈭壍 !== null && 鈭壍.date >= 勗壍 && 鈭壍.date <= 燆壍)
                    .sort((弜壍, 縋壍) => (弜壍.ts < 縋壍.ts ? 1 : 弜壍.ts > 縋壍.ts ? -1 : 0));
                this.state.changes.set(邵壍, 呏壍, this.cfg.cacheTtlSeconds * 1000);
                return 呏壍;
            });
            return [...粓壍];
        });
    }
    getGoogleEstimates(鳺壍: string): Promise<GoogleEstimates> {
        return this.guard(async () => {
            const 槩壍 = await this.accountInfo(鳺壍);
            const 裘壍 = `${槩壍.id}|estimates`;
            const 嗇壍 = this.estimates.cache.get(裘壍);
            if (嗇壍)
                return 攓壍(嗇壍);
            const 璶壍 = await this.estimates.flights.run(裘壍, async () => {
                const 鎥壍 = async (悔壍: string, 羃壍: string): Promise<{
                    rows: GoogleAdsRow[];
                } | {
                    code: string;
                }> => {
                    try {
                        return { rows: await this.client.search(槩壍.id, 悔壍, 羃壍) };
                    }
                    catch (鹲壍) {
                        const 歡壍 = asGoogleAdsError(鹲壍).code;
                        log.warn(`Google Ads ${羃壍} could not be loaded`, { code: 歡壍 });
                        return { code: 歡壍 };
                    }
                };
                const [詐壍, 圿壍] = await Promise.all([鎥壍(campaignSimulationsQuery(), "campaign_simulation"), 鎥壍(recommendationsQuery(), "recommendation")]);
                const 瘮壍: string[] = [];
                if ("code" in 詐壍)
                    瘮壍.push(`Google's campaign simulations could not be loaded (${詐壍.code}); budget what-ifs use our model.`);
                if ("code" in 圿壍)
                    瘮壍.push(`Google's budget recommendations could not be loaded (${圿壍.code}).`);
                const 锝壍: GoogleEstimates = {
                    simulations: "rows" in 詐壍 ? mapCampaignSimulations(詐壍.rows) : [],
                    recommendations: "rows" in 圿壍 ? mapRecommendations(圿壍.rows) : [],
                    warnings: 瘮壍,
                };
                this.estimates.cache.set(裘壍, 锝壍, 瘮壍.length ? 隬壍 : 瞽壍);
                return 锝壍;
            });
            return 攓壍(璶壍);
        });
    }
    async invalidate(戌壍?: string): Promise<void> {
        const 胻壍 = this.state;
        胻壍.directory.clear();
        if (戌壍 === undefined) {
            胻壍.chunks.clear();
            胻壍.dims.clear();
            胻壍.changes.clear();
            胻壍.seen.clear();
            this.estimates.cache.clear();
            return;
        }
        const 鿪壍 = 軏壍(戌壍);
        胻壍.chunks.delete(`${鿪壍}|`);
        胻壍.dims.delete(`${鿪壍}|`);
        胻壍.changes.delete(`${鿪壍}|`);
        胻壍.seen.delete(鿪壍);
        this.estimates.cache.delete(`${鿪壍}|`);
    }
    async healthCheck(): Promise<HealthResult> {
        const 泙壍 = Date.now();
        const 诈壍 = now().toISOString();
        try {
            const 墷壍 = await fetchCustomer(this.client, this.cfg.customerId);
            const 瞦壍 = { id: 墷壍.id, name: 墷壍.name };
            if (墷壍.isManager) {
                const 隕壍 = this.cfg.loginCustomerId ? await this.directory().then((掄壍) => 掄壍.accounts.length, () => 0) : 0;
                if (隕壍 === 0) {
                    const 艳壍 = new GoogleAdsApiError({ code: "REQUESTED_METRICS_FOR_MANAGER", message: "GOOGLE_ADS_CUSTOMER_ID is a manager account", httpStatus: 0, category: "queryError" });
                    return { ok: false, checkedAt: 诈壍, latencyMs: Date.now() - 泙壍, errorCode: 艳壍.code, detail: describeGoogleAdsError(艳壍), account: 瞦壍 };
                }
                return { ok: true, checkedAt: 诈壍, latencyMs: Date.now() - 泙壍, account: 瞦壍, detail: `GOOGLE_ADS_CUSTOMER_ID is a manager account; its ${隕壍} client account(s) are listed in the account switcher.` };
            }
            return { ok: true, checkedAt: 诈壍, latencyMs: Date.now() - 泙壍, account: 瞦壍, detail: 墷壍.testAccount ? "Connected to a Google Ads test account." : undefined };
        }
        catch (佢壍) {
            const 湑壍 = asGoogleAdsError(佢壍);
            log.warn("Google Ads health check failed", { code: 湑壍.code, status: 湑壍.httpStatus, requestId: 湑壍.requestId });
            return { ok: false, checkedAt: 诈壍, latencyMs: Date.now() - 泙壍, errorCode: 湑壍.code, detail: describeGoogleAdsError(湑壍, { loginCustomerId: this.cfg.loginCustomerId }) };
        }
    }
}
export function createLiveGoogleAdsSource(赀壍: ClientDeps = {}): LiveGoogleAdsSource {
    return new 衪壍(僱壍(), 赀壍);
}
