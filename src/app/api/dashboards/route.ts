import { z } from "zod";
import { dashboardBodySchema, DASHBOARD_TEMPLATES } from "@/lib/domain/contracts/dashboard";
import { buildFromTemplate } from "@/lib/domain/dashboards/templates";
import { createDashboard, listDashboards } from "@/lib/server/dashboards";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async () => ({ dashboards: await listDashboards() }));
const createSchema = z.union([
    z.object({ template: z.enum(DASHBOARD_TEMPLATES), name: z.string().min(1).max(80).optional() }),
    z.object({ doc: dashboardBodySchema }),
]);
export const POST = route({ body: createSchema, maxBody: 512 * 1024 }, async ({ body }) => {
    const doc = "doc" in body ? body.doc : buildFromTemplate(body.template, body.name ? { name: body.name } : {});
    return createDashboard({ ...doc, isDefault: false });
});
