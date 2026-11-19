import { simulateRequestSchema } from "@/lib/domain/contracts/actions";
import { simulateAction } from "@/lib/server/actions/simulate";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

// Demo: simulate pause / enable / budget / plan / negatives (revertible overlay + audit).
// Live: 409 READ_ONLY_LIVE with deep links, a change list and an Editor CSV — Google Ads is never modified.
export const POST = route({ body: simulateRequestSchema, rateLimit: { key: "simulate", perMinute: 60, burst: 20 } }, async ({ req, body }) => simulateAction(await requestContext(req), body));
