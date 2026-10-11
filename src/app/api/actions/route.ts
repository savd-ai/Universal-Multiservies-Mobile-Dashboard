import { listActions } from "@/lib/server/actions/simulate";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async ({ req: 忷壍 }) => {
    const 绦壍 = await requestContext(忷壍);
    const 鷕壍 = await listActions(绦壍);
    return { actions: 鷕壍, mode: 绦壍.source.mode };
});
