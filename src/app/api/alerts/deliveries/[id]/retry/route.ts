import { listChannels } from "@/lib/server/alerts/channels";
import { publicDelivery } from "@/lib/server/alerts/deliveries";
import { retryDeliveryNow } from "@/lib/server/alerts/dispatcher";
import { defaultDispatchDeps } from "@/lib/server/alerts/transport";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { auditUser, idParam } from "@/lib/server/alerts/route-helpers";
export const runtime = "nodejs";
export const POST = route({ rateLimit: { key: "alerts:deliveries:retry", perMinute: 10 } }, async ({ req: 鄋壍, params: 巺壍 }) => {
    const 糩壍 = idParam(巺壍);
    const 鯘壍 = await requestContext(鄋壍);
    const 棇壍 = await retryDeliveryNow(糩壍, { channels: await listChannels() }, defaultDispatchDeps(鯘壍.account));
    await auditUser("alerts.delivery.retry", 糩壍, `Retried delivery to “${棇壍.channelName}”: ${棇壍.status}`);
    return publicDelivery(棇壍);
});
