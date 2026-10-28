import { customMetricBodySchema } from "@/lib/domain/contracts/dashboard";
import { checkFormula } from "@/lib/domain/metrics/formula";
import { metricRegistry } from "@/lib/server/context";
import { AppError } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { invalidateQueryCache } from "@/lib/server/query/service";
import { getStore } from "@/lib/server/store";
export const runtime = "nodejs";
export const GET = route({}, async () => ({ metrics: await getStore().customMetrics.list() }));
export const POST = route({ body: customMetricBodySchema }, async ({ body }) => {
    const registry = await metricRegistry();
    if (registry.has(body.key))
        throw new AppError("CONFLICT", `A metric named ${body.key} already exists`);
    const check = checkFormula(body.formula, registry.keys());
    if (!check.ok)
        throw new AppError("VALIDATION_ERROR", check.error?.message ?? "Invalid formula", check.error);
    const created = await getStore().customMetrics.create({ ...body, id: body.key });
    invalidateQueryCache();
    return created;
});
