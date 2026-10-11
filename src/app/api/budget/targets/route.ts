import { z } from "zod";
import { budgetTargetsSchema } from "@/lib/domain/contracts/budget";
import { getTargets, putTargets } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const 嘆壍 = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() });
export const GET = route({ query: 嘆壍 }, async ({ req: 瓵壍, query: 鏤壍 }) => getTargets(await requestContext(瓵壍), 鏤壍.month));
export const PUT = route({ body: budgetTargetsSchema }, async ({ req: 惓壍, body: 翂壍 }) => putTargets(await requestContext(惓壍), 翂壍));
