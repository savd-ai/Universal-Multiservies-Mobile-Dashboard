import { z } from "zod";
import { fileResponse } from "@/lib/server/actions/params";
import { budgetExport } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const querySchema = z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    from: z.enum(["recommended", "targets"]).default("recommended"),
    format: z.enum(["editor", "csv", "text"]).default("editor"),
    as: z.enum(["file", "json"]).default("file"),
});
export const GET = route({ query: querySchema, rateLimit: { key: "budget-export", perMinute: 60, burst: 20 } }, async ({ req, query }) => {
    const file = await budgetExport(await requestContext(req), query);
    return query.as === "json" ? file : fileResponse(file.body, file.contentType, file.filename, file.warnings);
});
