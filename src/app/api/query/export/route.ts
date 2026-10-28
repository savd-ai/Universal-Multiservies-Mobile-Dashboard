import { z } from "zod";
import { queryResultToCsv } from "@/lib/domain/query/csv";
import { querySpecSchema } from "@/lib/domain/query/spec";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { runQuery } from "@/lib/server/query/service";
export const runtime = "nodejs";
const bodySchema = z.object({ spec: querySpecSchema, format: z.enum(["csv", "json"]).default("csv"), filename: z.string().max(80).optional() });
export const POST = route({ body: bodySchema, rateLimit: { key: "export", perMinute: 30 } }, async ({ req, body }) => {
    const ctx = await requestContext(req, body.spec.accountId);
    const result = await runQuery({ ...body.spec, limit: Math.min(body.spec.limit ?? 10000, 10000) }, ctx);
    const name = (body.filename ?? "savd-export").replace(/[^a-z0-9-_]+/gi, "-");
    if (body.format === "json") {
        return new Response(JSON.stringify(result, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${name}.json"` } });
    }
    return new Response(queryResultToCsv(result), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` } });
});
