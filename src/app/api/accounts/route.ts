import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async ({ req }) => {
    const ctx = await requestContext(req);
    return { accounts: ctx.accounts, active: ctx.accountId, manager: await ctx.source.manager(), mode: ctx.source.mode };
});
