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
export function toRuns(days: readonly CivilDate[], maxSpan: number): DateRange[] {
    const runs: DateRange[] = [];
    for (const d of days) {
        const last = runs[runs.length - 1];
        if (last && addDays(last.end, 1) === d && diffDays(last.start, d) < maxSpan)
            last.end = d;
        else
            runs.push({ start: d, end: d });
    }
    return runs;
}
export class ReportCache {
    constructor(private readonly lru: Lru<Chunk>, private readonly flights: SingleFlight<void>) { }
    async daily(opts: {
        prefix: string;
        start: CivilDate;
        end: CivilDate;
        today: CivilDate;
        policy: CachePolicy;
        spanDays: number;
        load: (range: DateRange) => Promise<Map<CivilDate, ReportRow[]>>;
    }): Promise<ReportRow[]> {
        const t = now().getTime();
        const hotFrom = addDays(opts.today, -opts.policy.restatementDays);
        const days = enumerate(opts.start, opts.end);
        const have = new Map<CivilDate, Chunk>();
        const missing: CivilDate[] = [];
        const stale: CivilDate[] = [];
        for (const d of days) {
            const chunk = this.lru.get(`${opts.prefix}|${d}`);
            if (!chunk)
                missing.push(d);
            else {
                have.set(d, chunk);
                if (d >= hotFrom && t - chunk.fetchedAt >= opts.policy.ttlMs)
                    stale.push(d);
            }
        }
        if (missing.length) {
            const filled = await Promise.all(toRuns(missing, opts.spanDays).map((r) => this.fillDays(opts, r, hotFrom)));
            for (const m of filled)
                for (const [d, c] of m)
                    have.set(d, c);
        }
        for (const r of toRuns(stale, opts.spanDays)) {
            const key = `${opts.prefix}|swr|${r.start}|${r.end}`;
            void this.flights
                .run(key, async () => {
                await this.fillDays(opts, r, hotFrom);
            })
                .catch((err: unknown) => {
                log.warn("Background refresh of Google Ads data failed", { table: opts.prefix, error: err instanceof Error ? err.message : String(err) });
            });
        }
        return days.flatMap((d) => have.get(d)?.rows ?? []);
    }
    async range(opts: {
        key: string;
        hot: boolean;
        policy: CachePolicy;
        load: () => Promise<ReportRow[]>;
    }): Promise<readonly ReportRow[]> {
        const chunk = this.lru.get(opts.key);
        if (chunk) {
            if (opts.hot && now().getTime() - chunk.fetchedAt >= opts.policy.ttlMs) {
                void this.flights
                    .run(`${opts.key}|swr`, async () => {
                    await this.fillRange(opts);
                })
                    .catch((err: unknown) => {
                    log.warn("Background refresh of Google Ads data failed", { table: opts.key, error: err instanceof Error ? err.message : String(err) });
                });
            }
            return chunk.rows;
        }
        return (await this.fillRange(opts)).rows;
    }
    private async fillDays(opts: {
        prefix: string;
        policy: CachePolicy;
        load: (range2: DateRange) => Promise<Map<CivilDate, ReportRow[]>>;
    }, range: DateRange, hotFrom: CivilDate): Promise<Map<CivilDate, Chunk>> {
        const buckets = await opts.load(range);
        const fetchedAt = now().getTime();
        const out = new Map<CivilDate, Chunk>();
        for (const d of enumerate(range.start, range.end)) {
            const chunk: Chunk = { rows: buckets.get(d) ?? [], fetchedAt };
            this.lru.set(`${opts.prefix}|${d}`, chunk, d >= hotFrom ? opts.policy.ttlMs + STALE_WINDOW_MS : COLD_TTL_MS);
            out.set(d, chunk);
        }
        return out;
    }
    private async fillRange(opts: {
        key: string;
        hot: boolean;
        policy: CachePolicy;
        load: () => Promise<ReportRow[]>;
    }): Promise<Chunk> {
        const chunk: Chunk = { rows: await opts.load(), fetchedAt: now().getTime() };
        this.lru.set(opts.key, chunk, opts.hot ? opts.policy.ttlMs + STALE_WINDOW_MS : COLD_TTL_MS);
        return chunk;
    }
}
