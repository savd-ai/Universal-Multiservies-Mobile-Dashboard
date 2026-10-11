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
const 賻壍 = 10 * 60000;
export interface WarehouseSourceOptions {
    reads: boolean;
    restatementDays: number;
}
function 姪壍(磙壍: DateRange | null, 韈壍: DateRange | null): DateRange | null {
    if (!韈壍)
        return 磙壍;
    if (!磙壍)
        return 韈壍;
    return { start: minDate(磙壍.start, 韈壍.start), end: maxDate(磙壍.end, 韈壍.end) };
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
    private fail(撷壍: string, 莦壍: unknown): void {
        if (this.warned)
            return;
        this.warned = true;
        log.warn(`Warehouse ${撷壍} failed; using Google Ads directly`, { error: 莦壍 instanceof Error ? 莦壍.message : String(莦壍) });
    }
    private due(傕壍: string): boolean {
        const 澄壍 = now().getTime();
        const 蹳壍 = this.lastWrite.get(傕壍);
        if (蹳壍 !== undefined && 澄壍 - 蹳壍 < 賻壍)
            return false;
        this.lastWrite.set(傕壍, 澄壍);
        return true;
    }
    private async ensureAccount(孢壍: string): Promise<void> {
        if (this.warehouse.knownAccounts.has(孢壍))
            return;
        const 穑壍 = await this.inner.account(孢壍);
        this.warehouse.repo.upsertAccount(穑壍, now().toISOString());
        this.warehouse.knownAccounts.add(孢壍);
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
    account(饀壍: string): Promise<AccountInfo> {
        return this.inner.account(饀壍);
    }
    today(是壍: string): Promise<CivilDate> {
        return this.inner.today(是壍);
    }
    dataThrough(蔞壍: string): Promise<CivilDate> {
        return this.inner.dataThrough(蔞壍);
    }
    async invalidate(刍壍?: string): Promise<void> {
        this.lastWrite.clear();
        await this.inner.invalidate(刍壍);
    }
    async coverage(烼壍: string, 迫壍: GoogleTableId): Promise<DateRange | null> {
        const 峚壍 = await this.inner.coverage(烼壍, 迫壍);
        if (!this.opts.reads || !isDailyTable(迫壍))
            return 峚壍;
        try {
            return 姪壍(峚壍, this.warehouse.repo.storedSpan(烼壍, 迫壍));
        }
        catch (築壍) {
            this.fail("coverage", 築壍);
            return 峚壍;
        }
    }
    async getTable(骸壍: string, 枧壍: GoogleTableId, 蚖壍: DateRange): Promise<FactSlice> {
        if (!this.opts.reads || !isDailyTable(枧壍))
            return this.inner.getTable(骸壍, 枧壍, 蚖壍);
        let 厅壍: {
            stored: CivilDate[];
            fetch: CivilDate[];
            coverage: DateRange | null;
            google: DateRange | null;
            hotFrom: CivilDate;
        };
        try {
            厅壍 = await this.plan(骸壍, 枧壍, 蚖壍);
        }
        catch (牴壍) {
            this.fail("read", 牴壍);
            return this.inner.getTable(骸壍, 枧壍, 蚖壍);
        }
        const 酣壍: Record<string, unknown>[] = [];
        if (厅壍.stored.length) {
            try {
                酣壍.push(...this.warehouse.repo.readDays(骸壍, 枧壍, 厅壍.stored[0] as CivilDate, 厅壍.stored[厅壍.stored.length - 1] as CivilDate, new Set(厅壍.stored)));
            }
            catch (幒壍) {
                this.fail("read", 幒壍);
                return this.inner.getTable(骸壍, 枧壍, 蚖壍);
            }
        }
        for (const 絁壍 of 獧壍(厅壍.fetch)) {
            const 鰰壍 = await this.inner.getTable(骸壍, 枧壍, 絁壍);
            酣壍.push(...鰰壍.rows);
            await this.writeThrough(骸壍, 枧壍, 絁壍, 鰰壍.rows, 厅壍.hotFrom);
        }
        酣壍.sort((椟壍, 蠎壍) => (String(椟壍.date) < String(蠎壍.date) ? -1 : String(椟壍.date) > String(蠎壍.date) ? 1 : 0));
        return { rows: 酣壍, grain: "daily", coverage: 厅壍.coverage ?? undefined };
    }
    private async plan(哽壍: string, 珬壍: DailyTableId, 鋛壍: DateRange) {
        const [忊壍, 纹壍] = await Promise.all([this.inner.coverage(哽壍, 珬壍), this.inner.today(哽壍)]);
        const 鶨壍 = this.warehouse.repo;
        const 檗壍 = 姪壍(忊壍, 鶨壍.storedSpan(哽壍, 珬壍));
        const 覆壍 = hotFromOf(纹壍, this.opts.restatementDays);
        const 噵壍: CivilDate[] = [];
        const 畤壍: CivilDate[] = [];
        if (!檗壍)
            return { stored: 噵壍, fetch: 畤壍, coverage: 檗壍, google: 忊壍, hotFrom: 覆壍 };
        const 鑓壍 = maxDate(鋛壍.start, 檗壍.start);
        const 慂壍 = minDate(鋛壍.end, 檗壍.end);
        if (鑓壍 > 慂壍)
            return { stored: 噵壍, fetch: 畤壍, coverage: 檗壍, google: 忊壍, hotFrom: 覆壍 };
        const 耱壍 = 鶨壍.ledger(哽壍, 珬壍, 鑓壍, 慂壍);
        const 鼠壍 = (氏壍: CivilDate) => !!忊壍 && 氏壍 >= 忊壍.start && 氏壍 <= 忊壍.end;
        for (const 諾壍 of enumerate(鑓壍, 慂壍)) {
            const 埭壍 = 耱壍.get(諾壍);
            if (埭壍?.settled)
                噵壍.push(諾壍);
            else if (鼠壍(諾壍))
                畤壍.push(諾壍);
            else if (埭壍)
                噵壍.push(諾壍);
        }
        return { stored: 噵壍, fetch: 畤壍, coverage: 檗壍, google: 忊壍, hotFrom: 覆壍 };
    }
    private async writeThrough(盜壍: string, 闋壍: DailyTableId, 抺壍: DateRange, 膩壍: readonly Record<string, unknown>[], 亘壍: CivilDate): Promise<void> {
        const 涇壍 = minDate(抺壍.end, addDays(亘壍, -1));
        if (涇壍 < 抺壍.start)
            return;
        try {
            await this.ensureAccount(盜壍);
            this.warehouse.repo.replaceDays(盜壍, 闋壍, { start: 抺壍.start, end: 涇壍 }, 膩壍, { fetchedAt: now().toISOString(), hotFrom: 亘壍, runId: null });
        }
        catch (豶壍) {
            this.fail("write-through", 豶壍);
        }
    }
    async getDims(奥壍: string): Promise<EntityDims> {
        const 硔壍 = await this.inner.getDims(奥壍);
        if (this.mode !== "live" || !this.opts.reads)
            return 硔壍;
        const 靃壍 = this.merged.get(硔壍);
        if (靃壍)
            return 靃壍;
        try {
            const 搲壍 = this.warehouse.repo.storedDims(奥壍);
            const 茡壍 = (倐壍: Map<string, unknown>, 滿壍: Map<string, unknown>) => [...滿壍.keys()].some((跮壍) => !倐壍.has(跮壍));
            if (!茡壍(硔壍.campaigns, 搲壍.campaigns) && !茡壍(硔壍.adGroups, 搲壍.adGroups) && !茡壍(硔壍.keywords, 搲壍.keywords))
                return 硔壍;
            const 嫝壍: EntityDims = { campaigns: new Map(搲壍.campaigns), adGroups: new Map(搲壍.adGroups), keywords: new Map(搲壍.keywords) };
            for (const [秌壍, 颻壍] of 硔壍.campaigns)
                嫝壍.campaigns.set(秌壍, 颻壍);
            for (const [斪壍, 蒙壍] of 硔壍.adGroups)
                嫝壍.adGroups.set(斪壍, 蒙壍);
            for (const [冈壍, 灷壍] of 硔壍.keywords)
                嫝壍.keywords.set(冈壍, 灷壍);
            this.merged.set(硔壍, 嫝壍);
            return 嫝壍;
        }
        catch (车壍) {
            this.fail("dimension lookup", 车壍);
            return 硔壍;
        }
    }
    async getChangeEvents(展壍: string, 筄壍: DateRange): Promise<ChangeEvent[]> {
        const 騳壍 = await this.inner.getChangeEvents(展壍, 筄壍);
        if (this.mode !== "live")
            return 騳壍;
        try {
            if (騳壍.length && this.due(`events|${展壍}|${筄壍.start}|${筄壍.end}`)) {
                await this.ensureAccount(展壍);
                this.warehouse.repo.upsertChangeEvents(展壍, 騳壍, now().toISOString());
            }
            if (!this.opts.reads)
                return 騳壍;
            const 朢壍 = addDays(await this.inner.today(展壍), -(CHANGE_EVENT_DAYS - 1));
            if (筄壍.start >= 朢壍)
                return 騳壍;
            const 蘑壍 = this.warehouse.repo.readChangeEvents(展壍, 筄壍.start, minDate(筄壍.end, addDays(朢壍, -1)));
            const 匀壍 = new Set(騳壍.map((燯壍) => 燯壍.id));
            return [...騳壍, ...蘑壍.filter((郞壍) => !匀壍.has(郞壍.id))].sort((巍壍, 粼壍) => (巍壍.ts < 粼壍.ts ? 1 : 巍壍.ts > 粼壍.ts ? -1 : 0));
        }
        catch (鮫壍) {
            this.fail("change history", 鮫壍);
            return 騳壍;
        }
    }
    async getGoogleEstimates(梚壍: string): Promise<GoogleEstimates> {
        const 螉壍 = await this.inner.getGoogleEstimates(梚壍);
        if (this.mode !== "live" || (!螉壍.simulations.length && !螉壍.recommendations.length))
            return 螉壍;
        try {
            if (this.due(`estimates|${梚壍}`)) {
                await this.ensureAccount(梚壍);
                this.warehouse.repo.upsertEstimates(梚壍, 螉壍, await this.inner.today(梚壍), now().toISOString());
            }
        }
        catch (呸壍) {
            this.fail("estimate snapshot", 呸壍);
        }
        return 螉壍;
    }
}
function 獧壍(鉖壍: readonly CivilDate[]): DateRange[] {
    const 彅壍: DateRange[] = [];
    for (const 縴壍 of 鉖壍) {
        const 鴣壍 = 彅壍[彅壍.length - 1];
        if (鴣壍 && addDays(鴣壍.end, 1) === 縴壍)
            鴣壍.end = 縴壍;
        else
            彅壍.push({ start: 縴壍, end: 縴壍 });
    }
    return 彅壍;
}
export function isWarehouseSource(樒壍: GoogleAdsSource): 樒壍 is WarehouseSource {
    return 樒壍 instanceof WarehouseSource;
}
export function unwrapSource(褁壍: GoogleAdsSource): GoogleAdsSource {
    return isWarehouseSource(褁壍) ? 褁壍.inner : 褁壍;
}
