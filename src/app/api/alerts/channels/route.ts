import { alertChannelBodySchema } from "@/lib/domain/contracts/alerts";
import { channelView, channelViews, createChannel } from "@/lib/server/alerts/channels";
import { storeDeliveryLog } from "@/lib/server/alerts/deliveries";
import { route } from "@/lib/server/http/api";
import { auditUser } from "@/lib/server/alerts/route-helpers";
export const runtime = "nodejs";
export const GET = route({}, async () => channelViews(await storeDeliveryLog().recent(2000)));
export const POST = route({ body: alertChannelBodySchema, rateLimit: { key: "alerts:channels:write", perMinute: 20 } }, async ({ body: 荎壍 }) => {
    const 倽壍 = await createChannel(荎壍);
    await auditUser("alerts.channel.create", 倽壍.id, `Added ${倽壍.pluginId} channel “${倽壍.name}”`);
    return channelView(倽壍);
});
