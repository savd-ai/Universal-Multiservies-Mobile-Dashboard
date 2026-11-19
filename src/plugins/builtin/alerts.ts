import "server-only";
import { definePlugin, type PluginRuntime } from "@/lib/server/plugins/define";
import { sendDiscord, sendSlack, sendTeams, sendWebhook } from "@/lib/server/alerts/senders";

// Live alert channels (the only live connectors in v1). Payload formatting lives in domain/alerts/formatters.

export const BUILTIN_ALERT_PLUGINS: PluginRuntime[] = [
  definePlugin({
    manifest: {
      id: "slack",
      name: "Slack",
      version: "1.0.0",
      kind: "builtin",
      category: "alerts",
      description: "Push critical anomalies, pacing warnings and a daily digest to a channel.",
      icon: { abbr: "SL" },
      capabilities: ["alerts.send"],
      live: true,
      env: [{ key: "SLACK_WEBHOOK_URL", label: "Incoming webhook URL", secret: true, required: true }],
      configFields: [{ key: "url", label: "Webhook URL", type: "secret", required: true, placeholder: "https://hooks.slack.com/services/…" }, { key: "mention", label: "Mention (optional)", type: "text", required: false, placeholder: "@here" }],
      refresh: "manual",
    },
    sendAlert: (msg, ctx) => sendSlack(msg, ctx),
  }),
  definePlugin({
    manifest: {
      id: "teams",
      name: "Microsoft Teams",
      version: "1.0.0",
      kind: "builtin",
      category: "alerts",
      description: "Adaptive Card alerts through a Teams Workflows webhook.",
      icon: { abbr: "MT" },
      capabilities: ["alerts.send"],
      live: true,
      env: [{ key: "TEAMS_WEBHOOK_URL", label: "Workflows webhook URL", secret: true, required: true }],
      configFields: [{ key: "url", label: "Workflows webhook URL", type: "secret", required: true, placeholder: "https://…logic.azure.com/…" }],
      refresh: "manual",
    },
    sendAlert: (msg, ctx) => sendTeams(msg, ctx),
  }),
  definePlugin({
    manifest: {
      id: "discord",
      name: "Discord",
      version: "1.0.0",
      kind: "builtin",
      category: "alerts",
      description: "Rich embed alerts posted to a Discord channel webhook.",
      icon: { abbr: "DC" },
      capabilities: ["alerts.send"],
      live: true,
      env: [{ key: "DISCORD_WEBHOOK_URL", label: "Webhook URL", secret: true, required: true }],
      configFields: [{ key: "url", label: "Webhook URL", type: "secret", required: true, placeholder: "https://discord.com/api/webhooks/…" }],
      refresh: "manual",
    },
    sendAlert: (msg, ctx) => sendDiscord(msg, ctx),
  }),
  definePlugin({
    manifest: {
      id: "webhook",
      name: "Webhook",
      version: "1.0.0",
      kind: "builtin",
      category: "alerts",
      description: "Signed JSON POST (X-SAVD-Signature: sha256=…) to any endpoint — PagerDuty, Zapier, n8n, your own service.",
      icon: { abbr: "WH" },
      capabilities: ["alerts.send"],
      live: true,
      env: [
        { key: "ALERT_WEBHOOK_URL", label: "Webhook URL", secret: true, required: true },
        { key: "ALERT_WEBHOOK_SECRET", label: "Signing secret", secret: true, required: false },
      ],
      configFields: [
        { key: "url", label: "Endpoint URL", type: "secret", required: true, placeholder: "https://" },
        { key: "signingSecret", label: "Signing secret (optional)", type: "secret", required: false },
      ],
      refresh: "manual",
    },
    sendAlert: (msg, ctx) => sendWebhook(msg, ctx),
  }),
];
