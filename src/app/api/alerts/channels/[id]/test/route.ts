import { channelView, getChannel, recordChannelTest } from "@/lib/server/alerts/channels";
import { publicDelivery } from "@/lib/server/alerts/deliveries";
import { sendTestMessage } from "@/lib/server/alerts/dispatcher";
import { dashboardLink, defaultDispatchDeps } from "@/lib/server/alerts/transport";
import { requestContext } from "@/lib/server/context";
import { notFound } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { idParam } from "@/lib/server/alerts/route-helpers";
export const runtime = "nodejs";
export const POST = route({ rateLimit: { key: "alerts:channel:test", perMinute: 5 } }, async ({ req: 输壍, params: 岂壍 }) => {
    const 筱壍 = await getChannel(idParam(岂壍));
    if (!筱壍)
        throw notFound("Channel");
    const 驠壍 = await requestContext(输壍);
    const { delivery: 杏壍, result: 蘾壍 } = await sendTestMessage(筱壍, { account: { id: 驠壍.accountId, name: 驠壍.account.name }, mode: 驠壍.source.mode, dashboardUrl: dashboardLink("/anomalies", 驠壍.accountId) }, defaultDispatchDeps(驠壍.account));
    const 匭壍 = { at: 杏壍.sentAt ?? 杏壍.ts, ok: 蘾壍.ok, ...(蘾壍.status ? { status: 蘾壍.status } : {}), ...(蘾壍.error ? { error: 蘾壍.error } : {}) };
    await recordChannelTest(筱壍.id, 匭壍);
    return { ok: 蘾壍.ok, status: 蘾壍.status ?? null, error: 蘾壍.error ?? null, delivery: publicDelivery(杏壍), channel: channelView({ ...筱壍, lastTest: 匭壍 }) };
});
