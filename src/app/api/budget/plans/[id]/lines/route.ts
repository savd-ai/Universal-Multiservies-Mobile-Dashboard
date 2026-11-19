import { draftLineSchema } from "@/lib/domain/contracts/budget";
import { routeParam } from "@/lib/server/actions/params";
import { addPlanLine } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

// Add (or update) an AI-idea / channel draft line: monthly = daily × the days of each plan month.
export const POST = route({ body: draftLineSchema }, async ({ req, params, body }) => addPlanLine(await requestContext(req), routeParam(params, "id"), body));
