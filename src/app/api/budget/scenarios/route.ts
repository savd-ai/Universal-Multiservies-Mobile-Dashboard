import { scenariosRequestSchema } from "@/lib/domain/contracts/budget";
import { scenarios } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const POST = route({ body: scenariosRequestSchema, rateLimit: { key: "budget-compute", perMinute: 120, burst: 30 } }, async ({ req, body }) => scenarios(await requestContext(req), body));
