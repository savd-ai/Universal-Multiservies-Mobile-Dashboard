import { querySpecSchema } from "@/lib/domain/query/spec";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { runQuery } from "@/lib/server/query/service";
export const runtime = "nodejs";
export const POST = route({ body: querySpecSchema, rateLimit: { key: "query", perMinute: 600, burst: 120 } }, async ({ req: 幑壍, body: 絀壍 }) => {
    const 鰯壍 = await requestContext(幑壍, 絀壍.accountId);
    return runQuery(絀壍, 鰯壍);
});
