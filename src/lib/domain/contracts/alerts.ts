import { z } from "zod";
import { CAMPAIGN_TYPES, type Severity } from "../types";
import { SIGNAL_KINDS, type SignalKind, type SignalView } from "./anomaly";
export const ALERT_CHANNEL_PLUGINS = ["slack", "teams", "discord", "webhook"] as const;
export type AlertChannelPlugin = (typeof ALERT_CHANNEL_PLUGINS)[number];
export type SecretRefWire = {
    enc: string;
} | {
    env: string;
};
export interface AlertChannel {
    id: string;
    pluginId: AlertChannelPlugin;
    name: string;
    enabled: boolean;
    origin: "env" | "stored";
    url: SecretRefWire;
    signingSecret?: SecretRefWire;
    options: {
        mention?: string;
        includeLinks: boolean;
    };
    lastTest?: {
        at: string;
        ok: boolean;
        status?: number;
        error?: string;
    };
    version: number;
    createdAt: string;
    updatedAt: string;
}
export interface AlertChannelView extends Omit<AlertChannel, "url" | "signingSecret"> {
    url: {
        hasValue: boolean;
        masked: string | null;
        source: "env" | "stored" | null;
    };
    signing: boolean;
}
export const alertChannelBodySchema = z.object({
    pluginId: z.enum(ALERT_CHANNEL_PLUGINS),
    name: z.string().min(1).max(60),
    enabled: z.boolean().default(true),
    url: z.string().url().max(2000).optional(),
    signingSecret: z.string().max(200).optional(),
    options: z.object({ mention: z.string().max(60).optional(), includeLinks: z.boolean().default(true) }).default({ includeLinks: true }),
});
export type AlertChannelBody = z.infer<typeof alertChannelBodySchema>;
export const alertRouteBodySchema = z.object({
    name: z.string().min(1).max(80),
    enabled: z.boolean().default(true),
    channelIds: z.array(z.string().max(64)).min(1).max(10),
    minSeverity: z.enum(["critical", "warning", "info"]).default("warning"),
    kinds: z.array(z.enum(SIGNAL_KINDS)).optional(),
    metrics: z.array(z.string().max(64)).optional(),
    campaignIds: z.array(z.string().max(64)).optional(),
    campaignTypes: z.array(z.enum(CAMPAIGN_TYPES)).optional(),
    quietHours: z
        .object({
        start: z.string().regex(/^\d{2}:\d{2}$/),
        end: z.string().regex(/^\d{2}:\d{2}$/),
        tz: z.string().max(64),
        days: z.array(z.number().int().min(0).max(6)).optional(),
        behavior: z.enum(["defer", "suppress"]).default("defer"),
        criticalBypass: z.boolean().default(true),
    })
        .optional(),
    includeResolved: z.boolean().default(false),
    renotifyAfterHours: z.number().int().min(1).max(24 * 14).default(24),
    digest: z.object({ enabled: z.boolean(), time: z.string().regex(/^\d{2}:\d{2}$/), tz: z.string().max(64) }).optional(),
});
export type AlertRouteBody = z.infer<typeof alertRouteBodySchema>;
export interface AlertRoute extends AlertRouteBody {
    id: string;
    version: number;
    createdAt: string;
    updatedAt: string;
    implicit?: boolean;
}
export const alertChannelUpdateSchema = z.object({
    pluginId: z.enum(ALERT_CHANNEL_PLUGINS).optional(),
    name: z.string().min(1).max(60).optional(),
    enabled: z.boolean().optional(),
    url: z.union([z.literal(""), z.string().url().max(2000)]).optional(),
    signingSecret: z.string().max(200).optional(),
    options: z.object({ mention: z.string().max(60).optional(), includeLinks: z.boolean().optional() }).optional(),
    version: z.number().int().optional(),
});
export type AlertChannelUpdate = z.infer<typeof alertChannelUpdateSchema>;
export const alertRunBodySchema = z.object({
    dryRun: z.boolean().default(false),
    force: z.boolean().default(false),
});
export const digestPreviewBodySchema = z.object({ routeId: z.string().max(64).optional() });
export const deliveriesQuerySchema = z.object({
    status: z.enum(["pending", "sent", "failed", "suppressed", "deferred"]).optional(),
    channelId: z.string().max(64).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    cursor: z.string().max(200).optional(),
});
export interface AlertMessage {
    kind: "signals" | "resolved" | "digest" | "test";
    accountName: string;
    accountId: string;
    mode: "live" | "blank";
    signals: SignalView[];
    digest?: {
        date: string;
        kpis: {
            label: string;
            value: string;
            delta?: string;
        }[];
        openSignals: number;
        critical: number;
        narrative?: string;
    };
    dashboardUrl: string;
    generatedAt: string;
}
export type DeliveryStatus = "pending" | "sent" | "failed" | "suppressed" | "deferred";
export interface AlertDelivery {
    id: string;
    ts: string;
    routeId: string | null;
    channelId: string;
    channelName: string;
    pluginId: AlertChannelPlugin;
    kind: AlertMessage["kind"];
    signalIds: string[];
    dedupeKey: string;
    status: DeliveryStatus;
    attempts: number;
    nextAttemptAt?: string;
    httpStatus?: number;
    lastError?: string;
    payloadPreview: string;
    sentAt?: string;
    dedupeKeys?: string[];
    routeIds?: string[];
    reasonCode?: "no_live_data" | "quiet_hours" | "signals_inactive" | "channel_unavailable" | "max_attempts";
    reason?: string;
    dryRun?: boolean;
}
export interface AlertRunSummary {
    accountId: string;
    mode: "live" | "blank";
    dryRun: boolean;
    forced: boolean;
    evaluated: number;
    candidates: number;
    sent: number;
    suppressed: number;
    failed: number;
    deferred: number;
    deduped: number;
    pending: number;
    retried: number;
    digests: number;
    deliveries: AlertDelivery[];
    notes: string[];
}
export interface DeliveriesPage {
    items: AlertDelivery[];
    nextCursor: string | null;
}
export interface DigestPreview {
    routeId: string | null;
    message: AlertMessage;
    payloads: Record<AlertChannelPlugin, unknown>;
}
export function severityRank(s: Severity): number {
    return s === "critical" ? 3 : s === "warning" ? 2 : 1;
}
export type { SignalKind };
