import { z } from "zod";
import { budgetTargetsSchema } from "@/lib/domain/contracts/budget";
import { getTargets, putTargets } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const querySchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() });
export const GET = route({ query: querySchema }, async ({ req, query }) => getTargets(await requestContext(req), query.month));
export const PUT = route({ body: budgetTargetsSchema }, async ({ req, body }) => putTargets(await requestContext(req), body));
