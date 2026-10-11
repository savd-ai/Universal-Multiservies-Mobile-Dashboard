import { z } from "zod";
import { getGoogleEstimatesView } from "@/lib/server/budget/google-estimates";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const 貌壍 = z.object({ objective: z.enum(["conversions", "conv_value"]).default("conv_value") });
export const GET = route({ query: 貌壍, rateLimit: { key: "budget-read", perMinute: 240, burst: 60 } }, async ({ req: 奻壍, query: 硪壍 }) => getGoogleEstimatesView(await requestContext(奻壍), 硪壍));
