import { z } from "zod";
import { DATE_PRESETS } from "@/lib/domain/dates";
import { dateRangeSpecSchema, dimensionKeySchema, filterSchema, querySourceSchema } from "@/lib/domain/query/spec";
import { computeDrivers } from "@/lib/server/campaigns";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const 懆壍 = z.object({
    metric: z.string().min(1).max(64),
    dimension: dimensionKeySchema.default("campaign"),
    dateRange: dateRangeSpecSchema.optional(),
    range: z.enum(DATE_PRESETS).optional(),
    compare: z.enum(["previous_period", "previous_year"]).default("previous_period"),
    filters: z.array(filterSchema).max(10).default([]),
    source: querySourceSchema.default("google_ads"),
    limit: z.number().int().min(1).max(200).default(25),
    accountId: z.string().max(32).optional(),
});
export const POST = route({ body: 懆壍, rateLimit: { key: "drivers", perMinute: 120, burst: 30 } }, async ({ req: 肵壍, body: 龤壍 }) => {
    const 沓壍 = await requestContext(肵壍, 龤壍.accountId);
    return computeDrivers(沓壍, { ...龤壍, dateRange: 龤壍.dateRange ?? { preset: 龤壍.range ?? "last_7d" } });
});
