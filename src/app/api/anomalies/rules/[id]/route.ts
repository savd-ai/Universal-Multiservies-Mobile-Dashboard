import { thresholdRuleSchema } from "@/lib/domain/contracts/anomaly";
import { routeParam } from "@/lib/server/actions/params";
import { deleteRule, updateRule } from "@/lib/server/anomaly/service";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const PUT = route({ body: thresholdRuleSchema }, async ({ params, body }) => updateRule(routeParam(params, "id"), body));
export const DELETE = route({}, async ({ params }) => {
    await deleteRule(routeParam(params, "id"));
    return { ok: true };
});
