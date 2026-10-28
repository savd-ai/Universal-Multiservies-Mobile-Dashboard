import "server-only";
import { randomUUID } from "node:crypto";
import type { AlertChannel, AlertChannelPlugin, AlertMessage } from "@/lib/domain/contracts/alerts";
import { formatAlertPayload } from "@/lib/domain/alerts/formatters";
import type { AccountInfo } from "@/lib/domain/types";
import { now as clockNow } from "../clock";
import { appConfig } from "../env/config";
import { guardedFetch } from "../net/guarded-fetch";
import { resolveChannelConfig } from "./channels";
import { previewOf, storeDeliveryLog } from "./deliveries";
import type { DispatchDeps } from "./dispatcher";
import { sendDiscord, sendSlack, sendTeams, sendWebhook } from "./senders";
import type { SendContext, SendResult } from "./send-types";
const findPlugin: Record<AlertChannelPlugin, (alertMessage: AlertMessage, sendContext: SendContext) => Promise<SendResult>> = {
    slack: sendSlack,
    teams: sendTeams,
    discord: sendDiscord,
    webhook: sendWebhook,
};
export async function sendViaChannel(channel: AlertChannel, msg: AlertMessage, account: AccountInfo): Promise<SendResult> {
    const plugin = findPlugin[channel.pluginId];
    if (!plugin)
        return { ok: false, permanent: true, error: `No alert sender for "${channel.pluginId}"` };
    const cfg = resolveChannelConfig(channel);
    if (!cfg.url)
        return { ok: false, permanent: true, error: cfg.error ?? "No webhook URL configured" };
    const config: Record<string, string> = { url: cfg.url, includeLinks: String(cfg.includeLinks) };
    if (cfg.signingSecret)
        config.signingSecret = cfg.signingSecret;
    if (cfg.mention)
        config.mention = cfg.mention;
    const ctx: SendContext = { config, env: {}, fetch: guardedFetch, account, mode: account.mode, now: clockNow() };
    return plugin(msg, ctx);
}
export function previewFor(channel: AlertChannel, msg: AlertMessage): string {
    return previewOf(formatAlertPayload(channel.pluginId, msg, { mention: channel.options.mention, includeLinks: channel.options.includeLinks !== false }));
}
export function defaultDispatchDeps(account: AccountInfo): DispatchDeps {
    return {
        now: clockNow,
        log: storeDeliveryLog(),
        send: (channel, msg) => sendViaChannel(channel, msg, account),
        preview: previewFor,
        newId: () => randomUUID(),
    };
}
export function dashboardLink(page: string, accountId: string): string {
    const base = appConfig().baseUrl.replace(/\/+$/, "");
    return `${base}${page}?acct=${encodeURIComponent(accountId)}`;
}
