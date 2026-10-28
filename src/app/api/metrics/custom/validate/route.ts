import { z } from "zod";
import { checkFormula } from "@/lib/domain/metrics/formula";
import { metricRegistry } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const POST = route({ body: z.object({ formula: z.string().max(500), key: z.string().max(60).optional() }) }, async ({ body }) => {
    const registry = await metricRegistry();
    const known = registry.keys();
    if (body.key)
        known.delete(body.key);
    const check = checkFormula(body.formula, known);
    const deps = check.identifiers.flatMap((id) => registry.get(id)?.deps ?? []);
    return { ...check, deps: [...new Set(deps)] };
});
