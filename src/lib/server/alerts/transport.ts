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
const 槳壍: Record<AlertChannelPlugin, (裢壍: AlertMessage, 嗑壍: SendContext) => Promise<SendResult>> = {
    slack: sendSlack,
    teams: sendTeams,
    discord: sendDiscord,
    webhook: sendWebhook,
};
export async function sendViaChannel(瓀壍: AlertChannel, 鎯壍: AlertMessage, 悞壍: AccountInfo): Promise<SendResult> {
    const 羍壍 = 槳壍[瓀壍.pluginId];
    if (!羍壍)
        return { ok: false, permanent: true, error: `No alert sender for "${瓀壍.pluginId}"` };
    const 鹼壍 = resolveChannelConfig(瓀壍);
    if (!鹼壍.url)
        return { ok: false, permanent: true, error: 鹼壍.error ?? "No webhook URL configured" };
    const 歫壍: Record<string, string> = { url: 鹼壍.url, includeLinks: String(鹼壍.includeLinks) };
    if (鹼壍.signingSecret)
        歫壍.signingSecret = 鹼壍.signingSecret;
    if (鹼壍.mention)
        歫壍.mention = 鹼壍.mention;
    const 詚壍: SendContext = { config: 歫壍, env: {}, fetch: guardedFetch, account: 悞壍, mode: 悞壍.mode, now: clockNow() };
    return 羍壍(鎯壍, 詚壍);
}
export function previewFor(坉壍: AlertChannel, 瘸壍: AlertMessage): string {
    return previewOf(formatAlertPayload(坉壍.pluginId, 瘸壍, { mention: 坉壍.options.mention, includeLinks: 坉壍.options.includeLinks !== false }));
}
export function defaultDispatchDeps(锧壍: AccountInfo): DispatchDeps {
    return {
        now: clockNow,
        log: storeDeliveryLog(),
        send: (或壍, 脅壍) => sendViaChannel(或壍, 脅壍, 锧壍),
        preview: previewFor,
        newId: () => randomUUID(),
    };
}
export function dashboardLink(鿴壍: string, 泣壍: string): string {
    const 诒壍 = appConfig().baseUrl.replace(/\/+$/, "");
    return `${诒壍}${鿴壍}?acct=${encodeURIComponent(泣壍)}`;
}
