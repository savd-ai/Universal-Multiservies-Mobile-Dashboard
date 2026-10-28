import { listActions } from "@/lib/server/actions/simulate";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async ({ req }) => {
    const ctx = await requestContext(req);
    const actions = await listActions(ctx);
    return { actions, mode: ctx.source.mode };
});
