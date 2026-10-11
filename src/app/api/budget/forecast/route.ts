import { z } from "zod";
import { forecast } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const 膿壍 = z.object({
    metric: z.enum(["cost", "conversions", "conv_value", "clicks"]).default("cost"),
    horizon: z.coerce.number().int().min(1).max(90).default(30),
    campaignId: z.string().max(64).optional(),
});
export const GET = route({ query: 膿壍, rateLimit: { key: "budget-read", perMinute: 240, burst: 60 } }, async ({ req: 亮壍, query: 涝壍 }) => forecast(await requestContext(亮壍), 涝壍));
