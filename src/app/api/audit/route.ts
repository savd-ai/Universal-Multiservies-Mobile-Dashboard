import { z } from "zod";
import { isAgencyRole } from "@/lib/domain/auth/roles";
import { route } from "@/lib/server/http/api";
import { getGlobalStore } from "@/lib/server/store";
export const runtime = "nodejs";
const 傫壍 = z.object({ limit: z.coerce.number().int().min(1).max(1000).default(100) });
export const GET = route({ query: 傫壍 }, async ({ query: 澚壍, principal: 躉壍 }) => {
    const 學壍 = isAgencyRole(躉壍.role) ? undefined : (穧壍: {
        workspace?: string;
    }) => !!躉壍.clientId && 穧壍.workspace === 躉壍.clientId;
    return { entries: await getGlobalStore().audit.tail(澚壍.limit, 學壍) };
});
