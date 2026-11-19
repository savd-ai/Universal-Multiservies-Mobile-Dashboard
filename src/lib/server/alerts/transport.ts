import "server-only";
import { randomUUID } from "node:crypto";
import type { AlertChannel, AlertMessage } from "@/lib/domain/contracts/alerts";
import { formatAlertPayload } from "@/lib/domain/alerts/formatters";
import type { AccountInfo } from "@/lib/domain/types";
import { now as clockNow } from "../clock";
import { appConfig } from "../env/config";
import type { PluginContext, SendResult } from "../plugins/define";
import { findPlugin, pluginContext } from "../plugins/registry";
import { resolveChannelConfig } from "./channels";
import { previewOf, storeDeliveryLog } from "./deliveries";
import type { DispatchDeps } from "./dispatcher";

// Real transport for the dispatcher: channel → its alert plugin's sendAlert(), with a PluginContext whose config
// is the channel's decrypted URL / signing secret / mention. ctx.env is emptied so a stored channel with an
// unreadable URL can never fall back to (and misroute into) the .env webhook.

export async function sendViaChannel(channel: AlertChannel, msg: AlertMessage, account: AccountInfo): Promise<SendResult> {
  const plugin = await findPlugin(channel.pluginId);
  if (!plugin?.sendAlert) return { ok: false, permanent: true, error: `No alert plugin "${channel.pluginId}"` };
  const cfg = resolveChannelConfig(channel);
  if (!cfg.url) return { ok: false, permanent: true, error: cfg.error ?? "No webhook URL configured" };
  const base = await pluginContext(plugin, undefined, account);
  const config: Record<string, string> = { url: cfg.url, includeLinks: String(cfg.includeLinks) };
  if (cfg.signingSecret) config.signingSecret = cfg.signingSecret;
  if (cfg.mention) config.mention = cfg.mention;
  const ctx: PluginContext = { ...base, config, env: {}, now: clockNow() };
  return plugin.sendAlert(msg, ctx);
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

/** Where alert links point (APP_BASE_URL + page, account pinned). */
export function dashboardLink(page: string, accountId: string): string {
  const base = appConfig().baseUrl.replace(/\/+$/, "");
  return `${base}${page}?acct=${encodeURIComponent(accountId)}`;
}
