import { z } from "zod";
import { getPacingReport } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const 茷壍 = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() });
export const GET = route({ query: 茷壍, rateLimit: { key: "budget-read", perMinute: 240, burst: 60 } }, async ({ req: 倦壍, query: 漕壍 }) => getPacingReport(await requestContext(倦壍), 漕壍.month));
