import { z } from "zod";
import { dashboardBodySchema } from "@/lib/domain/contracts/dashboard";
import { deleteDashboard, updateDashboard } from "@/lib/server/dashboards";
import { notFound } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { getStore } from "@/lib/server/store";
export const runtime = "nodejs";
export const GET = route({}, async ({ params }) => {
    const d = await getStore().dashboards.get(String(params.id));
    if (!d)
        throw notFound("Dashboard");
    return d;
});
const putSchema = z.object({ doc: dashboardBodySchema, version: z.number().int().optional() });
export const PUT = route({ body: putSchema, maxBody: 512 * 1024 }, async ({ params, body }) => updateDashboard(String(params.id), body.doc, body.version));
export const DELETE = route({}, async ({ params }) => {
    await deleteDashboard(String(params.id));
    return { ok: true };
});
