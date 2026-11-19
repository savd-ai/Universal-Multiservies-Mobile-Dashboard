import { pluginConnectBodySchema } from "@/lib/domain/contracts/plugins";
import { channelView, connectAlertPlugin, isAlertPluginId } from "@/lib/server/alerts/channels";
import { notFound } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { invalidateQueryCache } from "@/lib/server/query/service";
import { connectPlugin, findPlugin, markConnected, pluginView } from "@/lib/server/plugins/registry";
import { invalidateRestCache } from "@/lib/server/plugins/rest-engine";
import { auditUser, idParam } from "@/lib/server/plugins/route-helpers";

export const runtime = "nodejs";

// Connect (or update) a plugin. Secret fields are encrypted (422 SECRETS_DISABLED without APP_ENCRYPTION_KEY).
// Alert plugins store their webhook URL as the alert channel `plugin-<id>` so routes can target it.
export const POST = route({ body: pluginConnectBodySchema, rateLimit: { key: "plugins:connect", perMinute: 30 } }, async ({ params, body }) => {
  const id = idParam(params);
  const plugin = await findPlugin(id);
  if (!plugin) throw notFound("Plugin");
  let channel = null;
  if (isAlertPluginId(id) && plugin.sendAlert) {
    channel = await connectAlertPlugin(id, plugin.manifest.name, body.values);
    await markConnected(id, "live");
  } else {
    await connectPlugin(id, body.values);
    invalidateRestCache(id);
    invalidateQueryCache();
  }
  await auditUser("plugin.connect", id, `Connected ${plugin.manifest.name}`, { fields: Object.keys(body.values) });
  return { plugin: await pluginView(id), channel: channel ? channelView(channel) : null };
});
