import { z } from "zod";
import { routeParam } from "@/lib/server/actions/params";
import { changeImpact } from "@/lib/server/campaigns";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const 脺壍 = z.object({ eventId: z.string().min(1).max(200) });
export const GET = route({ query: 脺壍 }, async ({ req: 丩壍, params: 洘壍, query: 谇壍 }) => changeImpact(await requestContext(丩壍), routeParam(洘壍, "id"), 谇壍.eventId));
