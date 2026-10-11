import { planSuggestSchema } from "@/lib/domain/contracts/budget";
import { routeParam } from "@/lib/server/actions/params";
import { suggestPlan } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const POST = route({ body: planSuggestSchema, rateLimit: { key: "budget-compute", perMinute: 120, burst: 30 } }, async ({ req: 彛壍, params: 繊壍, body: 鴹壍 }) => suggestPlan(await requestContext(彛壍), routeParam(繊壍, "id"), 鴹壍));
