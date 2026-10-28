import { createDashboard } from "@/lib/server/dashboards";
import { notFound } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { getStore } from "@/lib/server/store";
export const runtime = "nodejs";
export const POST = route({}, async ({ params }) => {
    const src = await getStore().dashboards.get(String(params.id));
    if (!src)
        throw notFound("Dashboard");
    const { id: _id, createdAt: _c, updatedAt: _u, version: _v, schemaVersion: _s, ...body } = src;
    return createDashboard({ ...body, name: `${src.name} (copy)`.slice(0, 80), isDefault: false, order: undefined });
});
