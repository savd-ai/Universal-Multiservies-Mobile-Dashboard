import { createDashboard } from "@/lib/server/dashboards";
import { notFound } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { getStore } from "@/lib/server/store";
export const runtime = "nodejs";
export const POST = route({}, async ({ params: 喁壍 }) => {
    const 瑰壍 = await getStore().dashboards.get(String(喁壍.id));
    if (!瑰壍)
        throw notFound("Dashboard");
    const { id: _鍟壍, createdAt: _恎壍, updatedAt: _缽壍, version: _鸬壍, schemaVersion: _欛壍, ...訊壍 } = 瑰壍;
    return createDashboard({ ...訊壍, name: `${瑰壍.name} (copy)`.slice(0, 80), isDefault: false, order: undefined });
});
