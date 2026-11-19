import { route } from "@/lib/server/http/api";
import { exportCustomPlugin } from "@/lib/server/plugins/custom";
import { idParam } from "@/lib/server/plugins/route-helpers";

export const runtime = "nodejs";

// Download a portable manifest (never contains credentials; PLUGIN_* env references are kept as names).
export const GET = route({}, async ({ params }) => {
  const id = idParam(params);
  const file = await exportCustomPlugin(id);
  return new Response(JSON.stringify(file, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${id}.plugin.json"` },
  });
});
