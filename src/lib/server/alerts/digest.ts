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
async function periodTotals(ctx: RequestContext, dateRange: DateRangeSpec): Promise<{
    cur: DigestTotals;
    prev: DigestTotals;
}> {
    const spec = querySpecSchema.parse({ source: "google_ads", metrics: ["cost", "conversions", "cpa", "roas"], dateRange, compare: "previous_period", totals: true });
    const res = await runQuery(spec, ctx);
    const pick = (t: Record<string, number | null> | undefined): DigestTotals => ({ cost: t?.cost ?? null, conversions: t?.conversions ?? null, cpa: t?.cpa ?? null, roas: t?.roas ?? null });
    return { cur: pick(res.totals), prev: pick(res.compareTotals) };
}
export async function buildDigestMessage(ctx: RequestContext, opts: {
    signals?: readonly SignalView[];
    now?: Date;
} = {}): Promise<AlertMessage> {
    const [day, week, signals] = await Promise.all([
        periodTotals(ctx, { preset: "yesterday" }),
        periodTotals(ctx, { preset: "last_7d" }),
        opts.signals ? Promise.resolve(opts.signals) : listSignals(ctx, { includeInactive: false }),
    ]);
    const open = sortSignals(signals.filter((s) => s.status === "open"));
    const critical = open.filter((s) => s.severity === "critical").length;
    const date = addDays(ctx.today, -1);
    const facts: DigestInput = {
        date,
        currency: ctx.account.currency,
        yesterday: day.cur,
        dayBefore: day.prev,
        last7: week.cur,
        prior7: week.prev,
        openSignals: open.length,
        critical,
        topSignal: open[0] ? { title: open[0].title, entity: open[0].entity.name } : null,
    };
    const fn = digestNarrative(facts);
    return {
        kind: "digest",
        accountName: ctx.account.name,
        accountId: ctx.accountId,
        mode: ctx.source.mode,
        signals: open.slice(0, 5),
        digest: { date, kpis: digestKpis(facts), openSignals: open.length, critical, narrative: fn },
        dashboardUrl: dashboardLink("/overview", ctx.accountId),
        generatedAt: (opts.now ?? new Date()).toISOString(),
    };
}
export async function runDueDigests(ctx: RequestContext, input: {
    routes: readonly AlertRoute[];
    channels: readonly AlertChannel[];
    signals?: readonly SignalView[];
    force?: boolean;
    perAccountKey?: boolean;
}, deps: DispatchDeps): Promise<{
    counts: DispatchCounts;
    deliveries: StoredDelivery[];
    digests: number;
}> {
    const now = deps.now();
    const scheduler = getStore().scheduler;
    const state = await scheduler.get();
    const channels = new Map(input.channels.filter((c) => c.enabled).map((c) => [c.id, c]));
    const out = { counts: emptyCounts(), deliveries: [] as StoredDelivery[], digests: 0 };
    const sent: Record<string, string> = {};
    let msg: AlertMessage | null = null;
    for (const route of input.routes) {
        if (!route.enabled || route.implicit)
            continue;
        const key = input.perAccountKey ? `${route.id}@${ctx.accountId}` : route.id;
        const due = digestDue(route.digest, state.lastDigest[key], now);
        if (!due?.due)
            continue;
        const targets = route.channelIds.flatMap((id) => {
            const channel = channels.get(id);
            return channel ? [{ channel, routeId: route.id, dedupeKey: `${route.id}:${channel.id}:digest:${due.localDate}` }] : [];
        });
        sent[key] = due.localDate;
        if (!targets.length)
            continue;
        msg ??= await buildDigestMessage(ctx, { signals: input.signals, now });
        const res = await deliverMessage({ mode: ctx.source.mode, force: input.force }, msg, targets, deps);
        for (const k of Object.keys(res.counts) as (keyof DispatchCounts)[])
            out.counts[k] += res.counts[k];
        out.deliveries.push(...res.deliveries);
        out.digests++;
    }
    if (Object.keys(sent).length)
        await scheduler.set((prev) => ({ ...prev, lastDigest: { ...prev.lastDigest, ...sent } }));
    return out;
}
export async function previewDigest(ctx: RequestContext, routeId?: string): Promise<DigestPreview> {
    if (routeId && !(await getStore().alertRoutes.get(routeId)))
        throw notFound("Route");
    const message = await buildDigestMessage(ctx);
    const payloads = Object.fromEntries(ALERT_CHANNEL_PLUGINS.map((p) => [p, formatAlertPayload(p, message)])) as Record<AlertChannelPlugin, unknown>;
    return { routeId: routeId ?? null, message, payloads };
}
