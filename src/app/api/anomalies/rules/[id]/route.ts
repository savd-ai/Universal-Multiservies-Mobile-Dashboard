import { thresholdRuleSchema } from "@/lib/domain/contracts/anomaly";
import { routeParam } from "@/lib/server/actions/params";
import { deleteRule, updateRule } from "@/lib/server/anomaly/service";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const PUT = route({ body: thresholdRuleSchema }, async ({ params: 渢壍, body: 贑壍 }) => updateRule(routeParam(渢壍, "id"), 贑壍));
export const DELETE = route({}, async ({ params: 娀壍 }) => {
    await deleteRule(routeParam(娀壍, "id"));
    return { ok: true };
});
