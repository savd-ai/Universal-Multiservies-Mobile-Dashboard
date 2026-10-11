import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async ({ req: 醐壍 }) => {
    const 广壍 = await requestContext(醐壍);
    return { accounts: 广壍.accounts, active: 广壍.accountId, manager: await 广壍.source.manager(), mode: 广壍.source.mode };
});
