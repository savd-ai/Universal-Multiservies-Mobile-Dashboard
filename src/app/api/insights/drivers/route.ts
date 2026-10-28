import { z } from "zod";
import { DATE_PRESETS } from "@/lib/domain/dates";
import { dateRangeSpecSchema, dimensionKeySchema, filterSchema, querySourceSchema } from "@/lib/domain/query/spec";
import { computeDrivers } from "@/lib/server/campaigns";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const bodySchema = z.object({
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
export const POST = route({ body: bodySchema, rateLimit: { key: "drivers", perMinute: 120, burst: 30 } }, async ({ req, body }) => {
    const ctx = await requestContext(req, body.accountId);
    return computeDrivers(ctx, { ...body, dateRange: body.dateRange ?? { preset: body.range ?? "last_7d" } });
});
