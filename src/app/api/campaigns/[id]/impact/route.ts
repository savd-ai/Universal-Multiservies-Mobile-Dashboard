import { z } from "zod";
import { routeParam } from "@/lib/server/actions/params";
import { changeImpact } from "@/lib/server/campaigns";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const querySchema = z.object({ eventId: z.string().min(1).max(200) });
export const GET = route({ query: querySchema }, async ({ req, params, query }) => changeImpact(await requestContext(req), routeParam(params, "id"), query.eventId));
