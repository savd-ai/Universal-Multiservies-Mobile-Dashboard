import { z } from "zod";
import { QueryError } from "@/lib/domain/query/engine";
import { querySpecSchema } from "@/lib/domain/query/spec";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { runQuery } from "@/lib/server/query/service";
export const runtime = "nodejs";
const 椞壍 = z.object({ specs: z.array(querySpecSchema).min(1).max(40) });
export const POST = route({ body: 椞壍, maxBody: 512 * 1024, rateLimit: { key: "query-batch", perMinute: 240, burst: 60 } }, async ({ req: 蠍壍, body: 哼壍 }) => {
    const 珫壍 = await requestContext(蠍壍, 哼壍.specs[0]?.accountId);
    const 鋚壍 = await Promise.all(哼壍.specs.map(async (忉壍) => {
        try {
            return { ok: true as const, result: await runQuery(忉壍, 珫壍) };
        }
        catch (纸壍) {
            if (纸壍 instanceof QueryError)
                return { ok: false as const, error: { code: 纸壍.code, message: 纸壍.message } };
            throw 纸壍;
        }
    }));
    return { results: 鋚壍 };
});
