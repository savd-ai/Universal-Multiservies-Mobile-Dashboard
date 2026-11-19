import { optimizeRequestSchema } from "@/lib/domain/contracts/budget";
import { optimize } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

// Reallocate the budget over response curves (marginal) or with the prototype's ROAS rebalance; total preserved.
export const POST = route({ body: optimizeRequestSchema, rateLimit: { key: "budget-compute", perMinute: 120, burst: 30 } }, async ({ req, body }) => optimize(await requestContext(req), body));
