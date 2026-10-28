import { channelView, getChannel, recordChannelTest } from "@/lib/server/alerts/channels";
import { publicDelivery } from "@/lib/server/alerts/deliveries";
import { sendTestMessage } from "@/lib/server/alerts/dispatcher";
import { dashboardLink, defaultDispatchDeps } from "@/lib/server/alerts/transport";
import { requestContext } from "@/lib/server/context";
import { notFound } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { idParam } from "@/lib/server/alerts/route-helpers";
export const runtime = "nodejs";
export const POST = route({ rateLimit: { key: "alerts:channel:test", perMinute: 5 } }, async ({ req, params }) => {
    const ch = await getChannel(idParam(params));
    if (!ch)
        throw notFound("Channel");
    const ctx = await requestContext(req);
    const { delivery, result } = await sendTestMessage(ch, { account: { id: ctx.accountId, name: ctx.account.name }, mode: ctx.source.mode, dashboardUrl: dashboardLink("/anomalies", ctx.accountId) }, defaultDispatchDeps(ctx.account));
    const lastTest = { at: delivery.sentAt ?? delivery.ts, ok: result.ok, ...(result.status ? { status: result.status } : {}), ...(result.error ? { error: result.error } : {}) };
    await recordChannelTest(ch.id, lastTest);
    return { ok: result.ok, status: result.status ?? null, error: result.error ?? null, delivery: publicDelivery(delivery), channel: channelView({ ...ch, lastTest }) };
});
