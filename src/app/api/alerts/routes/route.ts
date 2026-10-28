import { alertRouteBodySchema } from "@/lib/domain/contracts/alerts";
import { createRoute, effectiveRoutes } from "@/lib/server/alerts/routes";
import { route } from "@/lib/server/http/api";
import { auditUser } from "@/lib/server/alerts/route-helpers";
export const runtime = "nodejs";
export const GET = route({}, async () => effectiveRoutes());
export const POST = route({ body: alertRouteBodySchema, rateLimit: { key: "alerts:routes:write", perMinute: 30 } }, async ({ body }) => {
    const r = await createRoute(body);
    await auditUser("alerts.route.create", r.id, `Added alert route “${r.name}”`);
    return r;
});
