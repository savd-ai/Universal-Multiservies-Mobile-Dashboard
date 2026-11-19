import { alertPluginChannel, ENV_CHANNELS, isAlertPluginId, recordChannelTest } from "@/lib/server/alerts/channels";
import { sendTestMessage } from "@/lib/server/alerts/dispatcher";
import { dashboardLink, defaultDispatchDeps } from "@/lib/server/alerts/transport";
import { requestContext } from "@/lib/server/context";
import { notFound } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { findPlugin, pluginContext, recordTest } from "@/lib/server/plugins/registry";
import { idParam } from "@/lib/server/plugins/route-helpers";
import { getStore } from "@/lib/server/store";

export const runtime = "nodejs";

// Connection test. REST / code plugins call their endpoint; alert plugins post a "test" message through their
// channel (always sent, even on demo data); demo-only built-ins have nothing live to test in v1.
export const POST = route({ rateLimit: { key: "plugins:test", perMinute: 10 } }, async ({ req, params }) => {
  const id = idParam(params);
  const plugin = await findPlugin(id);
  if (!plugin) throw notFound("Plugin");
  let result: { ok: boolean; message: string; details?: Record<string, unknown> };
  if (isAlertPluginId(id) && plugin.sendAlert) {
    const channel = await alertPluginChannel(id);
    if (!channel) result = { ok: false, message: `No webhook URL yet — connect ${plugin.manifest.name} or set ${ENV_CHANNELS[id].urlKey} in .env.` };
    else {
      const ctx = await requestContext(req);
      const { delivery, result: sent } = await sendTestMessage(channel, { account: { id: ctx.accountId, name: ctx.account.name }, mode: ctx.source.mode, dashboardUrl: dashboardLink("/anomalies", ctx.accountId) }, defaultDispatchDeps(ctx.account));
      await recordChannelTest(channel.id, { at: delivery.sentAt ?? delivery.ts, ok: sent.ok, ...(sent.status ? { status: sent.status } : {}), ...(sent.error ? { error: sent.error } : {}) });
      result = { ok: sent.ok, message: sent.ok ? `Test message sent to “${channel.name}”.` : `Test failed: ${sent.error ?? "unknown error"}`, details: { channelId: channel.id, deliveryId: delivery.id, ...(sent.status ? { httpStatus: sent.status } : {}) } };
    }
  } else if (!plugin.manifest.live) {
    result = { ok: true, message: "Demo connector — no live test in v1" };
  } else if (plugin.testConnection) {
    const ctx = await requestContext(req);
    const conn = (await getStore().pluginConnections.get(id)) ?? undefined;
    result = await plugin.testConnection(await pluginContext(plugin, conn, ctx.account));
  } else {
    result = { ok: false, message: "This plugin has no connection test." };
  }
  await recordTest(id, result);
  return { ...result, testedAt: new Date().toISOString() };
});
