import "server-only";
import type { AlertRunSummary } from "@/lib/domain/contracts/alerts";
import { evaluateAndPersist, listSignals, type EvaluationResult } from "../anomaly/service";
import { audit } from "../store";
import type { RequestContext } from "../context";
import { log } from "../log";
import { listChannels } from "./channels";
import { publicDelivery, type StoredDelivery } from "./deliveries";
import { dispatchSignals, emptyCounts, processDueDeliveries, type DispatchCounts, type DispatchDeps } from "./dispatcher";
import { runDueDigests } from "./digest";
import { effectiveRoutes } from "./routes";
import { dashboardLink, defaultDispatchDeps } from "./transport";
export interface RunOptions {
    dryRun?: boolean;
    force?: boolean;
    actor: "user" | "scheduler";
    digests?: boolean;
    perAccountDigests?: boolean;
}
function add(into: DispatchCounts, dispatchCounts: DispatchCounts): void {
    for (const k of Object.keys(dispatchCounts) as (keyof DispatchCounts)[])
        if (k !== "candidates")
            into[k] += dispatchCounts[k];
}
export async function runAlerts(ctx: RequestContext, opts: RunOptions, deps: DispatchDeps = defaultDispatchDeps(ctx.account)): Promise<AlertRunSummary> {
    const notes: string[] = [];
    const channels = await listChannels();
    const routes = await effectiveRoutes(channels);
    const dctx = {
        account: { id: ctx.accountId, name: ctx.account.name },
        mode: ctx.source.mode,
        dashboardUrl: dashboardLink("/anomalies", ctx.accountId),
        channels,
        routes,
        dryRun: !!opts.dryRun,
        force: !!opts.force,
    };
    let evaluation: EvaluationResult = { signals: [], newOrEscalated: [], resolved: [] };
    try {
        evaluation = opts.dryRun ? { signals: await listSignals(ctx, { includeInactive: false }), newOrEscalated: [], resolved: [] } : await evaluateAndPersist(ctx);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn("Anomaly evaluation failed during an alert run", { error: message });
        notes.push(`Anomaly evaluation failed: ${message}`);
    }
    const counts = emptyCounts();
    const deliveries: StoredDelivery[] = [];
    if (!opts.dryRun) {
        const due = await processDueDeliveries({ ...dctx, currentSignals: evaluation.signals }, deps);
        add(counts, due.counts);
        deliveries.push(...due.deliveries);
    }
    const sent = await dispatchSignals(dctx, { signals: [...evaluation.newOrEscalated, ...evaluation.signals], resolved: evaluation.resolved }, deps);
    add(counts, sent.counts);
    counts.candidates = sent.counts.candidates;
    deliveries.push(...sent.deliveries);
    let digests = 0;
    if (opts.digests && !opts.dryRun) {
        const d = await runDueDigests(ctx, { routes, channels, signals: evaluation.signals, force: opts.force, perAccountKey: opts.perAccountDigests }, deps);
        add(counts, d.counts);
        deliveries.push(...d.deliveries);
        digests = d.digests;
    }
    if (!channels.some((c) => c.enabled))
        notes.push("No alert channels yet — add one on the Alerts page, connect Slack/Teams/Discord/Webhook on the Plugins page, or set SLACK_WEBHOOK_URL (TEAMS_/DISCORD_/ALERT_WEBHOOK_URL) in .env.");
    if (ctx.source.mode !== "live" && !opts.force)
        notes.push("No live Google Ads data: deliveries are logged as suppressed. Run with force to send them anyway.");
    if (!opts.dryRun && (counts.sent || counts.failed)) {
        await audit({ actor: opts.actor, action: "alerts.run", target: ctx.accountId, mode: ctx.source.mode, summary: `Alert run: ${counts.sent} sent, ${counts.failed} failed, ${counts.suppressed} suppressed`, details: { sent: counts.sent, failed: counts.failed, deferred: counts.deferred, forced: !!opts.force } });
    }
    return {
        accountId: ctx.accountId,
        mode: ctx.source.mode,
        dryRun: !!opts.dryRun,
        forced: !!opts.force,
        evaluated: evaluation.signals.length,
        candidates: counts.candidates,
        sent: counts.sent,
        suppressed: counts.suppressed,
        failed: counts.failed,
        deferred: counts.deferred,
        deduped: counts.deduped,
        pending: counts.pending,
        retried: counts.retried,
        digests,
        deliveries: deliveries.map(publicDelivery),
        notes,
    };
}
