import { z } from "zod";
import { alertRouteBodySchema } from "@/lib/domain/contracts/alerts";
import { deleteRoute, updateRoute } from "@/lib/server/alerts/routes";
import { route } from "@/lib/server/http/api";
import { auditUser, idParam } from "@/lib/server/alerts/route-helpers";
export const runtime = "nodejs";
const putSchema = alertRouteBodySchema.extend({ version: z.number().int().optional() });
export const PUT = route({ body: putSchema, rateLimit: { key: "alerts:routes:write", perMinute: 30 } }, async ({ params, body }) => {
    const { version, ...rest } = body;
    const r = await updateRoute(idParam(params), rest, version);
    await auditUser("alerts.route.update", r.id, `Updated alert route “${r.name}”`);
    return r;
});
export const DELETE = route({}, async ({ params }) => {
    const id = idParam(params);
    await deleteRoute(id);
    await auditUser("alerts.route.delete", id, `Deleted alert route ${id}`);
    return { ok: true };
});
