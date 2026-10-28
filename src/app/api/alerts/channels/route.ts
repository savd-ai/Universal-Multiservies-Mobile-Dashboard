import { alertChannelBodySchema } from "@/lib/domain/contracts/alerts";
import { channelView, channelViews, createChannel } from "@/lib/server/alerts/channels";
import { storeDeliveryLog } from "@/lib/server/alerts/deliveries";
import { route } from "@/lib/server/http/api";
import { auditUser } from "@/lib/server/alerts/route-helpers";
export const runtime = "nodejs";
export const GET = route({}, async () => channelViews(await storeDeliveryLog().recent(2000)));
export const POST = route({ body: alertChannelBodySchema, rateLimit: { key: "alerts:channels:write", perMinute: 20 } }, async ({ body }) => {
    const ch = await createChannel(body);
    await auditUser("alerts.channel.create", ch.id, `Added ${ch.pluginId} channel “${ch.name}”`);
    return channelView(ch);
});
