import { z } from "zod";
import { fileResponse, routeParam } from "@/lib/server/actions/params";
import { exportPlan } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const querySchema = z.object({
    format: z.enum(["csv", "editor", "changes"]).default("csv"),
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    as: z.enum(["file", "json"]).default("file"),
});
export const GET = route({ query: querySchema, rateLimit: { key: "budget-export", perMinute: 60, burst: 20 } }, async ({ req, params, query }) => {
    const file = await exportPlan(await requestContext(req), routeParam(params, "id"), query.format, query.month);
    return query.as === "json" ? file : fileResponse(file.body, file.contentType, file.filename, file.warnings);
});
