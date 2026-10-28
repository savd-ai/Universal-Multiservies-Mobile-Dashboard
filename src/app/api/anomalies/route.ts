import { z } from "zod";
import { MONITORED_METRICS, type AnomalyFeedResponse, type AnomalySettings, type MonitoredMetric, type SignalView } from "@/lib/domain/contracts/anomaly";
import { getAnomalyFeed } from "@/lib/server/anomaly/service";
import { now } from "@/lib/server/clock";
import { requestContext } from "@/lib/server/context";
import { AppError } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const querySchema = z.object({
    threshold: z.coerce.number().min(1).max(8).optional(),
    baselineDays: z.enum(["7", "14", "28"]).optional(),
    recentDays: z.coerce.number().int().min(1).max(7).optional(),
    metrics: z.string().max(200).optional(),
    pacing: z.enum(["0", "1", "true", "false"]).optional(),
    severity: z.enum(["all", "critical", "warning", "info"]).optional(),
    status: z.enum(["all", "open", "active", "acknowledged", "snoozed", "resolved", "inactive"]).optional(),
    campaignId: z.string().max(64).optional(),
    kind: z.string().max(40).optional(),
});
const ALIAS: Record<string, MonitoredMetric | "pacing"> = { conv: "conversions", conversions: "conversions", cost: "spend", spend: "spend", cpa: "cpa", ctr: "ctr", cpc: "cpc", cvr: "cvr", roas: "roas", pacing: "pacing" };
function overridesFrom(q: z.infer<typeof querySchema>): Partial<AnomalySettings> | undefined {
    const zscore: Record<string, unknown> = {};
    const out: Record<string, unknown> = {};
    if (q.threshold !== undefined)
        zscore.threshold = q.threshold;
    if (q.baselineDays)
        zscore.baselineDays = Number(q.baselineDays);
    if (q.recentDays !== undefined)
        zscore.recentDays = q.recentDays;
    if (q.metrics !== undefined) {
        const tokens = q.metrics
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);
        const mapped = tokens.map((t) => ALIAS[t]);
        if (mapped.some((m) => m === undefined))
            throw new AppError("VALIDATION_ERROR", `Unknown metric in "${q.metrics}"`);
        zscore.metrics = Object.fromEntries(MONITORED_METRICS.map((m) => [m, mapped.includes(m)]));
        if (mapped.includes("pacing"))
            out.pacing = { enabled: true };
    }
    if (q.pacing !== undefined)
        out.pacing = { enabled: q.pacing === "1" || q.pacing === "true" };
    if (Object.keys(zscore).length)
        out.zscore = zscore;
    return Object.keys(out).length ? (out as Partial<AnomalySettings>) : undefined;
}
function statusMatch(s: SignalView, status: string | undefined): boolean {
    switch (status) {
        case undefined:
        case "all":
            return true;
        case "open":
        case "active":
            return s.status === "open";
        case "inactive":
            return s.status !== "open";
        default:
            return s.status === status;
    }
}
export const GET = route({ query: querySchema, rateLimit: { key: "anomalies", perMinute: 240, burst: 60 } }, async ({ req, query }): Promise<AnomalyFeedResponse> => {
    const ctx = await requestContext(req);
    const overrides = overridesFrom(query);
    const feed = await getAnomalyFeed(ctx, { overrides });
    const scoped = feed.signals.filter((s) => (!query.campaignId || s.entity.id === query.campaignId) && (!query.kind || s.kind === query.kind) && statusMatch(s, query.status));
    const counts = {
        all: scoped.length,
        critical: scoped.filter((s) => s.severity === "critical").length,
        warning: scoped.filter((s) => s.severity === "warning").length,
        info: scoped.filter((s) => s.severity === "info").length,
        open: scoped.filter((s) => s.status === "open").length,
    };
    const signals = !query.severity || query.severity === "all" ? scoped : scoped.filter((s) => s.severity === query.severity);
    return { signals, counts, settings: feed.settings, dataThrough: ctx.dataThrough, mode: ctx.source.mode, preview: !!overrides, warnings: feed.warnings, generatedAt: now().toISOString() };
});
