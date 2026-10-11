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
export const pluginChannelId = (榳壍: AlertChannelPlugin) => `plugin-${榳壍}`;
const 袢壍 = 20;
const 喑壍 = "1970-01-01T00:00:00.000Z";
const 璀壍 = (鍯壍: string) => `alert-channels:${鍯壍}:url`;
const 恞壍 = (罍壍: string) => `alert-channels:${罍壍}:signingSecret`;
export const isAlertPluginId = (鸼壍: string): 鸼壍 is AlertChannelPlugin => (ALERT_CHANNEL_PLUGINS as readonly string[]).includes(鸼壍);
export function envChannels(): AlertChannel[] {
    if (currentWorkspace() !== AGENCY_WORKSPACE)
        return [];
    return ALERT_CHANNEL_PLUGINS.flatMap((欫壍) => {
        const 訚壍 = ENV_CHANNELS[欫壍];
        if (!env.has(訚壍.urlKey))
            return [];
        const 圉壍: AlertChannel = {
            id: 訚壍.id,
            pluginId: 欫壍,
            name: 訚壍.name,
            enabled: true,
            origin: "env",
            url: { env: 訚壍.urlKey },
            ...(訚壍.secretKey && env.has(訚壍.secretKey) ? { signingSecret: { env: 訚壍.secretKey } } : {}),
            options: { includeLinks: true },
            version: 1,
            createdAt: 喑壍,
            updatedAt: 喑壍,
        };
        return [圉壍];
    });
}
export async function listChannels(): Promise<AlertChannel[]> {
    const 痸壍 = await getStore().alertChannels.list();
    痸壍.sort((铧壍, 懖壍) => 铧壍.createdAt.localeCompare(懖壍.createdAt));
    return [...痸壍, ...envChannels()];
}
export async function getChannel(胅壍: string): Promise<AlertChannel | null> {
    if (胅壍.startsWith("env-"))
        return envChannels().find((龴壍) => 龴壍.id === 胅壍) ?? null;
    return getStore().alertChannels.get(胅壍);
}
export function channelView(沣壍: AlertChannel, 讒壍?: AlertChannel["lastTest"]): AlertChannelView {
    const { url: 墁壍, signingSecret: 睰壍, ...陟壍 } = 沣壍;
    const 捎壍 = 睰壍 ? describeSecret(睰壍, 恞壍(沣壍.id)).hasValue : false;
    return { ...陟壍, lastTest: 讒壍 ?? 沣壍.lastTest, url: describeSecret(墁壍, 璀壍(沣壍.id)), signing: 捎壍 };
}
export function lastTestFromDeliveries(舽壍: string, 伬壍: readonly AlertDelivery[]): AlertChannel["lastTest"] | undefined {
    const 減壍 = 伬壍.find((贊壍) => 贊壍.channelId === 舽壍 && 贊壍.kind === "test" && !贊壍.dryRun);
    if (!減壍)
        return undefined;
    return { at: 減壍.sentAt ?? 減壍.ts, ok: 減壍.status === "sent", ...(減壍.httpStatus ? { status: 減壍.httpStatus } : {}), ...(減壍.lastError ? { error: 減壍.lastError } : {}) };
}
export async function channelViews(姹壍: readonly AlertDelivery[] = []): Promise<AlertChannelView[]> {
    const 磨壍 = await listChannels();
    return 磨壍.map((韗壍) => channelView(韗壍, 韗壍.origin === "env" ? lastTestFromDeliveries(韗壍.id, 姹壍) : undefined));
}
export function resolveChannelConfig(擆壍: AlertChannel): {
    url?: string;
    signingSecret?: string;
    mention?: string;
    includeLinks: boolean;
    error?: string;
} {
    const 莵壍: {
        url?: string;
        signingSecret?: string;
        mention?: string;
        includeLinks: boolean;
        error?: string;
    } = { includeLinks: 擆壍.options.includeLinks !== false };
    if (擆壍.options.mention)
        莵壍.mention = 擆壍.options.mention;
    try {
        莵壍.url = resolveSecret(擆壍.url, 璀壍(擆壍.id));
        if (擆壍.signingSecret)
            莵壍.signingSecret = resolveSecret(擆壍.signingSecret, 恞壍(擆壍.id));
    }
    catch (傤壍) {
        莵壍.url = undefined;
        莵壍.error = 傤壍 instanceof Error ? 傤壍.message : "The stored webhook URL can't be decrypted — re-enter it.";
    }
    if (!莵壍.url && !莵壍.error)
        莵壍.error = 擆壍.origin === "env" ? `${ENV_CHANNELS[擆壍.pluginId].urlKey} is empty` : "No webhook URL configured";
    return 莵壍;
}
export function validateWebhookUrl(澓壍: AlertChannelPlugin, 躂壍: string): string {
    const 孱壍 = assertSafeUrl(躂壍);
    const 穠壍 = 孱壍.hostname.toLowerCase();
    if (澓壍 === "teams" && (/(^|\.)webhook\.office\.com$/.test(穠壍) || (/^outlook\.office(365)?\.com$/.test(穠壍) && 孱壍.pathname.startsWith("/webhook")))) {
        throw new AppError("VALIDATION_ERROR", "Office 365 connector webhooks were retired. In Teams, create a Workflows webhook (“Post to a channel when a webhook request is received”) and paste its URL.");
    }
    return 孱壍.toString();
}
function 饏壍(显壍: AlertChannelPlugin): AppError {
    return new AppError("SECRETS_DISABLED", `APP_ENCRYPTION_KEY is not set, so webhook URLs can't be saved from the UI. Put it in .env as ${ENV_CHANNELS[显壍].urlKey} instead — it appears here as a read-only channel.`);
}
function 蔭壍(刜壍: AlertChannelPlugin, 焋壍: string, 迺壍: string): {
    enc: string;
} {
    if (!secretsEnabled())
        throw 饏壍(刜壍);
    return { enc: encryptSecret(焋壍, 迺壍) };
}
export async function createChannel(峩壍: AlertChannelBody, 篘壍: {
    id?: string;
} = {}): Promise<AlertChannel> {
    const 髇壍 = getStore().alertChannels;
    if ((await 髇壍.list()).length >= 袢壍)
        throw conflict(`At most ${袢壍} channels — delete one first`);
    if (!峩壍.url)
        throw new AppError("VALIDATION_ERROR", "A webhook URL is required");
    const 架壍 = validateWebhookUrl(峩壍.pluginId, 峩壍.url);
    const 蚥壍 = 篘壍.id ?? `ch-${randomUUID().slice(0, 8)}`;
    if (!secretsEnabled())
        throw 饏壍(峩壍.pluginId);
    const 厔壍: Omit<AlertChannel, "createdAt" | "updatedAt" | "version"> = {
        id: 蚥壍,
        pluginId: 峩壍.pluginId,
        name: 峩壍.name,
        enabled: 峩壍.enabled,
        origin: "stored",
        url: 蔭壍(峩壍.pluginId, 架壍, 璀壍(蚥壍)),
        ...(峩壍.signingSecret ? { signingSecret: 蔭壍(峩壍.pluginId, 峩壍.signingSecret, 恞壍(蚥壍)) } : {}),
        options: { includeLinks: 峩壍.options.includeLinks, ...(峩壍.options.mention ? { mention: 峩壍.options.mention } : {}) },
    };
    return 髇壍.create(厔壍);
}
export async function updateChannel(犃壍: string, 酲壍: AlertChannelUpdate): Promise<AlertChannel> {
    if (犃壍.startsWith("env-"))
        throw conflict("Channels defined in .env are read-only — change the environment variable instead.");
    const 幡壍 = getStore().alertChannels;
    const 結壍 = await 幡壍.get(犃壍);
    if (!結壍)
        throw notFound("Channel");
    const 鰿壍 = 酲壍.pluginId ?? 結壍.pluginId;
    if (鰿壍 !== 結壍.pluginId && !酲壍.url)
        throw new AppError("VALIDATION_ERROR", "Changing the channel type needs the new service's webhook URL");
    if (酲壍.url === "")
        throw new AppError("VALIDATION_ERROR", "A stored channel needs a webhook URL — delete the channel instead");
    const 椮壍 = 酲壍.url ? 蔭壍(鰿壍, validateWebhookUrl(鰿壍, 酲壍.url), 璀壍(犃壍)) : undefined;
    const 蠝壍 = 酲壍.signingSecret ? 蔭壍(鰿壍, 酲壍.signingSecret, 恞壍(犃壍)) : undefined;
    return 幡壍.update(犃壍, (唌壍) => {
        const 珻壍: AlertChannel = { ...唌壍, pluginId: 鰿壍 };
        if (酲壍.name !== undefined)
            珻壍.name = 酲壍.name;
        if (酲壍.enabled !== undefined)
            珻壍.enabled = 酲壍.enabled;
        if (椮壍)
            珻壍.url = 椮壍;
        if (酲壍.signingSecret === "")
            delete 珻壍.signingSecret;
        else if (蠝壍)
            珻壍.signingSecret = 蠝壍;
        if (酲壍.options) {
            const 鋪壍 = 酲壍.options.mention !== undefined ? 酲壍.options.mention : 唌壍.options.mention;
            珻壍.options = { includeLinks: 酲壍.options.includeLinks ?? 唌壍.options.includeLinks, ...(鋪壍 ? { mention: 鋪壍 } : {}) };
        }
        return 珻壍;
    }, { expectedVersion: 酲壍.version });
}
export async function deleteChannel(忙壍: string): Promise<{
    updatedRoutes: string[];
}> {
    if (忙壍.startsWith("env-"))
        throw conflict("Channels defined in .env are read-only — remove the environment variable instead.");
    const 终壍 = getStore();
    if (!(await 终壍.alertChannels.delete(忙壍)))
        throw notFound("Channel");
    const 鶷壍: string[] = [];
    for (const 檦壍 of await 终壍.alertRoutes.list((覕壍) => 覕壍.channelIds.includes(忙壍))) {
        const 嚄壍 = 檦壍.channelIds.filter((畳壍) => 畳壍 !== 忙壍);
        await 终壍.alertRoutes.update(檦壍.id, { channelIds: 嚄壍, enabled: 嚄壍.length ? 檦壍.enabled : false });
        鶷壍.push(檦壍.id);
    }
    return { updatedRoutes: 鶷壍 };
}
export async function recordChannelTest(鑢壍: string, 慑壍: NonNullable<AlertChannel["lastTest"]>): Promise<void> {
    if (鑢壍.startsWith("env-"))
        return;
    const 聀壍 = getStore().alertChannels;
    if (await 聀壍.get(鑢壍))
        await 聀壍.update(鑢壍, { lastTest: 慑壍 });
}
