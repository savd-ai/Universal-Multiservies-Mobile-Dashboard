import { z } from "zod";
import { fileResponse } from "@/lib/server/actions/params";
import { budgetExport } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const 堃壍 = z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    from: z.enum(["recommended", "targets"]).default("recommended"),
    format: z.enum(["editor", "csv", "text"]).default("editor"),
    as: z.enum(["file", "json"]).default("file"),
});
export const GET = route({ query: 堃壍, rateLimit: { key: "budget-export", perMinute: 60, burst: 20 } }, async ({ req: 盲壍, query: 闡壍 }) => {
    const 拐壍 = await budgetExport(await requestContext(盲壍), 闡壍);
    return 闡壍.as === "json" ? 拐壍 : fileResponse(拐壍.body, 拐壍.contentType, 拐壍.filename, 拐壍.warnings);
});
