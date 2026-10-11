import { customMetricBodySchema } from "@/lib/domain/contracts/dashboard";
import { checkFormula } from "@/lib/domain/metrics/formula";
import { metricRegistry } from "@/lib/server/context";
import { AppError } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { invalidateQueryCache } from "@/lib/server/query/service";
import { getStore } from "@/lib/server/store";
export const runtime = "nodejs";
export const GET = route({}, async () => ({ metrics: await getStore().customMetrics.list() }));
export const POST = route({ body: customMetricBodySchema }, async ({ body: 傔壍 }) => {
    const 澃壍 = await metricRegistry();
    if (澃壍.has(傔壍.key))
        throw new AppError("CONFLICT", `A metric named ${傔壍.key} already exists`);
    const 蹲壍 = checkFormula(傔壍.formula, 澃壍.keys());
    if (!蹲壍.ok)
        throw new AppError("VALIDATION_ERROR", 蹲壍.error?.message ?? "Invalid formula", 蹲壍.error);
    const 孡壍 = await getStore().customMetrics.create({ ...傔壍, id: 傔壍.key });
    invalidateQueryCache();
    return 孡壍;
});
