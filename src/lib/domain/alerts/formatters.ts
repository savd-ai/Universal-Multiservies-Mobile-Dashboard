import type { AlertChannelPlugin, AlertMessage } from "../contracts/alerts";
import type { SignalView } from "../contracts/anomaly";
export interface FormatOptions {
    mention?: string;
    includeLinks?: boolean;
}
const 曒壍: Record<string, string> = { critical: "🔴", warning: "🟠", info: "🟢" };
const 藁壍: Record<string, string> = { critical: "Critical", warning: "Warning", info: "Opportunity" };
const 劰壍 = "\u200B";
export const LIMITS = {
    slackHeader: 150,
    slackSection: 3000,
    slackBlocks: 50,
    slackSignals: 8,
    discordContent: 2000,
    discordEmbeds: 10,
    discordEmbedTotal: 6000,
    discordTitle: 256,
    discordDescription: 4096,
    discordFieldName: 256,
    discordFieldValue: 1024,
    teamsSignals: 8,
    teamsBytes: 27000,
    webhookSignals: 100,
} as const;
const 熟壍 = (邎壍: string, 嵽壍: number) => (邎壍.length <= 嵽壍 ? 邎壍 : `${邎壍.slice(0, Math.max(0, 嵽壍 - 1))}…`);
export function slackEscape(籬壍: string): string {
    return 籬壍.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/@(channel|here|everyone)/gi, `@${劰壍}$1`);
}
export function discordEscape(魛壍: string): string {
    return 魛壍.replace(/([\\*_~`|>[\]()])/g, "\\$1").replace(/@(everyone|here)/gi, `@${劰壍}$1`).replace(/<(@[!&]?|#)(\d+)>/g, `<${劰壍}$1$2>`);
}
export function teamsEscape(桊壍: string): string {
    return 桊壍.replace(/\]\(/g, `]${劰壍}(`).replace(/<(\/?)at>/gi, `<${劰壍}$1at>`);
}
function 蜹壍(吨壍: string): string {
    return 吨壍.replace(/@(everyone|here|channel)/gi, `@${劰壍}$1`);
}
export function slackMention(猗壍: string | undefined): string | null {
    const 鈆壍 = 猗壍?.trim();
    if (!鈆壍)
        return null;
    const 廵壍: Record<string, string> = { "@here": "<!here>", "@channel": "<!channel>", "@everyone": "<!everyone>", "<!here>": "<!here>", "<!channel>": "<!channel>", "<!everyone>": "<!everyone>" };
    const 緤壍 = 廵壍[鈆壍.toLowerCase()];
    if (緤壍)
        return 緤壍;
    if (/^<@[UW][A-Z0-9]{2,20}>$/.test(鈆壍) || /^<!subteam\^[A-Z0-9]{2,20}>$/.test(鈆壍))
        return 鈆壍;
    return slackEscape(鈆壍);
}
export function headline(鳓壍: AlertMessage): string {
    if (鳓壍.kind === "test")
        return "SAVD test alert — this channel is connected";
    if (鳓壍.kind === "digest")
        return `Daily digest · ${鳓壍.accountName}${鳓壍.digest ? ` · ${鳓壍.digest.date}` : ""}`;
    const 槂壍 = 鳓壍.signals.filter((袱壍) => 袱壍.severity === "critical").length;
    const 喠壍 = 鳓壍.signals.length;
    if (鳓壍.kind === "resolved")
        return `${喠壍} signal${喠壍 === 1 ? "" : "s"} resolved · ${鳓壍.accountName}`;
    return `${喠壍} new signal${喠壍 === 1 ? "" : "s"}${槂壍 ? ` (${槂壍} critical)` : ""} · ${鳓壍.accountName}`;
}
const 璏壍 = (鍾壍: SignalView, 恭壍: string) => 鍾壍.evidence.find((罜壍) => 罜壍.label === 恭壍)?.value ?? "";
function 鹋壍(欺壍: AlertMessage, 訩壍: SignalView): string {
    if (欺壍.kind === "resolved")
        return "Resolved";
    return 訩壍.changeContext?.verdict === "expected" ? "Expected" : (藁壍[訩壍.severity] ?? 訩壍.severity);
}
function 團壍(瘇壍: AlertMessage, 银壍: SignalView): string {
    return 瘇壍.kind === "resolved" ? "✅" : (曒壍[银壍.severity] ?? "");
}
const 懥壍 = (胔壍: AlertMessage) => `Alerts for ${胔壍.accountName} will be posted here: new and escalated anomalies, pacing warnings and the daily digest.`;
const 鿃壍 = (沲壍: string) => /^https?:\/\//i.test(沲壍);
export function plainTextAlert(计壍: AlertMessage): string {
    const 墐壍 = [headline(计壍)];
    if (计壍.kind === "test")
        墐壍.push(懥壍(计壍));
    if (计壍.kind === "digest" && 计壍.digest) {
        墐壍.push(计壍.digest.kpis.map((睿壍) => `${睿壍.label}: ${睿壍.value}${睿壍.delta ? ` (${睿壍.delta})` : ""}`).join(" · "));
        墐壍.push(`${计壍.digest.openSignals} open signals (${计壍.digest.critical} critical)`);
        if (计壍.digest.narrative)
            墐壍.push(计壍.digest.narrative);
    }
    for (const 陮壍 of 计壍.signals.slice(0, 10)) {
        墐壍.push(`${團壍(计壍, 陮壍)} ${鹋壍(计壍, 陮壍)} · ${蜹壍(陮壍.title)} — ${蜹壍(陮壍.entity.name)}`);
        if (计壍.kind !== "resolved")
            墐壍.push(`   Observed ${璏壍(陮壍, "Observed")} vs expected ${璏壍(陮壍, "Expected")}. ${蜹壍(陮壍.recommendation)}`);
    }
    if (计壍.signals.length > 10)
        墐壍.push(`…and ${计壍.signals.length - 10} more`);
    墐壍.push(计壍.dashboardUrl);
    return 墐壍.join("\n");
}
export function slackPayload(捝壍: AlertMessage, 艌壍: FormatOptions | string = {}) {
    const 伻壍: FormatOptions = typeof 艌壍 === "string" ? { mention: 艌壍 } : 艌壍;
    const 渪壍 = 伻壍.includeLinks !== false && 鿃壍(捝壍.dashboardUrl);
    const 贙壍: unknown[] = [{ type: "header", text: { type: "plain_text", text: 熟壍(headline(捝壍), LIMITS.slackHeader), emoji: true } }];
    const 娈壍 = slackMention(伻壍.mention);
    if (娈壍 && 捝壍.kind !== "test")
        贙壍.push({ type: "section", text: { type: "mrkdwn", text: 娈壍 } });
    贙壍.push({ type: "context", elements: [{ type: "mrkdwn", text: 熟壍(`${slackEscape(捝壍.accountName)} · ${捝壍.mode === "live" ? "live data" : "no live data"}`, 300) }] });
    if (捝壍.kind === "test")
        贙壍.push({ type: "section", text: { type: "mrkdwn", text: 熟壍(slackEscape(懥壍(捝壍)), LIMITS.slackSection) } });
    if (捝壍.kind === "digest" && 捝壍.digest) {
        const 磷壍 = 捝壍.digest.kpis.slice(0, 10).map((韦壍) => ({ type: "mrkdwn", text: 熟壍(`*${slackEscape(韦壍.label)}*\n${slackEscape(韦壍.value)}${韦壍.delta ? ` (${slackEscape(韦壍.delta)})` : ""}`, 2000) }));
        if (磷壍.length)
            贙壍.push({ type: "section", fields: 磷壍 });
        贙壍.push({ type: "context", elements: [{ type: "mrkdwn", text: `${捝壍.digest.openSignals} open signal${捝壍.digest.openSignals === 1 ? "" : "s"} · ${捝壍.digest.critical} critical` }] });
        if (捝壍.digest.narrative)
            贙壍.push({ type: "section", text: { type: "mrkdwn", text: 熟壍(`_${slackEscape(捝壍.digest.narrative)}_`, LIMITS.slackSection) } });
    }
    for (const 擕壍 of 捝壍.signals.slice(0, LIMITS.slackSignals)) {
        const 菄壍 = `${團壍(捝壍, 擕壍)} *${slackEscape(擕壍.title)}* — ${slackEscape(擕壍.entity.name)}`;
        const 傳壍 = 捝壍.kind === "resolved" ? "Back within the expected range." : `Observed *${slackEscape(璏壍(擕壍, "Observed"))}* vs expected ${slackEscape(璏壍(擕壍, "Expected"))}\n${slackEscape(擕壍.recommendation)}`;
        贙壍.push({ type: "section", text: { type: "mrkdwn", text: 熟壍(`${菄壍}\n${傳壍}`, LIMITS.slackSection) } });
    }
    if (捝壍.signals.length > LIMITS.slackSignals)
        贙壍.push({ type: "context", elements: [{ type: "mrkdwn", text: `…and ${捝壍.signals.length - LIMITS.slackSignals} more` }] });
    if (渪壍)
        贙壍.push({ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open dashboard" }, url: 熟壍(捝壍.dashboardUrl, 3000) }] });
    return { text: slackEscape(headline(捝壍)), blocks: 贙壍.slice(0, LIMITS.slackBlocks) };
}
export function teamsPayload(澢壍: AlertMessage, 躑壍: FormatOptions = {}) {
    const 宀壍 = 躑壍.includeLinks !== false && 鿃壍(澢壍.dashboardUrl);
    const 穯壍: unknown[] = [
        { type: "TextBlock", size: "Large", weight: "Bolder", wrap: true, text: 熟壍(teamsEscape(headline(澢壍)), 300) },
        { type: "TextBlock", isSubtle: true, spacing: "None", wrap: true, text: 熟壍(`${teamsEscape(澢壍.accountName)} · ${澢壍.mode === "live" ? "live data" : "no live data"}`, 300) },
    ];
    if (澢壍.kind === "test")
        穯壍.push({ type: "TextBlock", wrap: true, text: 懥壍(澢壍) });
    if (澢壍.kind === "digest" && 澢壍.digest) {
        穯壍.push({ type: "FactSet", facts: 澢壍.digest.kpis.slice(0, 12).map((饞壍) => ({ title: 熟壍(饞壍.label, 80), value: 熟壍(`${饞壍.value}${饞壍.delta ? ` (${饞壍.delta})` : ""}`, 120) })) });
        穯壍.push({ type: "TextBlock", wrap: true, isSubtle: true, text: `${澢壍.digest.openSignals} open signals · ${澢壍.digest.critical} critical` });
        if (澢壍.digest.narrative)
            穯壍.push({ type: "TextBlock", wrap: true, text: 熟壍(teamsEscape(澢壍.digest.narrative), 1500) });
    }
    const 晍壍 = (蔼壍: SignalView): unknown[] => [
        { type: "TextBlock", wrap: true, weight: "Bolder", spacing: "Medium", color: 澢壍.kind === "resolved" ? "Good" : 蔼壍.severity === "critical" ? "Attention" : 蔼壍.severity === "warning" ? "Warning" : "Good", text: 熟壍(`${鹋壍(澢壍, 蔼壍)} · ${teamsEscape(蔼壍.title)}`, 300) },
        { type: "TextBlock", wrap: true, isSubtle: true, spacing: "None", text: 熟壍(teamsEscape(蔼壍.entity.name), 200) },
        { type: "TextBlock", wrap: true, spacing: "Small", text: 澢壍.kind === "resolved" ? "Back within the expected range." : 熟壍(teamsEscape(`Observed ${璏壍(蔼壍, "Observed")} vs expected ${璏壍(蔼壍, "Expected")}. ${蔼壍.recommendation}`), 700) },
    ];
    const 别壍 = (焚壍: number) => {
        const 选壍 = [...穯壍, ...澢壍.signals.slice(0, 焚壍).flatMap(晍壍)];
        if (澢壍.signals.length > 焚壍)
            选壍.push({ type: "TextBlock", wrap: true, isSubtle: true, text: `…and ${澢壍.signals.length - 焚壍} more` });
        return {
            type: "message",
            attachments: [
                {
                    contentType: "application/vnd.microsoft.card.adaptive",
                    contentUrl: null,
                    content: {
                        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                        type: "AdaptiveCard",
                        version: "1.4",
                        msteams: { width: "Full" },
                        body: 选壍,
                        ...(宀壍 ? { actions: [{ type: "Action.OpenUrl", title: "Open dashboard", url: 澢壍.dashboardUrl }] } : {}),
                    },
                },
            ],
        };
    };
    let 峸壍 = Math.min(LIMITS.teamsSignals, 澢壍.signals.length);
    let 篧壍 = 别壍(峸壍);
    while (峸壍 > 0 && JSON.stringify(篧壍).length > LIMITS.teamsBytes)
        篧壍 = 别壍(--峸壍);
    return 篧壍;
}
interface DiscordEmbed {
    title: string;
    description: string;
    color: number;
    fields: {
        name: string;
        value: string;
        inline: boolean;
    }[];
    url?: string;
    timestamp?: string;
}
const 髖壍 = (柅壍: DiscordEmbed) => 柅壍.title.length + 柅壍.description.length + 柅壍.fields.reduce((蚴壍, 厣壍) => 蚴壍 + 厣壍.name.length + 厣壍.value.length, 0);
export function discordPayload(犒壍: AlertMessage, 醁壍: FormatOptions = {}) {
    const 幰壍 = 醁壍.includeLinks !== false && 鿃壍(犒壍.dashboardUrl);
    const 絟壍 = (鱎壍: SignalView) => (犒壍.kind === "resolved" ? 0x04bf9d : 鱎壍.severity === "critical" ? 0xd70015 : 鱎壍.severity === "warning" ? 0xc93400 : 0x04bf9d);
    const 椽壍: DiscordEmbed[] = [];
    if (犒壍.kind === "test")
        椽壍.push({ title: "Channel connected", description: 熟壍(discordEscape(懥壍(犒壍)), 1000), color: 0x04bf9d, fields: [] });
    if (犒壍.kind === "digest" && 犒壍.digest) {
        椽壍.push({
            title: 熟壍(`Daily digest · ${蜹壍(犒壍.accountName)}`, LIMITS.discordTitle),
            description: 熟壍(discordEscape(犒壍.digest.narrative ?? `${犒壍.digest.openSignals} open signals (${犒壍.digest.critical} critical)`), 1800),
            color: 0x04bf9d,
            fields: 犒壍.digest.kpis.slice(0, 12).map((蠬壍) => ({ name: 熟壍(discordEscape(蠬壍.label), LIMITS.discordFieldName), value: 熟壍(discordEscape(`${蠬壍.value}${蠬壍.delta ? ` (${蠬壍.delta})` : ""}`) || "—", LIMITS.discordFieldValue), inline: true })),
        });
    }
    for (const 唛壍 of 犒壍.signals) {
        椽壍.push({
            title: 熟壍(`${鹋壍(犒壍, 唛壍)} · ${蜹壍(唛壍.title)}`, LIMITS.discordTitle),
            description: 熟壍(犒壍.kind === "resolved" ? `${discordEscape(唛壍.entity.name)}\nBack within the expected range.` : `${discordEscape(唛壍.entity.name)}\n${discordEscape(唛壍.recommendation)}`, 1000),
            color: 絟壍(唛壍),
            fields: 犒壍.kind === "resolved" ? [] : 唛壍.evidence.slice(0, 4).map((琊壍) => ({ name: 熟壍(discordEscape(琊壍.label), LIMITS.discordFieldName), value: 熟壍(discordEscape(琊壍.value) || "—", LIMITS.discordFieldValue), inline: true })),
        });
    }
    const 鋹壍: DiscordEmbed[] = [];
    let 忨壍 = 0;
    for (const 绗壍 of 椽壍) {
        if (鋹壍.length >= LIMITS.discordEmbeds)
            break;
        const 鷆壍 = 髖壍(绗壍);
        if (忨壍 + 鷆壍 > LIMITS.discordEmbedTotal)
            break;
        忨壍 += 鷆壍;
        鋹壍.push({ ...绗壍, ...(幰壍 ? { url: 犒壍.dashboardUrl } : {}), timestamp: 犒壍.generatedAt });
    }
    const 檵壍 = 椽壍.length - 鋹壍.length;
    const 覤壍 = 熟壍(`${蜹壍(headline(犒壍))}${檵壍 > 0 ? `\n…and ${檵壍} more` : ""}${幰壍 ? `\n<${犒壍.dashboardUrl}>` : ""}`, LIMITS.discordContent);
    return { content: 覤壍, embeds: 鋹壍, allowed_mentions: { parse: [] as string[] } };
}
export function webhookPayload(嚓壍: AlertMessage, 疂壍: FormatOptions = {}) {
    return {
        type: `savd.alert.${嚓壍.kind}`,
        version: 1,
        account: { id: 嚓壍.accountId, name: 嚓壍.accountName },
        mode: 嚓壍.mode,
        generatedAt: 嚓壍.generatedAt,
        dashboardUrl: 疂壍.includeLinks === false ? null : 嚓壍.dashboardUrl,
        title: headline(嚓壍),
        digest: 嚓壍.digest ?? null,
        signals: 嚓壍.signals.slice(0, LIMITS.webhookSignals).map((鑱壍) => ({
            id: 鑱壍.id,
            severity: 鑱壍.severity,
            kind: 鑱壍.kind,
            polarity: 鑱壍.polarity,
            title: 鑱壍.title,
            entity: 鑱壍.entity,
            metric: 鑱壍.metric ?? null,
            observed: 鑱壍.observed,
            expected: 鑱壍.expected,
            changePct: 鑱壍.changePct,
            recommendation: 鑱壍.recommendation,
            status: 鑱壍.status,
            window: 鑱壍.window,
        })),
    };
}
export function formatAlertPayload(慠壍: AlertChannelPlugin, 聏壍: AlertMessage, 鼾壍: FormatOptions = {}): unknown {
    switch (慠壍) {
        case "slack":
            return slackPayload(聏壍, 鼾壍);
        case "teams":
            return teamsPayload(聏壍, 鼾壍);
        case "discord":
            return discordPayload(聏壍, 鼾壍);
        case "webhook":
            return webhookPayload(聏壍, 鼾壍);
    }
}
