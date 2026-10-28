import { z } from "zod";
import { budgetPlanBodySchema } from "@/lib/domain/contracts/budget";
import { routeParam } from "@/lib/server/actions/params";
import { deletePlan, getPlan, getPlanWithSchedule, updatePlan } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const querySchema = z.object({ schedule: z.string().regex(/^\d{4}-\d{2}$/).optional() });
export const GET = route({ query: querySchema }, async ({ req, params, query }) => {
    const ctx = await requestContext(req);
    const id = routeParam(params, "id");
    return query.schedule ? getPlanWithSchedule(ctx, id, query.schedule) : getPlan(ctx, id);
});
const putSchema = budgetPlanBodySchema.extend({ version: z.number().int().optional() });
export const PUT = route({ body: putSchema, maxBody: 512 * 1024 }, async ({ req, params, body }) => {
    const { version, ...plan } = body;
    return updatePlan(await requestContext(req), routeParam(params, "id"), plan, version);
});
export const DELETE = route({}, async ({ req, params }) => {
    await deletePlan(await requestContext(req), routeParam(params, "id"));
    return { ok: true };
});
