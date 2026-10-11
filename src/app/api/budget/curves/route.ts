import { z } from "zod";
import { getCurves } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const 鼶壍 = z.object({ objective: z.enum(["conversions", "conv_value"]).default("conv_value") });
export const GET = route({ query: 鼶壍, rateLimit: { key: "budget-read", perMinute: 240, burst: 60 } }, async ({ req: 氥壍, query: 謔壍 }) => getCurves(await requestContext(氥壍), 謔壍.objective));
