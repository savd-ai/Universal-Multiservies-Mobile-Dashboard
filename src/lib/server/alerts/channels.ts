import "server-only";
import { randomUUID } from "node:crypto";
import { ALERT_CHANNEL_PLUGINS, type AlertChannel, type AlertChannelBody, type AlertChannelPlugin, type AlertChannelUpdate, type AlertChannelView, type AlertDelivery, } from "@/lib/domain/contracts/alerts";
import { describeSecret, encryptSecret, resolveSecret, secretsEnabled } from "../crypto/secrets";
import { AGENCY_WORKSPACE } from "@/lib/domain/auth/roles";
import { env } from "../env/config";
import { currentWorkspace } from "../scope";
import { AppError, conflict, notFound } from "../http/errors";
import { assertSafeUrl } from "../net/ssrf";
import { getStore } from "../store";
export interface EnvChannelDef {
    id: string;
    name: string;
    urlKey: string;
    secretKey?: string;
}
export const ENV_CHANNELS: Record<AlertChannelPlugin, EnvChannelDef> = {
    slack: { id: "env-slack", name: "Slack (.env)", urlKey: "SLACK_WEBHOOK_URL" },
    teams: { id: "env-teams", name: "Microsoft Teams (.env)", urlKey: "TEAMS_WEBHOOK_URL" },
    discord: { id: "env-discord", name: "Discord (.env)", urlKey: "DISCORD_WEBHOOK_URL" },
    webhook: { id: "env-webhook", name: "Webhook (.env)", urlKey: "ALERT_WEBHOOK_URL", secretKey: "ALERT_WEBHOOK_SECRET" },
};
export const pluginChannelId = (pluginId: AlertChannelPlugin) => `plugin-${pluginId}`;
const MAX_CHANNELS = 20;
const EPOCH = "1970-01-01T00:00:00.000Z";
const urlAad = (id: string) => `alert-channels:${id}:url`;
const signingAad = (id: string) => `alert-channels:${id}:signingSecret`;
export const isAlertPluginId = (id: string): id is AlertChannelPlugin => (ALERT_CHANNEL_PLUGINS as readonly string[]).includes(id);
export function envChannels(): AlertChannel[] {
    if (currentWorkspace() !== AGENCY_WORKSPACE)
        return [];
    return ALERT_CHANNEL_PLUGINS.flatMap((pluginId) => {
        const def = ENV_CHANNELS[pluginId];
        if (!env.has(def.urlKey))
            return [];
        const channel: AlertChannel = {
            id: def.id,
            pluginId,
            name: def.name,
            enabled: true,
            origin: "env",
            url: { env: def.urlKey },
            ...(def.secretKey && env.has(def.secretKey) ? { signingSecret: { env: def.secretKey } } : {}),
            options: { includeLinks: true },
            version: 1,
            createdAt: EPOCH,
            updatedAt: EPOCH,
        };
        return [channel];
    });
}
export async function listChannels(): Promise<AlertChannel[]> {
    const stored = await getStore().alertChannels.list();
    stored.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return [...stored, ...envChannels()];
}
export async function getChannel(id: string): Promise<AlertChannel | null> {
    if (id.startsWith("env-"))
        return envChannels().find((c) => c.id === id) ?? null;
    return getStore().alertChannels.get(id);
}
export function channelView(ch: AlertChannel, lastTest?: AlertChannel["lastTest"]): AlertChannelView {
    const { url, signingSecret, ...rest } = ch;
    const signing = signingSecret ? describeSecret(signingSecret, signingAad(ch.id)).hasValue : false;
    return { ...rest, lastTest: lastTest ?? ch.lastTest, url: describeSecret(url, urlAad(ch.id)), signing };
}
export function lastTestFromDeliveries(channelId: string, deliveries: readonly AlertDelivery[]): AlertChannel["lastTest"] | undefined {
    const d = deliveries.find((x) => x.channelId === channelId && x.kind === "test" && !x.dryRun);
    if (!d)
        return undefined;
    return { at: d.sentAt ?? d.ts, ok: d.status === "sent", ...(d.httpStatus ? { status: d.httpStatus } : {}), ...(d.lastError ? { error: d.lastError } : {}) };
}
export async function channelViews(recentDeliveries: readonly AlertDelivery[] = []): Promise<AlertChannelView[]> {
    const all = await listChannels();
    return all.map((c) => channelView(c, c.origin === "env" ? lastTestFromDeliveries(c.id, recentDeliveries) : undefined));
}
export function resolveChannelConfig(ch: AlertChannel): {
    url?: string;
    signingSecret?: string;
    mention?: string;
    includeLinks: boolean;
    error?: string;
} {
    const out: {
        url?: string;
        signingSecret?: string;
        mention?: string;
        includeLinks: boolean;
        error?: string;
    } = { includeLinks: ch.options.includeLinks !== false };
    if (ch.options.mention)
        out.mention = ch.options.mention;
    try {
        out.url = resolveSecret(ch.url, urlAad(ch.id));
        if (ch.signingSecret)
            out.signingSecret = resolveSecret(ch.signingSecret, signingAad(ch.id));
    }
    catch (err) {
        out.url = undefined;
        out.error = err instanceof Error ? err.message : "The stored webhook URL can't be decrypted — re-enter it.";
    }
    if (!out.url && !out.error)
        out.error = ch.origin === "env" ? `${ENV_CHANNELS[ch.pluginId].urlKey} is empty` : "No webhook URL configured";
    return out;
}
export function validateWebhookUrl(pluginId: AlertChannelPlugin, raw: string): string {
    const url = assertSafeUrl(raw);
    const host = url.hostname.toLowerCase();
    if (pluginId === "teams" && (/(^|\.)webhook\.office\.com$/.test(host) || (/^outlook\.office(365)?\.com$/.test(host) && url.pathname.startsWith("/webhook")))) {
        throw new AppError("VALIDATION_ERROR", "Office 365 connector webhooks were retired. In Teams, create a Workflows webhook (“Post to a channel when a webhook request is received”) and paste its URL.");
    }
    return url.toString();
}
function secretsOff(pluginId: AlertChannelPlugin): AppError {
    return new AppError("SECRETS_DISABLED", `APP_ENCRYPTION_KEY is not set, so webhook URLs can't be saved from the UI. Put it in .env as ${ENV_CHANNELS[pluginId].urlKey} instead — it appears here as a read-only channel.`);
}
function encrypt(pluginId: AlertChannelPlugin, value: string, aad: string): {
    enc: string;
} {
    if (!secretsEnabled())
        throw secretsOff(pluginId);
    return { enc: encryptSecret(value, aad) };
}
export async function createChannel(body: AlertChannelBody, opts: {
    id?: string;
} = {}): Promise<AlertChannel> {
    const store = getStore().alertChannels;
    if ((await store.list()).length >= MAX_CHANNELS)
        throw conflict(`At most ${MAX_CHANNELS} channels — delete one first`);
    if (!body.url)
        throw new AppError("VALIDATION_ERROR", "A webhook URL is required");
    const url = validateWebhookUrl(body.pluginId, body.url);
    const id = opts.id ?? `ch-${randomUUID().slice(0, 8)}`;
    if (!secretsEnabled())
        throw secretsOff(body.pluginId);
    const record: Omit<AlertChannel, "createdAt" | "updatedAt" | "version"> = {
        id,
        pluginId: body.pluginId,
        name: body.name,
        enabled: body.enabled,
        origin: "stored",
        url: encrypt(body.pluginId, url, urlAad(id)),
        ...(body.signingSecret ? { signingSecret: encrypt(body.pluginId, body.signingSecret, signingAad(id)) } : {}),
        options: { includeLinks: body.options.includeLinks, ...(body.options.mention ? { mention: body.options.mention } : {}) },
    };
    return store.create(record);
}
export async function updateChannel(id: string, patch: AlertChannelUpdate): Promise<AlertChannel> {
    if (id.startsWith("env-"))
        throw conflict("Channels defined in .env are read-only — change the environment variable instead.");
    const store = getStore().alertChannels;
    const prev = await store.get(id);
    if (!prev)
        throw notFound("Channel");
    const pluginId = patch.pluginId ?? prev.pluginId;
    if (pluginId !== prev.pluginId && !patch.url)
        throw new AppError("VALIDATION_ERROR", "Changing the channel type needs the new service's webhook URL");
    if (patch.url === "")
        throw new AppError("VALIDATION_ERROR", "A stored channel needs a webhook URL — delete the channel instead");
    const url = patch.url ? encrypt(pluginId, validateWebhookUrl(pluginId, patch.url), urlAad(id)) : undefined;
    const signing = patch.signingSecret ? encrypt(pluginId, patch.signingSecret, signingAad(id)) : undefined;
    return store.update(id, (p) => {
        const next: AlertChannel = { ...p, pluginId };
        if (patch.name !== undefined)
            next.name = patch.name;
        if (patch.enabled !== undefined)
            next.enabled = patch.enabled;
        if (url)
            next.url = url;
        if (patch.signingSecret === "")
            delete next.signingSecret;
        else if (signing)
            next.signingSecret = signing;
        if (patch.options) {
            const mention = patch.options.mention !== undefined ? patch.options.mention : p.options.mention;
            next.options = { includeLinks: patch.options.includeLinks ?? p.options.includeLinks, ...(mention ? { mention } : {}) };
        }
        return next;
    }, { expectedVersion: patch.version });
}
export async function deleteChannel(id: string): Promise<{
    updatedRoutes: string[];
}> {
    if (id.startsWith("env-"))
        throw conflict("Channels defined in .env are read-only — remove the environment variable instead.");
    const store = getStore();
    if (!(await store.alertChannels.delete(id)))
        throw notFound("Channel");
    const updatedRoutes: string[] = [];
    for (const r of await store.alertRoutes.list((x) => x.channelIds.includes(id))) {
        const channelIds = r.channelIds.filter((c) => c !== id);
        await store.alertRoutes.update(r.id, { channelIds, enabled: channelIds.length ? r.enabled : false });
        updatedRoutes.push(r.id);
    }
    return { updatedRoutes };
}
export async function recordChannelTest(id: string, lastTest: NonNullable<AlertChannel["lastTest"]>): Promise<void> {
    if (id.startsWith("env-"))
        return;
    const store = getStore().alertChannels;
    if (await store.get(id))
        await store.update(id, { lastTest });
}
