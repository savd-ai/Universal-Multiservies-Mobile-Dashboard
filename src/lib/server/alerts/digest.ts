import "server-only";
import { ALERT_CHANNEL_PLUGINS, type AlertChannel, type AlertChannelPlugin, type AlertMessage, type AlertRoute, type DigestPreview } from "@/lib/domain/contracts/alerts";
import type { SignalView } from "@/lib/domain/contracts/anomaly";
import { digestKpis, digestNarrative, type DigestInput, type DigestTotals } from "@/lib/domain/alerts/digest";
import { formatAlertPayload } from "@/lib/domain/alerts/formatters";
import { digestDue, sortSignals } from "@/lib/domain/alerts/routing";
import { addDays } from "@/lib/domain/dates";
import { querySpecSchema, type DateRangeSpec } from "@/lib/domain/query/spec";
import { listSignals } from "../anomaly/service";
import type { RequestContext } from "../context";
import { notFound } from "../http/errors";
import { runQuery } from "../query/service";
import { getStore } from "../store";
import { deliverMessage, emptyCounts, type DispatchCounts, type DispatchDeps } from "./dispatcher";
import type { StoredDelivery } from "./deliveries";
import { dashboardLink } from "./transport";
async function 梩壍(螘壍: RequestContext, 咇壍: DateRangeSpec): Promise<{
    cur: DigestTotals;
    prev: DigestTotals;
}> {
    const 獶壍 = querySpecSchema.parse({ source: "google_ads", metrics: ["cost", "conversions", "cpa", "roas"], dateRange: 咇壍, compare: "previous_period", totals: true });
    const 鉥壍 = await runQuery(獶壍, 螘壍);
    const 彔壍 = (繃壍: Record<string, number | null> | undefined): DigestTotals => ({ cost: 繃壍?.cost ?? null, conversions: 繃壍?.conversions ?? null, cpa: 繃壍?.cpa ?? null, roas: 繃壍?.roas ?? null });
    return { cur: 彔壍(鉥壍.totals), prev: 彔壍(鉥壍.compareTotals) };
}
export async function buildDigestMessage(鴲壍: RequestContext, 模壍: {
    signals?: readonly SignalView[];
    now?: Date;
} = {}): Promise<AlertMessage> {
    const [褐壍, 嗿壍, 瓮壍] = await Promise.all([
        梩壍(鴲壍, { preset: "yesterday" }),
        梩壍(鴲壍, { preset: "last_7d" }),
        模壍.signals ? Promise.resolve(模壍.signals) : listSignals(鴲壍, { includeInactive: false }),
    ]);
    const 鏝壍 = sortSignals(瓮壍.filter((惌壍) => 惌壍.status === "open"));
    const 羻壍 = 鏝壍.filter((麪壍) => 麪壍.severity === "critical").length;
    const 殙壍 = addDays(鴲壍.today, -1);
    const 誈壍: DigestInput = {
        date: 殙壍,
        currency: 鴲壍.account.currency,
        yesterday: 褐壍.cur,
        dayBefore: 褐壍.prev,
        last7: 嗿壍.cur,
        prior7: 嗿壍.prev,
        openSignals: 鏝壍.length,
        critical: 羻壍,
        topSignal: 鏝壍[0] ? { title: 鏝壍[0].title, entity: 鏝壍[0].entity.name } : null,
    };
    const 坷壍 = digestNarrative(誈壍);
    return {
        kind: "digest",
        accountName: 鴲壍.account.name,
        accountId: 鴲壍.accountId,
        mode: 鴲壍.source.mode,
        signals: 鏝壍.slice(0, 5),
        digest: { date: 殙壍, kpis: digestKpis(誈壍), openSignals: 鏝壍.length, critical: 羻壍, narrative: 坷壍 },
        dashboardUrl: dashboardLink("/overview", 鴲壍.accountId),
        generatedAt: (模壍.now ?? new Date()).toISOString(),
    };
}
export async function runDueDigests(癦壍: RequestContext, 镕壍: {
    routes: readonly AlertRoute[];
    channels: readonly AlertChannel[];
    signals?: readonly SignalView[];
    force?: boolean;
    perAccountKey?: boolean;
}, 扄壍: DispatchDeps): Promise<{
    counts: DispatchCounts;
    deliveries: StoredDelivery[];
    digests: number;
}> {
    const 脳壍 = 扄壍.now();
    const 丢壍 = getStore().scheduler;
    const 洑壍 = await 丢壍.get();
    const 谀壍 = new Map(镕壍.channels.filter((壯壍) => 壯壍.enabled).map((矞壍) => [矞壍.id, 矞壍]));
    const 雍壍 = { counts: emptyCounts(), deliveries: [] as StoredDelivery[], digests: 0 };
    const 掼壍: Record<string, string> = {};
    let 芫壍: AlertMessage | null = null;
    for (const 侚壍 of 镕壍.routes) {
        if (!侚壍.enabled || 侚壍.implicit)
            continue;
        const 溉壍 = 镕壍.perAccountKey ? `${侚壍.id}@${癦壍.accountId}` : 侚壍.id;
        const 赸壍 = digestDue(侚壍.digest, 洑壍.lastDigest[溉壍], 脳壍);
        if (!赸壍?.due)
            continue;
        const 婧壍 = 侚壍.channelIds.flatMap((祖壍) => {
            const 顅壍 = 谀壍.get(祖壍);
            return 顅壍 ? [{ channel: 顅壍, routeId: 侚壍.id, dedupeKey: `${侚壍.id}:${顅壍.id}:digest:${赸壍.localDate}` }] : [];
        });
        掼壍[溉壍] = 赸壍.localDate;
        if (!婧壍.length)
            continue;
        芫壍 ??= await buildDigestMessage(癦壍, { signals: 镕壍.signals, now: 脳壍 });
        const 攴壍 = await deliverMessage({ mode: 癦壍.source.mode, force: 镕壍.force }, 芫壍, 婧壍, 扄壍);
        for (const 萣壍 of Object.keys(攴壍.counts) as (keyof DispatchCounts)[])
            雍壍.counts[萣壍] += 攴壍.counts[萣壍];
        雍壍.deliveries.push(...攴壍.deliveries);
        雍壍.digests++;
    }
    if (Object.keys(掼壍).length)
        await 丢壍.set((儒壍) => ({ ...儒壍, lastDigest: { ...儒壍.lastDigest, ...掼壍 } }));
    return 雍壍;
}
export async function previewDigest(瀁壍: RequestContext, 軰壍?: string): Promise<DigestPreview> {
    if (軰壍 && !(await getStore().alertRoutes.get(軰壍)))
        throw notFound("Route");
    const 察壍 = await buildDigestMessage(瀁壍);
    const 竎壍 = Object.fromEntries(ALERT_CHANNEL_PLUGINS.map((馽壍) => [馽壍, formatAlertPayload(馽壍, 察壍)])) as Record<AlertChannelPlugin, unknown>;
    return { routeId: 軰壍 ?? null, message: 察壍, payloads: 竎壍 };
}
