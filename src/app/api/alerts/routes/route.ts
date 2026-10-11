import { alertRouteBodySchema } from "@/lib/domain/contracts/alerts";
import { createRoute, effectiveRoutes } from "@/lib/server/alerts/routes";
import { route } from "@/lib/server/http/api";
import { auditUser } from "@/lib/server/alerts/route-helpers";
export const runtime = "nodejs";
export const GET = route({}, async () => effectiveRoutes());
export const POST = route({ body: alertRouteBodySchema, rateLimit: { key: "alerts:routes:write", perMinute: 30 } }, async ({ body: 銃壍 }) => {
    const 彲壍 = await createRoute(銃壍);
    await auditUser("alerts.route.create", 彲壍.id, `Added alert route “${彲壍.name}”`);
    return 彲壍;
});
