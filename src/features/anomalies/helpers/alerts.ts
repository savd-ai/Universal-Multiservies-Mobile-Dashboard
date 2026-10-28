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
export const isSecretsDisabled = (err: unknown): boolean => (err as {
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
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function describeDays(days: readonly number[] | undefined): string {
    const value = [...new Set((days ?? []).filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b);
    if (!value.length || value.length === 7)
        return "every day";
    if (value.length === 2 && value[0] === 0 && value[1] === 6)
        return "weekends";
    const first = value[0] as number;
    const last = value[value.length - 1] as number;
    const consecutive = value.length >= 3 && value.every((d, i) => i === 0 || d === (value[i - 1] as number) + 1);
    if (consecutive)
        return `${DAY_SHORT[first]}–${DAY_SHORT[last]}`;
    return value.map((d) => DAY_SHORT[d]).join(", ");
}
export type QuietHours = NonNullable<AlertRouteBody["quietHours"]>;
export function describeQuietHours(qh: QuietHours | undefined): string | null {
    if (!qh)
        return null;
    const span = qh.start === qh.end ? "all day" : `${qh.start}–${qh.end}`;
    const parts = [`${span} ${qh.tz}, ${describeDays(qh.days)}`, qh.behavior === "defer" ? "deferred until they end" : "suppressed"];
    if (qh.criticalBypass)
        parts.push("critical bypasses");
    return parts.join(" · ");
}
export function describeDigest(digest: AlertRouteBody["digest"] | undefined): string | null {
    if (!digest?.enabled)
        return null;
    return `Daily digest at ${digest.time} ${digest.tz}`;
}
export function describeRenotify(hours: number): string {
    if (hours >= 48 && hours % 24 === 0)
        return `Re-notify after ${hours / 24} days`;
    return `Re-notify after ${hours} h`;
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
export function routeSummary(route: AlertRoute, ctx: {
    channels: readonly Pick<AlertChannelView, "id" | "name" | "enabled">[];
    campaignNames: ReadonlyMap<string, string>;
}): RouteSummary {
    const byId = new Map(ctx.channels.map((c) => [c.id, c]));
    let channels: string;
    if (route.implicit)
        channels = ctx.channels.some((c) => c.enabled) ? "Every enabled channel" : "No channels yet";
    else if (!route.channelIds.length)
        channels = "No channels";
    else
        channels = route.channelIds.map((id) => byId.get(id)?.name ?? `${id} (deleted)`).join(", ");
    const filters: string[] = [];
    if (route.kinds?.length)
        filters.push(route.kinds.map((k) => KIND_LABEL[k]).join(", "));
    if (route.metrics?.length)
        filters.push(route.metrics.map(metricLabel).join(", "));
    const ids = route.campaignIds ?? [];
    if (ids.length === 1 && ids[0])
        filters.push(ctx.campaignNames.get(ids[0]) ?? ids[0]);
    else if (ids.length > 1)
        filters.push(`${ids.length} campaigns`);
    if (route.campaignTypes?.length)
        filters.push(route.campaignTypes.join(", "));
    return {
        channels,
        severity: MIN_SEVERITY_LABEL[route.minSeverity],
        filters,
        quiet: describeQuietHours(route.quietHours),
        digest: describeDigest(route.digest),
        renotify: describeRenotify(route.renotifyAfterHours),
        includeResolved: route.includeResolved,
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
const SEV_RANK: Record<Severity, number> = { critical: 3, warning: 2, info: 1 };
export function severityFromDedupeKeys(keys: readonly string[] | undefined): Severity | null {
    let best: Severity | null = null;
    for (const k of keys ?? []) {
        const s = k.slice(k.lastIndexOf(":") + 1);
        if (s !== "critical" && s !== "warning" && s !== "info")
            continue;
        if (!best || SEV_RANK[s] > SEV_RANK[best])
            best = s;
    }
    return best;
}
export function parseSignalId(id: string): {
    entityId: string;
    metricOrKind: string;
    windowEnd: string;
} | null {
    const parts = id.split(":");
    if (parts.length < 4)
        return null;
    return { entityId: parts[0] ?? "", metricOrKind: parts[1] ?? "", windowEnd: parts[parts.length - 1] ?? "" };
}
export interface DeliverySignals {
    label: string;
    campaign: string | null;
    severity: Severity | null;
    count: number;
}
export function deliverySignals(d: Pick<AlertDelivery, "kind" | "signalIds" | "dedupeKeys">, signals: ReadonlyMap<string, Pick<SignalView, "title" | "severity" | "entity">>, campaignNames: ReadonlyMap<string, string>): DeliverySignals {
    const count = d.signalIds.length;
    const firstId = d.signalIds[0];
    const first = firstId ? signals.get(firstId) : undefined;
    const parsed = firstId ? parseSignalId(firstId) : null;
    const campaign = first?.entity.name ?? (parsed ? (campaignNames.get(parsed.entityId) ?? null) : null);
    const more = count > 1 ? ` +${count - 1} more` : "";
    const severity = severityFromDedupeKeys(d.dedupeKeys) ?? first?.severity ?? null;
    if (d.kind === "test")
        return { label: "Test message", campaign: null, severity: null, count };
    if (d.kind === "digest")
        return { label: "Daily digest", campaign: null, severity, count };
    if (!count)
        return { label: "—", campaign: null, severity, count };
    const base = first ? first.title : parsed ? `${metricLabel(parsed.metricOrKind)} signal` : firstId;
    const label = `${d.kind === "resolved" ? "Resolved: " : ""}${base}${more}`;
    return { label, campaign, severity, count };
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
export function routeDraftFrom(route: AlertRoute | undefined, defaults: {
    tz: string;
    channelIds: string[];
}): RouteDraft {
    const own = route && !route.implicit ? route : undefined;
    return {
        id: own?.id,
        version: own?.version,
        name: route?.name ?? "",
        enabled: route?.enabled ?? true,
        channelIds: route?.implicit ? [...defaults.channelIds] : [...(route?.channelIds ?? defaults.channelIds)],
        minSeverity: route?.minSeverity ?? "warning",
        kinds: [...(route?.kinds ?? [])],
        metrics: [...(route?.metrics ?? [])],
        campaignIds: [...(route?.campaignIds ?? [])],
        campaignTypes: [...(route?.campaignTypes ?? [])],
        quiet: !!route?.quietHours,
        quietStart: route?.quietHours?.start ?? "22:00",
        quietEnd: route?.quietHours?.end ?? "07:00",
        quietTz: route?.quietHours?.tz ?? defaults.tz,
        quietDays: [...(route?.quietHours?.days ?? [])],
        quietBehavior: route?.quietHours?.behavior ?? "defer",
        criticalBypass: route?.quietHours?.criticalBypass ?? true,
        includeResolved: route?.includeResolved ?? false,
        renotifyAfterHours: route?.renotifyAfterHours ?? 24,
        digest: !!route?.digest?.enabled,
        digestTime: route?.digest?.time ?? "08:00",
        digestTz: route?.digest?.tz ?? defaults.tz,
    };
}
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export function routeBodyFromDraft(d: RouteDraft, hadDigest = false): {
    ok: true;
    body: AlertRouteBody;
} | {
    ok: false;
    error: string;
} {
    const name = d.name.trim();
    if (!name)
        return { ok: false, error: "Give the route a name." };
    if (name.length > 80)
        return { ok: false, error: "Keep the name under 80 characters." };
    if (!d.channelIds.length)
        return { ok: false, error: "Pick at least one channel." };
    if (!Number.isInteger(d.renotifyAfterHours) || d.renotifyAfterHours < 1 || d.renotifyAfterHours > 336)
        return { ok: false, error: "Re-notify after 1–336 hours." };
    if (d.quiet && (!HHMM.test(d.quietStart) || !HHMM.test(d.quietEnd)))
        return { ok: false, error: "Quiet hours need a start and end time (HH:MM)." };
    if (d.quiet && !d.quietTz.trim())
        return { ok: false, error: "Quiet hours need a time zone." };
    if (d.digest && !HHMM.test(d.digestTime))
        return { ok: false, error: "The digest needs a time (HH:MM)." };
    if (d.digest && !d.digestTz.trim())
        return { ok: false, error: "The digest needs a time zone." };
    const body: AlertRouteBody = {
        name,
        enabled: d.enabled,
        channelIds: [...d.channelIds],
        minSeverity: d.minSeverity,
        ...(d.kinds.length ? { kinds: [...d.kinds] } : {}),
        ...(d.metrics.length ? { metrics: [...d.metrics] } : {}),
        ...(d.campaignIds.length ? { campaignIds: [...d.campaignIds] } : {}),
        ...(d.campaignTypes.length ? { campaignTypes: [...d.campaignTypes] } : {}),
        ...(d.quiet
            ? { quietHours: { start: d.quietStart, end: d.quietEnd, tz: d.quietTz.trim(), ...(d.quietDays.length && d.quietDays.length < 7 ? { days: [...d.quietDays].sort((a, b) => a - b) } : {}), behavior: d.quietBehavior, criticalBypass: d.criticalBypass } }
            : {}),
        includeResolved: d.includeResolved,
        renotifyAfterHours: d.renotifyAfterHours,
        ...(d.digest || hadDigest ? { digest: { enabled: d.digest, time: d.digestTime, tz: d.digestTz.trim() || "UTC" } } : {}),
    };
    return { ok: true, body };
}
