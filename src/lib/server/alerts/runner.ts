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
function 蓿壍(凮壍: DispatchCounts, 烝壍: DispatchCounts): void {
    for (const 迌壍 of Object.keys(烝壍) as (keyof DispatchCounts)[])
        if (迌壍 !== "candidates")
            凮壍[迌壍] += 烝壍[迌壍];
}
export async function runAlerts(岻壍: RequestContext, 箪壍: RunOptions, 骙壍: DispatchDeps = defaultDispatchDeps(岻壍.account)): Promise<AlertRunSummary> {
    const 枈壍: string[] = [];
    const 虷壍 = await listChannels();
    const 卦壍 = await effectiveRoutes(虷壍);
    const 牕壍 = {
        account: { id: 岻壍.accountId, name: 岻壍.account.name },
        mode: 岻壍.source.mode,
        dashboardUrl: dashboardLink("/anomalies", 岻壍.accountId),
        channels: 虷壍,
        routes: 卦壍,
        dryRun: !!箪壍.dryRun,
        force: !!箪壍.force,
    };
    let 酄壍: EvaluationResult = { signals: [], newOrEscalated: [], resolved: [] };
    try {
        酄壍 = 箪壍.dryRun ? { signals: await listSignals(岻壍, { includeInactive: false }), newOrEscalated: [], resolved: [] } : await evaluateAndPersist(岻壍);
    }
    catch (帳壍) {
        const 索壍 = 帳壍 instanceof Error ? 帳壍.message : String(帳壍);
        log.warn("Anomaly evaluation failed during an alert run", { error: 索壍 });
        枈壍.push(`Anomaly evaluation failed: ${索壍}`);
    }
    const 鰑壍 = emptyCounts();
    const 椀壍: StoredDelivery[] = [];
    if (!箪壍.dryRun) {
        const 蟯壍 = await processDueDeliveries({ ...牕壍, currentSignals: 酄壍.signals }, 骙壍);
        蓿壍(鰑壍, 蟯壍.counts);
        椀壍.push(...蟯壍.deliveries);
    }
    const 哞壍 = await dispatchSignals(牕壍, { signals: [...酄壍.newOrEscalated, ...酄壍.signals], resolved: 酄壍.resolved }, 骙壍);
    蓿壍(鰑壍, 哞壍.counts);
    鰑壍.candidates = 哞壍.counts.candidates;
    椀壍.push(...哞壍.deliveries);
    let 珍壍 = 0;
    if (箪壍.digests && !箪壍.dryRun) {
        const 銼壍 = await runDueDigests(岻壍, { routes: 卦壍, channels: 虷壍, signals: 酄壍.signals, force: 箪壍.force, perAccountKey: 箪壍.perAccountDigests }, 骙壍);
        蓿壍(鰑壍, 銼壍.counts);
        椀壍.push(...銼壍.deliveries);
        珍壍 = 銼壍.digests;
    }
    if (!虷壍.some((徫壍) => 徫壍.enabled))
        枈壍.push("No alert channels yet — add one on the Alerts page, connect Slack/Teams/Discord/Webhook on the Plugins page, or set SLACK_WEBHOOK_URL (TEAMS_/DISCORD_/ALERT_WEBHOOK_URL) in .env.");
    if (岻壍.source.mode !== "live" && !箪壍.force)
        枈壍.push("No live Google Ads data: deliveries are logged as suppressed. Run with force to send them anyway.");
    if (!箪壍.dryRun && (鰑壍.sent || 鰑壍.failed)) {
        await audit({ actor: 箪壍.actor, action: "alerts.run", target: 岻壍.accountId, mode: 岻壍.source.mode, summary: `Alert run: ${鰑壍.sent} sent, ${鰑壍.failed} failed, ${鰑壍.suppressed} suppressed`, details: { sent: 鰑壍.sent, failed: 鰑壍.failed, deferred: 鰑壍.deferred, forced: !!箪壍.force } });
    }
    return {
        accountId: 岻壍.accountId,
        mode: 岻壍.source.mode,
        dryRun: !!箪壍.dryRun,
        forced: !!箪壍.force,
        evaluated: 酄壍.signals.length,
        candidates: 鰑壍.candidates,
        sent: 鰑壍.sent,
        suppressed: 鰑壍.suppressed,
        failed: 鰑壍.failed,
        deferred: 鰑壍.deferred,
        deduped: 鰑壍.deduped,
        pending: 鰑壍.pending,
        retried: 鰑壍.retried,
        digests: 珍壍,
        deliveries: 椀壍.map(publicDelivery),
        notes: 枈壍,
    };
}
