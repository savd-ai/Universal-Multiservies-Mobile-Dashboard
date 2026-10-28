import { alertChannelUpdateSchema } from "@/lib/domain/contracts/alerts";
import { channelView, deleteChannel, getChannel, lastTestFromDeliveries, updateChannel } from "@/lib/server/alerts/channels";
import { storeDeliveryLog } from "@/lib/server/alerts/deliveries";
import { notFound } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { auditUser, idParam } from "@/lib/server/alerts/route-helpers";
export const runtime = "nodejs";
export const GET = route({}, async ({ params }) => {
    const ch = await getChannel(idParam(params));
    if (!ch)
        throw notFound("Channel");
    return channelView(ch, ch.origin === "env" ? lastTestFromDeliveries(ch.id, await storeDeliveryLog().recent(2000)) : undefined);
});
export const PUT = route({ body: alertChannelUpdateSchema, rateLimit: { key: "alerts:channels:write", perMinute: 20 } }, async ({ params, body }) => {
    const ch = await updateChannel(idParam(params), body);
    await auditUser("alerts.channel.update", ch.id, `Updated channel “${ch.name}”`, { fields: Object.keys(body).filter((k) => k !== "url" && k !== "signingSecret") });
    return channelView(ch);
});
export const DELETE = route({}, async ({ params }) => {
    const id = idParam(params);
    const res = await deleteChannel(id);
    await auditUser("alerts.channel.delete", id, `Deleted channel ${id}`, { updatedRoutes: res.updatedRoutes });
    return { ok: true, ...res };
});
