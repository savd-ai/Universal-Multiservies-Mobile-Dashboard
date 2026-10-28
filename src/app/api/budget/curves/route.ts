import { z } from "zod";
import { getCurves } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const querySchema = z.object({ objective: z.enum(["conversions", "conv_value"]).default("conv_value") });
export const GET = route({ query: querySchema, rateLimit: { key: "budget-read", perMinute: 240, burst: 60 } }, async ({ req, query }) => getCurves(await requestContext(req), query.objective));
