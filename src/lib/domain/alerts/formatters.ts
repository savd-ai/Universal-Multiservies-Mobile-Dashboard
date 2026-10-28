import type { AlertChannelPlugin, AlertMessage } from "../contracts/alerts";
import type { SignalView } from "../contracts/anomaly";
export interface FormatOptions {
    mention?: string;
    includeLinks?: boolean;
}
const SEV_ICON: Record<string, string> = { critical: "🔴", warning: "🟠", info: "🟢" };
const SEV_LABEL: Record<string, string> = { critical: "Critical", warning: "Warning", info: "Opportunity" };
const ZWSP = "\u200B";
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
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1))}…`);
export function slackEscape(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/@(channel|here|everyone)/gi, `@${ZWSP}$1`);
}
export function discordEscape(s: string): string {
    return s.replace(/([\\*_~`|>[\]()])/g, "\\$1").replace(/@(everyone|here)/gi, `@${ZWSP}$1`).replace(/<(@[!&]?|#)(\d+)>/g, `<${ZWSP}$1$2>`);
}
export function teamsEscape(s: string): string {
    return s.replace(/\]\(/g, `]${ZWSP}(`).replace(/<(\/?)at>/gi, `<${ZWSP}$1at>`);
}
function plainEscape(s: string): string {
    return s.replace(/@(everyone|here|channel)/gi, `@${ZWSP}$1`);
}
export function slackMention(mention: string | undefined): string | null {
    const m = mention?.trim();
    if (!m)
        return null;
    const special: Record<string, string> = { "@here": "<!here>", "@channel": "<!channel>", "@everyone": "<!everyone>", "<!here>": "<!here>", "<!channel>": "<!channel>", "<!everyone>": "<!everyone>" };
    const s = special[m.toLowerCase()];
    if (s)
        return s;
    if (/^<@[UW][A-Z0-9]{2,20}>$/.test(m) || /^<!subteam\^[A-Z0-9]{2,20}>$/.test(m))
        return m;
    return slackEscape(m);
}
export function headline(msg: AlertMessage): string {
    if (msg.kind === "test")
        return "SAVD test alert — this channel is connected";
    if (msg.kind === "digest")
        return `Daily digest · ${msg.accountName}${msg.digest ? ` · ${msg.digest.date}` : ""}`;
    const crit = msg.signals.filter((s) => s.severity === "critical").length;
    const n = msg.signals.length;
    if (msg.kind === "resolved")
        return `${n} signal${n === 1 ? "" : "s"} resolved · ${msg.accountName}`;
    return `${n} new signal${n === 1 ? "" : "s"}${crit ? ` (${crit} critical)` : ""} · ${msg.accountName}`;
}
const evidence = (s: SignalView, label: string) => s.evidence.find((e) => e.label === label)?.value ?? "";
function sevLabel(msg: AlertMessage, s: SignalView): string {
    if (msg.kind === "resolved")
        return "Resolved";
    return s.changeContext?.verdict === "expected" ? "Expected" : (SEV_LABEL[s.severity] ?? s.severity);
}
function sevIcon(msg: AlertMessage, s: SignalView): string {
    return msg.kind === "resolved" ? "✅" : (SEV_ICON[s.severity] ?? "");
}
const TEST_TEXT = (msg: AlertMessage) => `Alerts for ${msg.accountName} will be posted here: new and escalated anomalies, pacing warnings and the daily digest.`;
const isHttpUrl = (u: string) => /^https?:\/\//i.test(u);
export function plainTextAlert(msg: AlertMessage): string {
    const lines = [headline(msg)];
    if (msg.kind === "test")
        lines.push(TEST_TEXT(msg));
    if (msg.kind === "digest" && msg.digest) {
        lines.push(msg.digest.kpis.map((k) => `${k.label}: ${k.value}${k.delta ? ` (${k.delta})` : ""}`).join(" · "));
        lines.push(`${msg.digest.openSignals} open signals (${msg.digest.critical} critical)`);
        if (msg.digest.narrative)
            lines.push(msg.digest.narrative);
    }
    for (const s of msg.signals.slice(0, 10)) {
        lines.push(`${sevIcon(msg, s)} ${sevLabel(msg, s)} · ${plainEscape(s.title)} — ${plainEscape(s.entity.name)}`);
        if (msg.kind !== "resolved")
            lines.push(`   Observed ${evidence(s, "Observed")} vs expected ${evidence(s, "Expected")}. ${plainEscape(s.recommendation)}`);
    }
    if (msg.signals.length > 10)
        lines.push(`…and ${msg.signals.length - 10} more`);
    lines.push(msg.dashboardUrl);
    return lines.join("\n");
}
export function slackPayload(msg: AlertMessage, opts: FormatOptions | string = {}) {
    const o: FormatOptions = typeof opts === "string" ? { mention: opts } : opts;
    const links = o.includeLinks !== false && isHttpUrl(msg.dashboardUrl);
    const blocks: unknown[] = [{ type: "header", text: { type: "plain_text", text: clip(headline(msg), LIMITS.slackHeader), emoji: true } }];
    const mention = slackMention(o.mention);
    if (mention && msg.kind !== "test")
        blocks.push({ type: "section", text: { type: "mrkdwn", text: mention } });
    blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: clip(`${slackEscape(msg.accountName)} · ${msg.mode === "live" ? "live data" : "no live data"}`, 300) }] });
    if (msg.kind === "test")
        blocks.push({ type: "section", text: { type: "mrkdwn", text: clip(slackEscape(TEST_TEXT(msg)), LIMITS.slackSection) } });
    if (msg.kind === "digest" && msg.digest) {
        const fields = msg.digest.kpis.slice(0, 10).map((k) => ({ type: "mrkdwn", text: clip(`*${slackEscape(k.label)}*\n${slackEscape(k.value)}${k.delta ? ` (${slackEscape(k.delta)})` : ""}`, 2000) }));
        if (fields.length)
            blocks.push({ type: "section", fields });
        blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `${msg.digest.openSignals} open signal${msg.digest.openSignals === 1 ? "" : "s"} · ${msg.digest.critical} critical` }] });
        if (msg.digest.narrative)
            blocks.push({ type: "section", text: { type: "mrkdwn", text: clip(`_${slackEscape(msg.digest.narrative)}_`, LIMITS.slackSection) } });
    }
    for (const s of msg.signals.slice(0, LIMITS.slackSignals)) {
        const head = `${sevIcon(msg, s)} *${slackEscape(s.title)}* — ${slackEscape(s.entity.name)}`;
        const body = msg.kind === "resolved" ? "Back within the expected range." : `Observed *${slackEscape(evidence(s, "Observed"))}* vs expected ${slackEscape(evidence(s, "Expected"))}\n${slackEscape(s.recommendation)}`;
        blocks.push({ type: "section", text: { type: "mrkdwn", text: clip(`${head}\n${body}`, LIMITS.slackSection) } });
    }
    if (msg.signals.length > LIMITS.slackSignals)
        blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `…and ${msg.signals.length - LIMITS.slackSignals} more` }] });
    if (links)
        blocks.push({ type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open dashboard" }, url: clip(msg.dashboardUrl, 3000) }] });
    return { text: slackEscape(headline(msg)), blocks: blocks.slice(0, LIMITS.slackBlocks) };
}
export function teamsPayload(msg: AlertMessage, opts: FormatOptions = {}) {
    const links = opts.includeLinks !== false && isHttpUrl(msg.dashboardUrl);
    const head: unknown[] = [
        { type: "TextBlock", size: "Large", weight: "Bolder", wrap: true, text: clip(teamsEscape(headline(msg)), 300) },
        { type: "TextBlock", isSubtle: true, spacing: "None", wrap: true, text: clip(`${teamsEscape(msg.accountName)} · ${msg.mode === "live" ? "live data" : "no live data"}`, 300) },
    ];
    if (msg.kind === "test")
        head.push({ type: "TextBlock", wrap: true, text: TEST_TEXT(msg) });
    if (msg.kind === "digest" && msg.digest) {
        head.push({ type: "FactSet", facts: msg.digest.kpis.slice(0, 12).map((k) => ({ title: clip(k.label, 80), value: clip(`${k.value}${k.delta ? ` (${k.delta})` : ""}`, 120) })) });
        head.push({ type: "TextBlock", wrap: true, isSubtle: true, text: `${msg.digest.openSignals} open signals · ${msg.digest.critical} critical` });
        if (msg.digest.narrative)
            head.push({ type: "TextBlock", wrap: true, text: clip(teamsEscape(msg.digest.narrative), 1500) });
    }
    const signalBlocks = (s: SignalView): unknown[] => [
        { type: "TextBlock", wrap: true, weight: "Bolder", spacing: "Medium", color: msg.kind === "resolved" ? "Good" : s.severity === "critical" ? "Attention" : s.severity === "warning" ? "Warning" : "Good", text: clip(`${sevLabel(msg, s)} · ${teamsEscape(s.title)}`, 300) },
        { type: "TextBlock", wrap: true, isSubtle: true, spacing: "None", text: clip(teamsEscape(s.entity.name), 200) },
        { type: "TextBlock", wrap: true, spacing: "Small", text: msg.kind === "resolved" ? "Back within the expected range." : clip(teamsEscape(`Observed ${evidence(s, "Observed")} vs expected ${evidence(s, "Expected")}. ${s.recommendation}`), 700) },
    ];
    const build = (count2: number) => {
        const body = [...head, ...msg.signals.slice(0, count2).flatMap(signalBlocks)];
        if (msg.signals.length > count2)
            body.push({ type: "TextBlock", wrap: true, isSubtle: true, text: `…and ${msg.signals.length - count2} more` });
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
                        body,
                        ...(links ? { actions: [{ type: "Action.OpenUrl", title: "Open dashboard", url: msg.dashboardUrl }] } : {}),
                    },
                },
            ],
        };
    };
    let count = Math.min(LIMITS.teamsSignals, msg.signals.length);
    let card = build(count);
    while (count > 0 && JSON.stringify(card).length > LIMITS.teamsBytes)
        card = build(--count);
    return card;
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
const embedSize = (e: DiscordEmbed) => e.title.length + e.description.length + e.fields.reduce((s, f) => s + f.name.length + f.value.length, 0);
export function discordPayload(msg: AlertMessage, opts: FormatOptions = {}) {
    const links = opts.includeLinks !== false && isHttpUrl(msg.dashboardUrl);
    const color = (s: SignalView) => (msg.kind === "resolved" ? 0x04bf9d : s.severity === "critical" ? 0xd70015 : s.severity === "warning" ? 0xc93400 : 0x04bf9d);
    const candidates: DiscordEmbed[] = [];
    if (msg.kind === "test")
        candidates.push({ title: "Channel connected", description: clip(discordEscape(TEST_TEXT(msg)), 1000), color: 0x04bf9d, fields: [] });
    if (msg.kind === "digest" && msg.digest) {
        candidates.push({
            title: clip(`Daily digest · ${plainEscape(msg.accountName)}`, LIMITS.discordTitle),
            description: clip(discordEscape(msg.digest.narrative ?? `${msg.digest.openSignals} open signals (${msg.digest.critical} critical)`), 1800),
            color: 0x04bf9d,
            fields: msg.digest.kpis.slice(0, 12).map((k) => ({ name: clip(discordEscape(k.label), LIMITS.discordFieldName), value: clip(discordEscape(`${k.value}${k.delta ? ` (${k.delta})` : ""}`) || "—", LIMITS.discordFieldValue), inline: true })),
        });
    }
    for (const s of msg.signals) {
        candidates.push({
            title: clip(`${sevLabel(msg, s)} · ${plainEscape(s.title)}`, LIMITS.discordTitle),
            description: clip(msg.kind === "resolved" ? `${discordEscape(s.entity.name)}\nBack within the expected range.` : `${discordEscape(s.entity.name)}\n${discordEscape(s.recommendation)}`, 1000),
            color: color(s),
            fields: msg.kind === "resolved" ? [] : s.evidence.slice(0, 4).map((e) => ({ name: clip(discordEscape(e.label), LIMITS.discordFieldName), value: clip(discordEscape(e.value) || "—", LIMITS.discordFieldValue), inline: true })),
        });
    }
    const embeds: DiscordEmbed[] = [];
    let total = 0;
    for (const e of candidates) {
        if (embeds.length >= LIMITS.discordEmbeds)
            break;
        const size = embedSize(e);
        if (total + size > LIMITS.discordEmbedTotal)
            break;
        total += size;
        embeds.push({ ...e, ...(links ? { url: msg.dashboardUrl } : {}), timestamp: msg.generatedAt });
    }
    const omitted = candidates.length - embeds.length;
    const content = clip(`${plainEscape(headline(msg))}${omitted > 0 ? `\n…and ${omitted} more` : ""}${links ? `\n<${msg.dashboardUrl}>` : ""}`, LIMITS.discordContent);
    return { content, embeds, allowed_mentions: { parse: [] as string[] } };
}
export function webhookPayload(msg: AlertMessage, opts: FormatOptions = {}) {
    return {
        type: `savd.alert.${msg.kind}`,
        version: 1,
        account: { id: msg.accountId, name: msg.accountName },
        mode: msg.mode,
        generatedAt: msg.generatedAt,
        dashboardUrl: opts.includeLinks === false ? null : msg.dashboardUrl,
        title: headline(msg),
        digest: msg.digest ?? null,
        signals: msg.signals.slice(0, LIMITS.webhookSignals).map((s) => ({
            id: s.id,
            severity: s.severity,
            kind: s.kind,
            polarity: s.polarity,
            title: s.title,
            entity: s.entity,
            metric: s.metric ?? null,
            observed: s.observed,
            expected: s.expected,
            changePct: s.changePct,
            recommendation: s.recommendation,
            status: s.status,
            window: s.window,
        })),
    };
}
export function formatAlertPayload(pluginId: AlertChannelPlugin, msg: AlertMessage, opts: FormatOptions = {}): unknown {
    switch (pluginId) {
        case "slack":
            return slackPayload(msg, opts);
        case "teams":
            return teamsPayload(msg, opts);
        case "discord":
            return discordPayload(msg, opts);
        case "webhook":
            return webhookPayload(msg, opts);
    }
}
