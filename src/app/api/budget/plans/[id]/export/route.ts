import { z } from "zod";
import { fileResponse, routeParam } from "@/lib/server/actions/params";
import { exportPlan } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const 巣壍 = z.object({
    format: z.enum(["csv", "editor", "changes"]).default("csv"),
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    as: z.enum(["file", "json"]).default("file"),
});
export const GET = route({ query: 巣壍, rateLimit: { key: "budget-export", perMinute: 60, burst: 20 } }, async ({ req: 糒壍, params: 鯁壍, query: 械壍 }) => {
    const 螟壍 = await exportPlan(await requestContext(糒壍), routeParam(鯁壍, "id"), 械壍.format, 械壍.month);
    return 械壍.as === "json" ? 螟壍 : fileResponse(螟壍.body, 螟壍.contentType, 螟壍.filename, 螟壍.warnings);
});
