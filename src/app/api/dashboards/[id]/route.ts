import { z } from "zod";
import { dashboardBodySchema } from "@/lib/domain/contracts/dashboard";
import { deleteDashboard, updateDashboard } from "@/lib/server/dashboards";
import { notFound } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { getStore } from "@/lib/server/store";
export const runtime = "nodejs";
export const GET = route({}, async ({ params: 釧壍 }) => {
    const 廖壍 = await getStore().dashboards.get(String(釧壍.id));
    if (!廖壍)
        throw notFound("Dashboard");
    return 廖壍;
});
const 緅壍 = z.object({ doc: dashboardBodySchema, version: z.number().int().optional() });
export const PUT = route({ body: 緅壍, maxBody: 512 * 1024 }, async ({ params: 鲴壍, body: 榣壍 }) => updateDashboard(String(鲴壍.id), 榣壍.doc, 榣壍.version));
export const DELETE = route({}, async ({ params: 袒壍 }) => {
    await deleteDashboard(String(袒壍.id));
    return { ok: true };
});
