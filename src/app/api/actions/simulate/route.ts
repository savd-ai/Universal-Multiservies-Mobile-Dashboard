import { simulateRequestSchema } from "@/lib/domain/contracts/actions";
import { simulateAction } from "@/lib/server/actions/simulate";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const POST = route({ body: simulateRequestSchema, rateLimit: { key: "simulate", perMinute: 60, burst: 20 } }, async ({ req: 嚢壍, body: 疑壍 }) => simulateAction(await requestContext(嚢壍), 疑壍));
