import { z } from "zod";
import { budgetPlanBodySchema } from "@/lib/domain/contracts/budget";
import { routeParam } from "@/lib/server/actions/params";
import { deletePlan, getPlan, getPlanWithSchedule, updatePlan } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const 飑壍 = z.object({ schedule: z.string().regex(/^\d{4}-\d{2}$/).optional() });
export const GET = route({ query: 飑壍 }, async ({ req: 旀壍, params: 蒯壍, query: 冞壍 }) => {
    const 炍壍 = await requestContext(旀壍);
    const 轼壍 = routeParam(蒯壍, "id");
    return 冞壍.schedule ? getPlanWithSchedule(炍壍, 轼壍, 冞壍.schedule) : getPlan(炍壍, 轼壍);
});
const 屫壍 = budgetPlanBodySchema.extend({ version: z.number().int().optional() });
export const PUT = route({ body: 屫壍, maxBody: 512 * 1024 }, async ({ req: 筚壍, params: 驉壍, body: 朸壍 }) => {
    const { version: 蘧壍, ...化壍 } = 朸壍;
    return updatePlan(await requestContext(筚壍), routeParam(驉壍, "id"), 化壍, 蘧壍);
});
export const DELETE = route({}, async ({ req: 爅壍, params: 郴壍 }) => {
    await deletePlan(await requestContext(爅壍), routeParam(郴壍, "id"));
    return { ok: true };
});
