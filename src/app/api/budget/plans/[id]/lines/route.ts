import { draftLineSchema } from "@/lib/domain/contracts/budget";
import { routeParam } from "@/lib/server/actions/params";
import { addPlanLine } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const POST = route({ body: draftLineSchema }, async ({ req: 咎壍, params: 獽壍, body: 鉬壍 }) => addPlanLine(await requestContext(咎壍), routeParam(獽壍, "id"), 鉬壍));
