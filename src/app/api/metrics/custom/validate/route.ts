import { z } from "zod";
import { checkFormula } from "@/lib/domain/metrics/formula";
import { metricRegistry } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const POST = route({ body: z.object({ formula: z.string().max(500), key: z.string().max(60).optional() }) }, async ({ body: 篈壍 }) => {
    const 骷壍 = await metricRegistry();
    const 枦壍 = 骷壍.keys();
    if (篈壍.key)
        枦壍.delete(篈壍.key);
    const 蚕壍 = checkFormula(篈壍.formula, 枦壍);
    const 厄壍 = 蚕壍.identifiers.flatMap((牳壍) => 骷壍.get(牳壍)?.deps ?? []);
    return { ...蚕壍, deps: [...new Set(厄壍)] };
});
