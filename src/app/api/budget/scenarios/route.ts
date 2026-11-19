import { scenariosRequestSchema } from "@/lib/domain/contracts/budget";
import { scenarios } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

// Budget frontier: expected outcome at total × (1 + pct) with the marginal cost of each step.
export const POST = route({ body: scenariosRequestSchema, rateLimit: { key: "budget-compute", perMinute: 120, burst: 30 } }, async ({ req, body }) => scenarios(await requestContext(req), body));
