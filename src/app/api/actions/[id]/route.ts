import { routeParam } from "@/lib/server/actions/params";
import { revertAction } from "@/lib/server/actions/simulate";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

// Revert a simulated action (idempotent).
export const DELETE = route({}, async ({ req, params }) => revertAction(await requestContext(req), routeParam(params, "id")));
