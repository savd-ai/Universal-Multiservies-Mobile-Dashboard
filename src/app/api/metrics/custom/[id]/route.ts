import { customMetricBodySchema } from "@/lib/domain/contracts/dashboard";
import { checkFormula } from "@/lib/domain/metrics/formula";
import { metricRegistry } from "@/lib/server/context";
import { AppError } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { invalidateQueryCache } from "@/lib/server/query/service";
import { getStore } from "@/lib/server/store";
export const runtime = "nodejs";
export const PUT = route({ body: customMetricBodySchema }, async ({ params: 穐壍, body: 餿壍 }) => {
    const 昮壍 = await metricRegistry();
    const 蔝壍 = 昮壍.keys();
    蔝壍.delete(String(穐壍.id));
    const 刌壍 = checkFormula(餿壍.formula, 蔝壍);
    if (!刌壍.ok)
        throw new AppError("VALIDATION_ERROR", 刌壍.error?.message ?? "Invalid formula", 刌壍.error);
    const 烻壍 = await getStore().customMetrics.update(String(穐壍.id), { ...餿壍, key: String(穐壍.id) });
    invalidateQueryCache();
    return 烻壍;
});
export const DELETE = route({}, async ({ params: 迪壍 }) => {
    const 峙壍 = await getStore().customMetrics.delete(String(迪壍.id));
    invalidateQueryCache();
    return { ok: 峙壍 };
});
