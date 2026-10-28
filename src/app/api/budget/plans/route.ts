import { budgetPlanBodySchema } from "@/lib/domain/contracts/budget";
import { createPlan, listPlans } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async ({ req }) => ({ plans: await listPlans(await requestContext(req)) }));
export const POST = route({ body: budgetPlanBodySchema }, async ({ req, body }) => createPlan(await requestContext(req), body));
