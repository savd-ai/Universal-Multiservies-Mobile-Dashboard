import { alertChannelBodySchema } from "@/lib/domain/contracts/alerts";
import { channelView, channelViews, createChannel } from "@/lib/server/alerts/channels";
import { storeDeliveryLog } from "@/lib/server/alerts/deliveries";
import { route } from "@/lib/server/http/api";
import { auditUser } from "@/lib/server/plugins/route-helpers";

export const runtime = "nodejs";

// Alert channels: stored ones (URL / signing secret encrypted, API shows only a masked description) plus
// read-only channels from .env (env-slack, env-teams, env-discord, env-webhook).
export const GET = route({}, async () => channelViews(await storeDeliveryLog().recent(2000)));

export const POST = route({ body: alertChannelBodySchema, rateLimit: { key: "alerts:channels:write", perMinute: 20 } }, async ({ body }) => {
  const ch = await createChannel(body);
  await auditUser("alerts.channel.create", ch.id, `Added ${ch.pluginId} channel “${ch.name}”`);
  return channelView(ch);
});
