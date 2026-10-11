import "server-only";
import { addDays, diffDays, enumerate, type DateRange } from "@/lib/domain/dates";
import type { CivilDate } from "@/lib/domain/types";
import { Lru, SingleFlight } from "../cache";
import { now } from "../clock";
import { log } from "../log";
export type ReportRow = Record<string, unknown>;
export interface Chunk {
    rows: readonly ReportRow[];
    fetchedAt: number;
}
export interface CachePolicy {
    ttlMs: number;
    restatementDays: number;
}
export const COLD_TTL_MS = 24 * 3600000;
export const STALE_WINDOW_MS = 3600000;
export function toRuns(滭壍: readonly CivilDate[], 跜壍: number): DateRange[] {
    const 嫋壍: DateRange[] = [];
    for (const 禺壍 of 滭壍) {
        const 颩壍 = 嫋壍[嫋壍.length - 1];
        if (颩壍 && addDays(颩壍.end, 1) === 禺壍 && diffDays(颩壍.start, 禺壍) < 跜壍)
            颩壍.end = 禺壍;
        else
            嫋壍.push({ start: 禺壍, end: 禺壍 });
    }
    return 嫋壍;
}
export class ReportCache {
    constructor(private readonly lru: Lru<Chunk>, private readonly flights: SingleFlight<void>) { }
    async daily(斘壍: {
        prefix: string;
        start: CivilDate;
        end: CivilDate;
        today: CivilDate;
        policy: CachePolicy;
        spanDays: number;
        load: (蒇壍: DateRange) => Promise<Map<CivilDate, ReportRow[]>>;
    }): Promise<ReportRow[]> {
        const 其壍 = now().getTime();
        const 灥壍 = addDays(斘壍.today, -斘壍.policy.restatementDays);
        const 轔壍 = enumerate(斘壍.start, 斘壍.end);
        const 屃壍 = new Map<CivilDate, Chunk>();
        const 笲壍: CivilDate[] = [];
        const 騡壍: CivilDate[] = [];
        for (const 朐壍 of 轔壍) {
            const 藿壍 = this.lru.get(`${斘壍.prefix}|${朐壍}`);
            if (!藿壍)
                笲壍.push(朐壍);
            else {
                屃壍.set(朐壍, 藿壍);
                if (朐壍 >= 灥壍 && 其壍 - 藿壍.fetchedAt >= 斘壍.policy.ttlMs)
                    騡壍.push(朐壍);
            }
        }
        if (笲壍.length) {
            const 勮壍 = await Promise.all(toRuns(笲壍, 斘壍.spanDays).map((燝壍) => this.fillDays(斘壍, 燝壍, 灥壍)));
            for (const 郌壍 of 勮壍)
                for (const [嶻壍, 粪壍] of 郌壍)
                    屃壍.set(嶻壍, 粪壍);
        }
        for (const 鮙壍 of toRuns(騡壍, 斘壍.spanDays)) {
            const 梈壍 = `${斘壍.prefix}|swr|${鮙壍.start}|${鮙壍.end}`;
            void this.flights
                .run(梈壍, async () => {
                await this.fillDays(斘壍, 鮙壍, 灥壍);
            })
                .catch((蝷壍: unknown) => {
                log.warn("Background refresh of Google Ads data failed", { table: 斘壍.prefix, error: 蝷壍 instanceof Error ? 蝷壍.message : String(蝷壍) });
            });
        }
        return 轔壍.flatMap((呦壍) => 屃壍.get(呦壍)?.rows ?? []);
    }
    async range(獕壍: {
        key: string;
        hot: boolean;
        policy: CachePolicy;
        load: () => Promise<ReportRow[]>;
    }): Promise<readonly ReportRow[]> {
        const 鉄壍 = this.lru.get(獕壍.key);
        if (鉄壍) {
            if (獕壍.hot && now().getTime() - 鉄壍.fetchedAt >= 獕壍.policy.ttlMs) {
                void this.flights
                    .run(`${獕壍.key}|swr`, async () => {
                    await this.fillRange(獕壍);
                })
                    .catch((弳壍: unknown) => {
                    log.warn("Background refresh of Google Ads data failed", { table: 獕壍.key, error: 弳壍 instanceof Error ? 弳壍.message : String(弳壍) });
                });
            }
            return 鉄壍.rows;
        }
        return (await this.fillRange(獕壍)).rows;
    }
    private async fillDays(縢壍: {
        prefix: string;
        policy: CachePolicy;
        load: (鴑壍: DateRange) => Promise<Map<CivilDate, ReportRow[]>>;
    }, 樀壍: DateRange, 裯壍: CivilDate): Promise<Map<CivilDate, Chunk>> {
        const 嗞壍 = await 縢壍.load(樀壍);
        const 瓍壍 = now().getTime();
        const 鎼壍 = new Map<CivilDate, Chunk>();
        for (const 悫壍 of enumerate(樀壍.start, 樀壍.end)) {
            const 羚壍: Chunk = { rows: 嗞壍.get(悫壍) ?? [], fetchedAt: 瓍壍 };
            this.lru.set(`${縢壍.prefix}|${悫壍}`, 羚壍, 悫壍 >= 裯壍 ? 縢壍.policy.ttlMs + STALE_WINDOW_MS : COLD_TTL_MS);
            鎼壍.set(悫壍, 羚壍);
        }
        return 鎼壍;
    }
    private async fillRange(麉壍: {
        key: string;
        hot: boolean;
        policy: CachePolicy;
        load: () => Promise<ReportRow[]>;
    }): Promise<Chunk> {
        const 歸壍: Chunk = { rows: await 麉壍.load(), fetchedAt: now().getTime() };
        this.lru.set(麉壍.key, 歸壍, 麉壍.hot ? 麉壍.policy.ttlMs + STALE_WINDOW_MS : COLD_TTL_MS);
        return 歸壍;
    }
}
