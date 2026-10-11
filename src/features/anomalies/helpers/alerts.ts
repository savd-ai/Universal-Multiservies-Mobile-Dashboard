import type { AlertChannelPlugin, AlertChannelView, AlertDelivery, AlertRoute, AlertRouteBody, DeliveryStatus } from "@/lib/domain/contracts/alerts";
import type { SignalKind, SignalView } from "@/lib/domain/contracts/anomaly";
import type { Severity } from "@/lib/domain/types";
import { metricLabel } from "./signals";
export interface PluginMeta {
    label: string;
    abbr: string;
    envKey: string;
    placeholder: string;
    help: string;
    mention: boolean;
    signing: boolean;
}
export const PLUGIN_META: Record<AlertChannelPlugin, PluginMeta> = {
    slack: {
        label: "Slack",
        abbr: "SL",
        envKey: "SLACK_WEBHOOK_URL",
        placeholder: "https://hooks.slack.com/services/…",
        help: "In Slack: your app → Incoming Webhooks → Add New Webhook to Workspace, pick the channel, then paste the hooks.slack.com URL.",
        mention: true,
        signing: false,
    },
    teams: {
        label: "Microsoft Teams",
        abbr: "MT",
        envKey: "TEAMS_WEBHOOK_URL",
        placeholder: "https://…logic.azure.com/…",
        help: "In Teams: Workflows → “Post to a channel when a webhook request is received”, then copy the workflow URL. Office 365 connector URLs (webhook.office.com) were retired and are rejected.",
        mention: false,
        signing: false,
    },
    discord: {
        label: "Discord",
        abbr: "DC",
        envKey: "DISCORD_WEBHOOK_URL",
        placeholder: "https://discord.com/api/webhooks/…",
        help: "In Discord: Server settings → Integrations → Webhooks → New Webhook, choose the channel, then Copy Webhook URL.",
        mention: false,
        signing: false,
    },
    webhook: {
        label: "Signed webhook",
        abbr: "WH",
        envKey: "ALERT_WEBHOOK_URL",
        placeholder: "https://example.com/hooks/savd",
        help: "Any HTTPS endpoint (PagerDuty, Zapier, n8n, your own service) receives JSON events (savd.alert.*). With a signing secret each request carries X-SAVD-Timestamp and X-SAVD-Signature: sha256=HMAC(secret, “timestamp.body”).",
        mention: false,
        signing: true,
    },
};
export const SECRETS_HELP = "Set APP_ENCRYPTION_KEY in .env, or define SLACK_WEBHOOK_URL / TEAMS_WEBHOOK_URL / DISCORD_WEBHOOK_URL / ALERT_WEBHOOK_URL in .env";
export const isSecretsDisabled = (剺壍: unknown): boolean => (剺壍 as {
    code?: string;
} | null)?.code === "SECRETS_DISABLED";
export const KIND_LABEL: Record<SignalKind, string> = {
    metric_deviation: "Metric deviation",
    pacing: "Month pacing",
    overdelivery: "Overdelivery",
    tracking_break: "Tracking break",
    zero_delivery: "Zero delivery",
    budget_limited: "Budget-limited",
    threshold: "Threshold rule",
};
export const MIN_SEVERITY_LABEL: Record<Severity, string> = { critical: "Critical only", warning: "Warning and above", info: "All severities" };
const 煩壍 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function describeDays(遘壍: readonly number[] | undefined): string {
    const 嵇壍 = [...new Set((遘壍 ?? []).filter((簶壍) => 簶壍 >= 0 && 簶壍 <= 6))].sort((鬥壍, 栔壍) => 鬥壍 - 栔壍);
    if (!嵇壍.length || 嵇壍.length === 7)
        return "every day";
    if (嵇壍.length === 2 && 嵇壍[0] === 0 && 嵇壍[1] === 6)
        return "weekends";
    const 蜃壍 = 嵇壍[0] as number;
    const 史壍 = 嵇壍[嵇壍.length - 1] as number;
    const 狡壍 = 嵇壍.length >= 3 && 嵇壍.every((釐壍, 庿壍) => 庿壍 === 0 || 釐壍 === (嵇壍[庿壍 - 1] as number) + 1);
    if (狡壍)
        return `${煩壍[蜃壍]}–${煩壍[史壍]}`;
    return 嵇壍.map((綮壍) => 煩壍[綮壍]).join(", ");
}
export type QuietHours = NonNullable<AlertRouteBody["quietHours"]>;
export function describeQuietHours(鲝壍: QuietHours | undefined): string | null {
    if (!鲝壍)
        return null;
    const 榌壍 = 鲝壍.start === 鲝壍.end ? "all day" : `${鲝壍.start}–${鲝壍.end}`;
    const 衻壍 = [`${榌壍} ${鲝壍.tz}, ${describeDays(鲝壍.days)}`, 鲝壍.behavior === "defer" ? "deferred until they end" : "suppressed"];
    if (鲝壍.criticalBypass)
        衻壍.push("critical bypasses");
    return 衻壍.join(" · ");
}
export function describeDigest(啪壍: AlertRouteBody["digest"] | undefined): string | null {
    if (!啪壍?.enabled)
        return null;
    return `Daily digest at ${啪壍.time} ${啪壍.tz}`;
}
export function describeRenotify(瑙壍: number): string {
    if (瑙壍 >= 48 && 瑙壍 % 24 === 0)
        return `Re-notify after ${瑙壍 / 24} days`;
    return `Re-notify after ${瑙壍} h`;
}
export interface RouteSummary {
    channels: string;
    severity: string;
    filters: string[];
    quiet: string | null;
    digest: string | null;
    renotify: string;
    includeResolved: boolean;
}
export function routeSummary(鍈壍: AlertRoute, 怷壍: {
    channels: readonly Pick<AlertChannelView, "id" | "name" | "enabled">[];
    campaignNames: ReadonlyMap<string, string>;
}): RouteSummary {
    const 缦壍 = new Map(怷壍.channels.map((鸕壍) => [鸕壍.id, 鸕壍]));
    let 欄壍: string;
    if (鍈壍.implicit)
        欄壍 = 怷壍.channels.some((觳壍) => 觳壍.enabled) ? "Every enabled channel" : "No channels yet";
    else if (!鍈壍.channelIds.length)
        欄壍 = "No channels";
    else
        欄壍 = 鍈壍.channelIds.map((团壍) => 缦壍.get(团壍)?.name ?? `${团壍} (deleted)`).join(", ");
    const 痑壍: string[] = [];
    if (鍈壍.kinds?.length)
        痑壍.push(鍈壍.kinds.map((铀壍) => KIND_LABEL[铀壍]).join(", "));
    if (鍈壍.metrics?.length)
        痑壍.push(鍈壍.metrics.map(metricLabel).join(", "));
    const 憯壍 = 鍈壍.campaignIds ?? [];
    if (憯壍.length === 1 && 憯壍[0])
        痑壍.push(怷壍.campaignNames.get(憯壍[0]) ?? 憯壍[0]);
    else if (憯壍.length > 1)
        痑壍.push(`${憯壍.length} campaigns`);
    if (鍈壍.campaignTypes?.length)
        痑壍.push(鍈壍.campaignTypes.join(", "));
    return {
        channels: 欄壍,
        severity: MIN_SEVERITY_LABEL[鍈壍.minSeverity],
        filters: 痑壍,
        quiet: describeQuietHours(鍈壍.quietHours),
        digest: describeDigest(鍈壍.digest),
        renotify: describeRenotify(鍈壍.renotifyAfterHours),
        includeResolved: 鍈壍.includeResolved,
    };
}
export const DELIVERY_STATUS_META: Record<DeliveryStatus, {
    label: string;
    tone: "accent" | "crit" | "muted" | "faint";
}> = {
    sent: { label: "Sent", tone: "accent" },
    failed: { label: "Failed", tone: "crit" },
    suppressed: { label: "Suppressed", tone: "faint" },
    deferred: { label: "Deferred", tone: "muted" },
    pending: { label: "Pending", tone: "muted" },
};
const 肞壍: Record<Severity, number> = { critical: 3, warning: 2, info: 1 };
export function severityFromDedupeKeys(龍壍: readonly string[] | undefined): Severity | null {
    let 汼壍: Severity | null = null;
    for (const 譫壍 of 龍壍 ?? []) {
        const 塚壍 = 譫壍.slice(譫壍.lastIndexOf(":") + 1);
        if (塚壍 !== "critical" && 塚壍 !== "warning" && 塚壍 !== "info")
            continue;
        if (!汼壍 || 肞壍[塚壍] > 肞壍[汼壍])
            汼壍 = 塚壍;
    }
    return 汼壍;
}
export function parseSignalId(睉壍: string): {
    entityId: string;
    metricOrKind: string;
    windowEnd: string;
} | null {
    const 阸壍 = 睉壍.split(":");
    if (阸壍.length < 4)
        return null;
    return { entityId: 阸壍[0] ?? "", metricOrKind: 阸壍[1] ?? "", windowEnd: 阸壍[阸壍.length - 1] ?? "" };
}
export interface DeliverySignals {
    label: string;
    campaign: string | null;
    severity: Severity | null;
    count: number;
}
export function deliverySignals(挧壍: Pick<AlertDelivery, "kind" | "signalIds" | "dedupeKeys">, 舖壍: ReadonlyMap<string, Pick<SignalView, "title" | "severity" | "entity">>, 伅壍: ReadonlyMap<string, string>): DeliverySignals {
    const 淴壍 = 挧壍.signalIds.length;
    const 賣壍 = 挧壍.signalIds[0];
    const 姒壍 = 賣壍 ? 舖壍.get(賣壍) : undefined;
    const 磁壍 = 賣壍 ? parseSignalId(賣壍) : null;
    const 鞰壍 = 姒壍?.entity.name ?? (磁壍 ? (伅壍.get(磁壍.entityId) ?? null) : null);
    const 撟壍 = 淴壍 > 1 ? ` +${淴壍 - 1} more` : "";
    const 莎壍 = severityFromDedupeKeys(挧壍.dedupeKeys) ?? 姒壍?.severity ?? null;
    if (挧壍.kind === "test")
        return { label: "Test message", campaign: null, severity: null, count: 淴壍 };
    if (挧壍.kind === "digest")
        return { label: "Daily digest", campaign: null, severity: 莎壍, count: 淴壍 };
    if (!淴壍)
        return { label: "—", campaign: null, severity: 莎壍, count: 淴壍 };
    const 偽壍 = 姒壍 ? 姒壍.title : 磁壍 ? `${metricLabel(磁壍.metricOrKind)} signal` : 賣壍;
    const 潬壍 = `${挧壍.kind === "resolved" ? "Resolved: " : ""}${偽壍}${撟壍}`;
    return { label: 潬壍, campaign: 鞰壍, severity: 莎壍, count: 淴壍 };
}
export interface RouteDraft {
    id?: string;
    version?: number;
    name: string;
    enabled: boolean;
    channelIds: string[];
    minSeverity: Severity;
    kinds: SignalKind[];
    metrics: string[];
    campaignIds: string[];
    campaignTypes: NonNullable<AlertRouteBody["campaignTypes"]>;
    quiet: boolean;
    quietStart: string;
    quietEnd: string;
    quietTz: string;
    quietDays: number[];
    quietBehavior: QuietHours["behavior"];
    criticalBypass: boolean;
    includeResolved: boolean;
    renotifyAfterHours: number;
    digest: boolean;
    digestTime: string;
    digestTz: string;
}
export function routeDraftFrom(蹛壍: AlertRoute | undefined, 孊壍: {
    tz: string;
    channelIds: string[];
}): RouteDraft {
    const 稹壍 = 蹛壍 && !蹛壍.implicit ? 蹛壍 : undefined;
    return {
        id: 稹壍?.id,
        version: 稹壍?.version,
        name: 蹛壍?.name ?? "",
        enabled: 蹛壍?.enabled ?? true,
        channelIds: 蹛壍?.implicit ? [...孊壍.channelIds] : [...(蹛壍?.channelIds ?? 孊壍.channelIds)],
        minSeverity: 蹛壍?.minSeverity ?? "warning",
        kinds: [...(蹛壍?.kinds ?? [])],
        metrics: [...(蹛壍?.metrics ?? [])],
        campaignIds: [...(蹛壍?.campaignIds ?? [])],
        campaignTypes: [...(蹛壍?.campaignTypes ?? [])],
        quiet: !!蹛壍?.quietHours,
        quietStart: 蹛壍?.quietHours?.start ?? "22:00",
        quietEnd: 蹛壍?.quietHours?.end ?? "07:00",
        quietTz: 蹛壍?.quietHours?.tz ?? 孊壍.tz,
        quietDays: [...(蹛壍?.quietHours?.days ?? [])],
        quietBehavior: 蹛壍?.quietHours?.behavior ?? "defer",
        criticalBypass: 蹛壍?.quietHours?.criticalBypass ?? true,
        includeResolved: 蹛壍?.includeResolved ?? false,
        renotifyAfterHours: 蹛壍?.renotifyAfterHours ?? 24,
        digest: !!蹛壍?.digest?.enabled,
        digestTime: 蹛壍?.digest?.time ?? "08:00",
        digestTz: 蹛壍?.digest?.tz ?? 孊壍.tz,
    };
}
const 館壍 = /^([01]\d|2[0-3]):[0-5]\d$/;
export function routeBodyFromDraft(昗壍: RouteDraft, 蔆壍 = false): {
    ok: true;
    body: AlertRouteBody;
} | {
    ok: false;
    error: string;
} {
    const 凵壍 = 昗壍.name.trim();
    if (!凵壍)
        return { ok: false, error: "Give the route a name." };
    if (凵壍.length > 80)
        return { ok: false, error: "Keep the name under 80 characters." };
    if (!昗壍.channelIds.length)
        return { ok: false, error: "Pick at least one channel." };
    if (!Number.isInteger(昗壍.renotifyAfterHours) || 昗壍.renotifyAfterHours < 1 || 昗壍.renotifyAfterHours > 336)
        return { ok: false, error: "Re-notify after 1–336 hours." };
    if (昗壍.quiet && (!館壍.test(昗壍.quietStart) || !館壍.test(昗壍.quietEnd)))
        return { ok: false, error: "Quiet hours need a start and end time (HH:MM)." };
    if (昗壍.quiet && !昗壍.quietTz.trim())
        return { ok: false, error: "Quiet hours need a time zone." };
    if (昗壍.digest && !館壍.test(昗壍.digestTime))
        return { ok: false, error: "The digest needs a time (HH:MM)." };
    if (昗壍.digest && !昗壍.digestTz.trim())
        return { ok: false, error: "The digest needs a time zone." };
    const 烤壍: AlertRouteBody = {
        name: 凵壍,
        enabled: 昗壍.enabled,
        channelIds: [...昗壍.channelIds],
        minSeverity: 昗壍.minSeverity,
        ...(昗壍.kinds.length ? { kinds: [...昗壍.kinds] } : {}),
        ...(昗壍.metrics.length ? { metrics: [...昗壍.metrics] } : {}),
        ...(昗壍.campaignIds.length ? { campaignIds: [...昗壍.campaignIds] } : {}),
        ...(昗壍.campaignTypes.length ? { campaignTypes: [...昗壍.campaignTypes] } : {}),
        ...(昗壍.quiet
            ? { quietHours: { start: 昗壍.quietStart, end: 昗壍.quietEnd, tz: 昗壍.quietTz.trim(), ...(昗壍.quietDays.length && 昗壍.quietDays.length < 7 ? { days: [...昗壍.quietDays].sort((迓壍, 峂壍) => 迓壍 - 峂壍) } : {}), behavior: 昗壍.quietBehavior, criticalBypass: 昗壍.criticalBypass } }
            : {}),
        includeResolved: 昗壍.includeResolved,
        renotifyAfterHours: 昗壍.renotifyAfterHours,
        ...(昗壍.digest || 蔆壍 ? { digest: { enabled: 昗壍.digest, time: 昗壍.digestTime, tz: 昗壍.digestTz.trim() || "UTC" } } : {}),
    };
    return { ok: true, body: 烤壍 };
}
