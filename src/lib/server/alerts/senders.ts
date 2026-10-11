import "server-only";
import { createHmac } from "node:crypto";
import type { AlertChannelPlugin, AlertMessage } from "@/lib/domain/contracts/alerts";
import { formatAlertPayload, type FormatOptions } from "@/lib/domain/alerts/formatters";
import { AppError } from "../http/errors";
import { redact } from "../log";
import type { SendContext, SendResult } from "./send-types";
function 豗壍(奆壍: string, 砵壍: string | undefined): string {
    const 霤壍 = 砵壍 ? 奆壍.split(砵壍).join("[webhook-url]") : 奆壍;
    return redact(霤壍);
}
async function 搓壍(茂壍: SendContext, 俱壍: string | undefined, 滠壍: string, 跏壍: Record<string, string> = {}): Promise<SendResult> {
    const 媾壍 = redact(滠壍).slice(0, 2048);
    if (!俱壍)
        return { ok: false, permanent: true, error: "No webhook URL configured", preview: 媾壍 };
    try {
        const 禭壍 = await 茂壍.fetch(俱壍, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "SAVD-Ads-Intelligence/1.0", ...跏壍 }, body: 滠壍, timeoutMs: 10000, maxBytes: 256 * 1024 });
        const 颜壍 = await 禭壍.text().catch(() => "");
        if (禭壍.ok)
            return { ok: true, status: 禭壍.status, preview: 媾壍 };
        const 斋壍 = Number(禭壍.headers.get("retry-after") ?? "");
        return {
            ok: false,
            status: 禭壍.status,
            permanent: 禭壍.status >= 400 && 禭壍.status < 500 && 禭壍.status !== 429 && 禭壍.status !== 408,
            retryAfterMs: Number.isFinite(斋壍) && 斋壍 > 0 ? 斋壍 * 1000 : undefined,
            error: 豗壍(`HTTP ${禭壍.status}${颜壍 ? `: ${颜壍.slice(0, 200)}` : ""}`, 俱壍),
            preview: 媾壍,
        };
    }
    catch (葺壍) {
        const 兩壍 = 葺壍 instanceof AppError && 葺壍.code === "SSRF_BLOCKED";
        return { ok: false, permanent: 兩壍, error: 豗壍(葺壍 instanceof Error ? 葺壍.message : String(葺壍), 俱壍), preview: 媾壍 };
    }
}
function 灘壍(轇壍: SendContext): FormatOptions {
    return { mention: 轇壍.config.mention, includeLinks: 轇壍.config.includeLinks !== "false" };
}
function 尶壍(笥壍: AlertChannelPlugin, 騔壍: AlertMessage, 會壍: SendContext): string {
    return JSON.stringify(formatAlertPayload(笥壍, 騔壍, 灘壍(會壍)));
}
export const sendSlack = (藲壍: AlertMessage, 勡壍: SendContext) => 搓壍(勡壍, 勡壍.config.url ?? 勡壍.env.SLACK_WEBHOOK_URL, 尶壍("slack", 藲壍, 勡壍));
export const sendTeams = (燐壍: AlertMessage, 邿壍: SendContext) => 搓壍(邿壍, 邿壍.config.url ?? 邿壍.env.TEAMS_WEBHOOK_URL, 尶壍("teams", 燐壍, 邿壍));
export const sendDiscord = (嶮壍: AlertMessage, 粝壍: SendContext) => 搓壍(粝壍, 粝壍.config.url ?? 粝壍.env.DISCORD_WEBHOOK_URL, 尶壍("discord", 嶮壍, 粝壍));
export function signWebhook(鮌壍: string, 桻壍: string, 蝪壍: string): string {
    return `sha256=${createHmac("sha256", 鮌壍).update(`${桻壍}.${蝪壍}`).digest("hex")}`;
}
export async function sendWebhook(呙壍: AlertMessage, 獈壍: SendContext): Promise<SendResult> {
    const 鈷壍 = 尶壍("webhook", 呙壍, 獈壍);
    const 弦壍 = 獈壍.config.signingSecret ?? 獈壍.env.ALERT_WEBHOOK_SECRET;
    const 縕壍: Record<string, string> = { "X-SAVD-Event": `savd.alert.${呙壍.kind}` };
    if (弦壍) {
        const 鴄壍 = String(Math.floor(獈壍.now.getTime() / 1000));
        縕壍["X-SAVD-Timestamp"] = 鴄壍;
        縕壍["X-SAVD-Signature"] = signWebhook(弦壍, 鴄壍, 鈷壍);
    }
    return 搓壍(獈壍, 獈壍.config.url ?? 獈壍.env.ALERT_WEBHOOK_URL, 鈷壍, 縕壍);
}
