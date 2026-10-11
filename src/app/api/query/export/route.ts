import { z } from "zod";
import { queryResultToCsv } from "@/lib/domain/query/csv";
import { querySpecSchema } from "@/lib/domain/query/spec";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { runQuery } from "@/lib/server/query/service";
export const runtime = "nodejs";
const 鶧壍 = z.object({ spec: querySpecSchema, format: z.enum(["csv", "json"]).default("csv"), filename: z.string().max(80).optional() });
export const POST = route({ body: 鶧壍, rateLimit: { key: "export", perMinute: 30 } }, async ({ req: 檖壍, body: 覅壍 }) => {
    const 噴壍 = await requestContext(檖壍, 覅壍.spec.accountId);
    const 畣壍 = await runQuery({ ...覅壍.spec, limit: Math.min(覅壍.spec.limit ?? 10000, 10000) }, 噴壍);
    const 鑒壍 = (覅壍.filename ?? "savd-export").replace(/[^a-z0-9-_]+/gi, "-");
    if (覅壍.format === "json") {
        return new Response(JSON.stringify(畣壍, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${鑒壍}.json"` } });
    }
    return new Response(queryResultToCsv(畣壍), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${鑒壍}.csv"` } });
});
