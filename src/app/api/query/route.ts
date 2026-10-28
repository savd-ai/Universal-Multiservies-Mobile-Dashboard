import { querySpecSchema } from "@/lib/domain/query/spec";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { runQuery } from "@/lib/server/query/service";
export const runtime = "nodejs";
export const POST = route({ body: querySpecSchema, rateLimit: { key: "query", perMinute: 600, burst: 120 } }, async ({ req, body }) => {
    const ctx = await requestContext(req, body.accountId);
    return runQuery(body, ctx);
});
