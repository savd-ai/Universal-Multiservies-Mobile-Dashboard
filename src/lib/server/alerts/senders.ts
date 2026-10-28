import "server-only";
import { createHmac } from "node:crypto";
import type { AlertChannelPlugin, AlertMessage } from "@/lib/domain/contracts/alerts";
import { formatAlertPayload, type FormatOptions } from "@/lib/domain/alerts/formatters";
import { AppError } from "../http/errors";
import { redact } from "../log";
import type { SendContext, SendResult } from "./send-types";
function scrub(text: string, url: string | undefined): string {
    const out = url ? text.split(url).join("[webhook-url]") : text;
    return redact(out);
}
async function postJson(ctx: SendContext, url: string | undefined, body: string, extraHeaders: Record<string, string> = {}): Promise<SendResult> {
    const preview = redact(body).slice(0, 2048);
    if (!url)
        return { ok: false, permanent: true, error: "No webhook URL configured", preview };
    try {
        const res = await ctx.fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "SAVD-Ads-Intelligence/1.0", ...extraHeaders }, body, timeoutMs: 10000, maxBytes: 256 * 1024 });
        const text = await res.text().catch(() => "");
        if (res.ok)
            return { ok: true, status: res.status, preview };
        const retryAfter = Number(res.headers.get("retry-after") ?? "");
        return {
            ok: false,
            status: res.status,
            permanent: res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 408,
            retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined,
            error: scrub(`HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`, url),
            preview,
        };
    }
    catch (err) {
        const blocked = err instanceof AppError && err.code === "SSRF_BLOCKED";
        return { ok: false, permanent: blocked, error: scrub(err instanceof Error ? err.message : String(err), url), preview };
    }
}
function formatOptions(ctx: SendContext): FormatOptions {
    return { mention: ctx.config.mention, includeLinks: ctx.config.includeLinks !== "false" };
}
function render(pluginId: AlertChannelPlugin, msg: AlertMessage, ctx: SendContext): string {
    return JSON.stringify(formatAlertPayload(pluginId, msg, formatOptions(ctx)));
}
export const sendSlack = (msg: AlertMessage, ctx: SendContext) => postJson(ctx, ctx.config.url ?? ctx.env.SLACK_WEBHOOK_URL, render("slack", msg, ctx));
export const sendTeams = (msg: AlertMessage, ctx: SendContext) => postJson(ctx, ctx.config.url ?? ctx.env.TEAMS_WEBHOOK_URL, render("teams", msg, ctx));
export const sendDiscord = (msg: AlertMessage, ctx: SendContext) => postJson(ctx, ctx.config.url ?? ctx.env.DISCORD_WEBHOOK_URL, render("discord", msg, ctx));
export function signWebhook(secret: string, timestamp: string, body: string): string {
    return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}
export async function sendWebhook(msg: AlertMessage, ctx: SendContext): Promise<SendResult> {
    const body = render("webhook", msg, ctx);
    const secret = ctx.config.signingSecret ?? ctx.env.ALERT_WEBHOOK_SECRET;
    const headers: Record<string, string> = { "X-SAVD-Event": `savd.alert.${msg.kind}` };
    if (secret) {
        const ts = String(Math.floor(ctx.now.getTime() / 1000));
        headers["X-SAVD-Timestamp"] = ts;
        headers["X-SAVD-Signature"] = signWebhook(secret, ts, body);
    }
    return postJson(ctx, ctx.config.url ?? ctx.env.ALERT_WEBHOOK_URL, body, headers);
}
