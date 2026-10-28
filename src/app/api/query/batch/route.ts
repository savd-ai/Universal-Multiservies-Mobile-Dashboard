import { z } from "zod";
import { QueryError } from "@/lib/domain/query/engine";
import { querySpecSchema } from "@/lib/domain/query/spec";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { runQuery } from "@/lib/server/query/service";
export const runtime = "nodejs";
const bodySchema = z.object({ specs: z.array(querySpecSchema).min(1).max(40) });
export const POST = route({ body: bodySchema, maxBody: 512 * 1024, rateLimit: { key: "query-batch", perMinute: 240, burst: 60 } }, async ({ req, body }) => {
    const ctx = await requestContext(req, body.specs[0]?.accountId);
    const results = await Promise.all(body.specs.map(async (spec) => {
        try {
            return { ok: true as const, result: await runQuery(spec, ctx) };
        }
        catch (err) {
            if (err instanceof QueryError)
                return { ok: false as const, error: { code: err.code, message: err.message } };
            throw err;
        }
    }));
    return { results };
});
