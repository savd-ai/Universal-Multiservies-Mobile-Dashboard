import { customMetricBodySchema } from "@/lib/domain/contracts/dashboard";
import { checkFormula } from "@/lib/domain/metrics/formula";
import { metricRegistry } from "@/lib/server/context";
import { AppError } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { invalidateQueryCache } from "@/lib/server/query/service";
import { getStore } from "@/lib/server/store";
export const runtime = "nodejs";
export const PUT = route({ body: customMetricBodySchema }, async ({ params, body }) => {
    const registry = await metricRegistry();
    const known = registry.keys();
    known.delete(String(params.id));
    const check = checkFormula(body.formula, known);
    if (!check.ok)
        throw new AppError("VALIDATION_ERROR", check.error?.message ?? "Invalid formula", check.error);
    const updated = await getStore().customMetrics.update(String(params.id), { ...body, key: String(params.id) });
    invalidateQueryCache();
    return updated;
});
export const DELETE = route({}, async ({ params }) => {
    const ok = await getStore().customMetrics.delete(String(params.id));
    invalidateQueryCache();
    return { ok };
});
