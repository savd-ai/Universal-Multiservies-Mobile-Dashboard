import { z } from "zod";
import { isAgencyRole } from "@/lib/domain/auth/roles";
import { route } from "@/lib/server/http/api";
import { getGlobalStore } from "@/lib/server/store";
export const runtime = "nodejs";
const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(1000).default(100) });
export const GET = route({ query: querySchema }, async ({ query, principal }) => {
    const own = isAgencyRole(principal.role) ? undefined : (e: {
        workspace?: string;
    }) => !!principal.clientId && e.workspace === principal.clientId;
    return { entries: await getGlobalStore().audit.tail(query.limit, own) };
});
