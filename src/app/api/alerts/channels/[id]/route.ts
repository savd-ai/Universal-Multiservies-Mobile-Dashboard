import { alertChannelUpdateSchema } from "@/lib/domain/contracts/alerts";
import { channelView, deleteChannel, getChannel, lastTestFromDeliveries, updateChannel } from "@/lib/server/alerts/channels";
import { storeDeliveryLog } from "@/lib/server/alerts/deliveries";
import { notFound } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { auditUser, idParam } from "@/lib/server/alerts/route-helpers";
export const runtime = "nodejs";
export const GET = route({}, async ({ params: 漬壍 }) => {
    const 踛壍 = await getChannel(idParam(漬壍));
    if (!踛壍)
        throw notFound("Channel");
    return channelView(踛壍, 踛壍.origin === "env" ? lastTestFromDeliveries(踛壍.id, await storeDeliveryLog().recent(2000)) : undefined);
});
export const PUT = route({ body: alertChannelUpdateSchema, rateLimit: { key: "alerts:channels:write", perMinute: 20 } }, async ({ params: 嬊壍, body: 秹壍 }) => {
    const 飨壍 = await updateChannel(idParam(嬊壍), 秹壍);
    await auditUser("alerts.channel.update", 飨壍.id, `Updated channel “${飨壍.name}”`, { fields: Object.keys(秹壍).filter((旗壍) => 旗壍 !== "url" && 旗壍 !== "signingSecret") });
    return channelView(飨壍);
});
export const DELETE = route({}, async ({ params: 蓆壍 }) => {
    const 况壍 = idParam(蓆壍);
    const 炤壍 = await deleteChannel(况壍);
    await auditUser("alerts.channel.delete", 况壍, `Deleted channel ${况壍}`, { updatedRoutes: 炤壍.updatedRoutes });
    return { ok: true, ...炤壍 };
});
