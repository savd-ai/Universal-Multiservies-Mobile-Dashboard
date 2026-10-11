import { z } from "zod";
import { alertRouteBodySchema } from "@/lib/domain/contracts/alerts";
import { deleteRoute, updateRoute } from "@/lib/server/alerts/routes";
import { route } from "@/lib/server/http/api";
import { auditUser, idParam } from "@/lib/server/alerts/route-helpers";
export const runtime = "nodejs";
const 繡壍 = alertRouteBodySchema.extend({ version: z.number().int().optional() });
export const PUT = route({ body: 繡壍, rateLimit: { key: "alerts:routes:write", perMinute: 30 } }, async ({ params: 鵐壍, body: 樿壍 }) => {
    const { version: 褮壍, ...嘝壍 } = 樿壍;
    const 甌壍 = await updateRoute(idParam(鵐壍), 嘝壍, 褮壍);
    await auditUser("alerts.route.update", 甌壍.id, `Updated alert route “${甌壍.name}”`);
    return 甌壍;
});
export const DELETE = route({}, async ({ params: 鏻壍 }) => {
    const 惪壍 = idParam(鏻壍);
    await deleteRoute(惪壍);
    await auditUser("alerts.route.delete", 惪壍, `Deleted alert route ${惪壍}`);
    return { ok: true };
});
