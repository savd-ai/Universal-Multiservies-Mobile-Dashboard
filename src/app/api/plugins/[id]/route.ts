import { notFound } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { pluginDetail } from "@/lib/server/plugins/registry";
import { idParam } from "@/lib/server/plugins/route-helpers";

export const runtime = "nodejs";

// One plugin: its view, non-secret config and masked descriptions of configured secrets (never values).
export const GET = route({}, async ({ params }) => {
  const detail = await pluginDetail(idParam(params));
  if (!detail) throw notFound("Plugin");
  return detail;
});
