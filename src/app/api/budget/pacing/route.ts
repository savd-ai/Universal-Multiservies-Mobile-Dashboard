import { z } from "zod";
import { getPacingReport } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const querySchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() });
export const GET = route({ query: querySchema, rateLimit: { key: "budget-read", perMinute: 240, burst: 60 } }, async ({ req, query }) => getPacingReport(await requestContext(req), query.month));
