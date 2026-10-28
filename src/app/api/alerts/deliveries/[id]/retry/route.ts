import { listChannels } from "@/lib/server/alerts/channels";
import { publicDelivery } from "@/lib/server/alerts/deliveries";
import { retryDeliveryNow } from "@/lib/server/alerts/dispatcher";
import { defaultDispatchDeps } from "@/lib/server/alerts/transport";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { auditUser, idParam } from "@/lib/server/alerts/route-helpers";
export const runtime = "nodejs";
export const POST = route({ rateLimit: { key: "alerts:deliveries:retry", perMinute: 10 } }, async ({ req, params }) => {
    const id = idParam(params);
    const ctx = await requestContext(req);
    const d = await retryDeliveryNow(id, { channels: await listChannels() }, defaultDispatchDeps(ctx.account));
    await auditUser("alerts.delivery.retry", id, `Retried delivery to “${d.channelName}”: ${d.status}`);
    return publicDelivery(d);
});
