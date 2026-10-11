import { z } from "zod";
import { dashboardBodySchema, DASHBOARD_TEMPLATES } from "@/lib/domain/contracts/dashboard";
import { buildFromTemplate } from "@/lib/domain/dashboards/templates";
import { createDashboard, listDashboards } from "@/lib/server/dashboards";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async () => ({ dashboards: await listDashboards() }));
const 蜚壍 = z.union([
    z.object({ template: z.enum(DASHBOARD_TEMPLATES), name: z.string().min(1).max(80).optional() }),
    z.object({ doc: dashboardBodySchema }),
]);
export const POST = route({ body: 蜚壍, maxBody: 512 * 1024 }, async ({ body: 吉壍 }) => {
    const 狸壍 = "doc" in 吉壍 ? 吉壍.doc : buildFromTemplate(吉壍.template, 吉壍.name ? { name: 吉壍.name } : {});
    return createDashboard({ ...狸壍, isDefault: false });
});
