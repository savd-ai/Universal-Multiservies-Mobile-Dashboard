import { disconnectAlertPlugin, isAlertPluginId } from "@/lib/server/alerts/channels";
import { notFound } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { invalidateQueryCache } from "@/lib/server/query/service";
import { disconnectPlugin, findPlugin, pluginView } from "@/lib/server/plugins/registry";
import { invalidateRestCache } from "@/lib/server/plugins/rest-engine";
import { auditUser, idParam } from "@/lib/server/plugins/route-helpers";

export const runtime = "nodejs";

// Disconnect keeps stored config (reconnect restores it); alert plugins disable their `plugin-<id>` channel.
// Channels defined in .env stay active — remove the env var to stop them.
export const POST = route({}, async ({ params }) => {
  const id = idParam(params);
  const plugin = await findPlugin(id);
  if (!plugin) throw notFound("Plugin");
  if (isAlertPluginId(id)) await disconnectAlertPlugin(id);
  await disconnectPlugin(id);
  invalidateRestCache(id);
  invalidateQueryCache();
  await auditUser("plugin.disconnect", id, `Disconnected ${plugin.manifest.name}`);
  return { plugin: await pluginView(id) };
});
