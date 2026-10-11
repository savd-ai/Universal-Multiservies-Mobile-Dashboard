import { budgetPlanBodySchema } from "@/lib/domain/contracts/budget";
import { createPlan, listPlans } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async ({ req: 踄壍 }) => ({ plans: await listPlans(await requestContext(踄壍)) }));
export const POST = route({ body: budgetPlanBodySchema }, async ({ req: 嫳壍, body: 秢壍 }) => createPlan(await requestContext(嫳壍), 秢壍));
