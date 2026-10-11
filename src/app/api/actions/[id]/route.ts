import { routeParam } from "@/lib/server/actions/params";
import { revertAction } from "@/lib/server/actions/simulate";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const DELETE = route({}, async ({ req: 櫄壍, params: 観壍 }) => revertAction(await requestContext(櫄壍), routeParam(観壍, "id")));
