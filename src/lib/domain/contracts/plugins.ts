import { z } from "zod";
import type { PlatformDailyRow } from "../schema/facts";

// Plugin manifests. Built-in plugins, code plugins (definePlugin) and no-code REST plugins all share this shape.
// Accepts the prototype's builder manifest via fromPrototypeManifest().

export const PLUGIN_CATEGORIES = ["ad_platform", "analytics", "commerce", "export", "alerts", "other"] as const;
export type PluginCategory = (typeof PLUGIN_CATEGORIES)[number];

export const PLUGIN_CAPABILITIES = ["metrics.read", "alerts.send", "export.write"] as const;
export type PluginCapability = (typeof PLUGIN_CAPABILITIES)[number];

export const secretRefSchema = z.union([z.object({ enc: z.string() }), z.object({ env: z.string().regex(/^PLUGIN_[A-Z0-9_]{1,60}$/) })]);

const fieldRefSchema = z.union([
  z.string().max(200),
  z.object({ path: z.string().max(200).optional(), transform: z.enum(["number", "micros", "cents", "percent", "sum"]).optional(), expr: z.string().max(500).optional() }),
]);
export type FieldRef = z.infer<typeof fieldRefSchema>;

export const restAuthSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("api_key_header"), header: z.string().min(1).max(60), secret: secretRefSchema.optional() }),
  z.object({ type: z.literal("api_key_query"), param: z.string().min(1).max(60), secret: secretRefSchema.optional() }),
  z.object({ type: z.literal("bearer"), secret: secretRefSchema.optional() }),
  z.object({ type: z.literal("basic"), username: z.string().max(120), password: secretRefSchema.optional() }),
]);
export type RestAuth = z.infer<typeof restAuthSchema>;

export const restSourceSchema = z.object({
  baseUrl: z.string().max(500),
  auth: restAuthSchema,
  headers: z.record(z.string(), z.string().max(500)).optional(),
  report: z.object({
    method: z.enum(["GET", "POST"]).default("GET"),
    path: z.string().max(500),
    body: z.string().max(4000).optional(),
    dateFormat: z.enum(["YYYY-MM-DD", "YYYYMMDD", "unix", "unix_ms", "iso"]).default("YYYY-MM-DD"),
    rowsPath: z.string().max(200),
    chunkDays: z.number().int().min(1).max(92).optional(),
    pagination: z
      .object({
        type: z.enum(["none", "cursor", "page", "offset"]),
        cursorPath: z.string().max(200).optional(),
        param: z.string().max(60).optional(),
        pageSize: z.number().int().min(1).max(10_000).optional(),
        pageSizeParam: z.string().max(60).optional(),
        maxPages: z.number().int().min(1).max(50).optional(),
      })
      .optional(),
  }),
  mapping: z.object({
    date: fieldRefSchema,
    spend: fieldRefSchema,
    impressions: fieldRefSchema.optional(),
    clicks: fieldRefSchema.optional(),
    conversions: fieldRefSchema.optional(),
    conversionValue: fieldRefSchema.optional(),
    campaign: fieldRefSchema.optional(),
    currency: z.string().max(8).optional(),
    /** commerce / analytics endpoints: store revenue (feeds MER), sessions, orders */
    storeRevenue: fieldRefSchema.optional(),
    sessions: fieldRefSchema.optional(),
    orders: fieldRefSchema.optional(),
    /** dot path to a unique row id; rows repeating an id are counted once (default: exact duplicates) */
    dedupeKey: z.string().max(200).optional(),
  }),
  test: z.object({ path: z.string().max(500) }).optional(),
  limits: z.object({ timeoutMs: z.number().int().min(1000).max(60_000).optional(), maxBytes: z.number().int().min(1024).max(20_000_000).optional() }).optional(),
});
export type RestSourceSpec = z.infer<typeof restSourceSchema>;

export const pluginConfigFieldSchema = z.object({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/),
  label: z.string().max(60),
  type: z.enum(["text", "secret", "url", "select", "number", "boolean"]),
  required: z.boolean().default(false),
  options: z.array(z.string().max(60)).optional(),
  placeholder: z.string().max(120).optional(),
  envKey: z.string().max(80).optional(),
});
export type PluginConfigField = z.infer<typeof pluginConfigFieldSchema>;

export const pluginManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,40}$/),
  name: z.string().min(1).max(60),
  version: z.string().max(20).default("1.0.0"),
  kind: z.enum(["builtin", "code", "rest"]),
  category: z.enum(PLUGIN_CATEGORIES),
  description: z.string().max(400),
  icon: z.object({ abbr: z.string().min(1).max(3), color: z.string().max(20).optional() }),
  capabilities: z.array(z.enum(PLUGIN_CAPABILITIES)).min(1),
  /** true when the connector talks to the real service in this build */
  live: z.boolean(),
  env: z.array(z.object({ key: z.string().max(80), label: z.string().max(60), secret: z.boolean(), required: z.boolean() })).optional(),
  configFields: z.array(pluginConfigFieldSchema).max(20).optional(),
  demo: z.object({ share: z.number().optional(), roas: z.number().optional(), cpc: z.number().optional(), ctr: z.number().optional(), aov: z.number().optional() }).optional(),
  rest: restSourceSchema.optional(),
  refresh: z.enum(["manual", "hourly", "daily"]).default("hourly"),
  docsUrl: z.string().max(300).optional(),
});
export type PluginManifest = z.infer<typeof pluginManifestSchema>;

export interface PluginConnection {
  id: string;
  pluginId: string;
  enabled: boolean;
  status: "connected" | "disconnected" | "error";
  mode: "live" | "demo";
  configPlain: Record<string, string>;
  secrets: Record<string, { enc: string }>;
  lastTest?: { at: string; ok: boolean; message: string };
  lastSyncAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PluginView {
  manifest: PluginManifest;
  connected: boolean;
  mode: "live" | "demo" | "off";
  status: "connected" | "available" | "error";
  reason?: string;
  envDetected: { key: string; set: boolean }[];
  lastTest?: { at: string; ok: boolean; message: string };
  custom: boolean;
  lastSyncAt?: string;
}

/** What the API may say about a secret: never the value. */
export interface SecretDescription {
  hasValue: boolean;
  masked: string | null;
  source: "env" | "stored" | null;
}

/** GET /api/plugins/[id] */
export interface PluginDetail extends PluginView {
  /** non-secret config values */
  config: Record<string, string>;
  /** configured secret fields (connection secrets, REST auth, alert webhook URL) */
  secrets: Record<string, SecretDescription>;
}

/** A stored no-code REST plugin as the builder sees it (auth secrets replaced by descriptions). */
export interface CustomPluginRecord {
  manifest: PluginManifest;
  /** optimistic-concurrency version of the stored record (send it back on PUT) */
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
  secrets: Record<string, SecretDescription>;
}

/** Plaintext credentials sent alongside a REST manifest; encrypted on save, never persisted by preview. */
export const pluginSecretsSchema = z
  .object({ apiKey: z.string().max(4000), token: z.string().max(4000), password: z.string().max(4000) })
  .partial()
  .strict();
export type PluginSecretsInput = z.infer<typeof pluginSecretsSchema>;

export const pluginConnectBodySchema = z.object({ values: z.record(z.string(), z.string().max(4000)).default({}) });

/** Create / update / preview / import a custom REST plugin. `manifest` is our manifest or the prototype builder shape. */
export const customPluginBodySchema = z.object({
  manifest: z.unknown(),
  secrets: pluginSecretsSchema.optional(),
  /** PUT only: expected record version */
  version: z.number().int().optional(),
  /** import only: replace an existing plugin with the same id instead of importing a copy */
  replace: z.boolean().optional(),
});
export type CustomPluginBody = z.infer<typeof customPluginBodySchema>;

export interface ManifestIssue {
  level: "error" | "warning";
  /** dotted field path, e.g. "rest.report.path" ("" = whole manifest) */
  path: string;
  message: string;
}

/** POST /api/plugins/custom/validate */
export interface ManifestValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  issues: ManifestIssue[];
  /** the normalized manifest that would be registered (secrets stripped), when it parsed */
  manifest: PluginManifest | null;
}

/** POST /api/plugins/custom/preview (and the REST engine's preview()). */
export interface PluginPreviewResult {
  /** first raw items of the response (credential-looking keys redacted) */
  rawSample: unknown;
  /** first 20 mapped rows */
  rows: PlatformDailyRow[];
  warnings: string[];
  tookMs: number;
  stats?: { items: number; pages: number; mappedRows: number; range: { start: string; end: string } };
  /** validation warnings about the manifest itself (custom preview only) */
  manifestWarnings?: string[];
}

// ── Channels (cross-channel summary, GET /api/channels) ──────────────────────────────────────────────────

export type ChannelKind = "ad_platform" | "analytics" | "commerce";

export interface ChannelPlatformSummary {
  id: string;
  label: string;
  kind: "ad_platform";
  mode: "live" | "demo";
  reason?: string;
  stale?: boolean;
  cost: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conv_value: number;
  roas: number | null;
  cpa: number | null;
  cpc: number | null;
  ctr: number | null;
  /** share of total ad spend (0–1) */
  share: number;
  /** daily cost aligned to ChannelsSummary.dates */
  trend: number[];
}

export interface ChannelAnalyticsSummary {
  id: string;
  label: string;
  kind: "analytics";
  mode: "live" | "demo";
  reason?: string;
  stale?: boolean;
  sessions: number;
  conversions: number;
  conv_value: number;
  /** daily sessions aligned to ChannelsSummary.dates */
  trend: number[];
}

export interface ChannelCommerceSummary {
  id: string;
  label: string;
  kind: "commerce";
  mode: "live" | "demo";
  reason?: string;
  stale?: boolean;
  store_revenue: number;
  orders: number;
  /** daily store revenue aligned to ChannelsSummary.dates */
  trend: number[];
}

export interface ChannelsSummary {
  range: { start: string; end: string; days: number };
  currency: string;
  dates: string[];
  /** ad platforms (Google Ads first, then by spend) — the only rows in spend share and blended totals */
  platforms: ChannelPlatformSummary[];
  analytics: ChannelAnalyticsSummary[];
  commerce: ChannelCommerceSummary[];
  totals: {
    cost: number;
    impressions: number;
    clicks: number;
    conversions: number;
    conv_value: number;
    roas: number | null;
    cpa: number | null;
    /** null when no commerce plugin is connected */
    store_revenue: number | null;
    orders: number | null;
    sessions: number | null;
    /** marketing efficiency ratio = store revenue ÷ total ad spend (null without a commerce plugin) */
    mer: number | null;
    /** daily blended ad cost aligned to dates */
    trend: number[];
  };
  sources: { id: string; label: string; mode: "live" | "demo"; reason?: string; stale?: boolean }[];
  warnings: string[];
}

/** Free-text auth labels from the prototype builder ("API key", "Bearer token", "Basic", "None") → auth spec. */
export function authFromLabel(label: string | undefined): RestAuth {
  const t = (label ?? "").trim().toLowerCase();
  if (!t || t === "none" || t.includes("no auth")) return { type: "none" };
  if (t.includes("basic")) return { type: "basic", username: "" };
  if (t.includes("bearer") || t.includes("oauth") || t === "token" || t.includes("access token")) return { type: "bearer" };
  if (t.includes("query")) return { type: "api_key_query", param: "api_key" };
  return { type: "api_key_header", header: "Authorization" };
}

/** The prototype builder's manifest shape → our manifest. */
export function fromPrototypeManifest(input: {
  id?: string;
  name: string;
  version?: string;
  category?: string;
  source?: { baseUrl?: string; auth?: string; report?: string };
  mapping?: { date?: string; spend?: string; conversions?: string; currency?: string };
  capabilities?: string[];
  refresh?: string;
}): PluginManifest {
  const categoryMap: Record<string, PluginManifest["category"]> = { "Ad platform": "ad_platform", Analytics: "analytics", Commerce: "commerce", Alerts: "alerts", Export: "export" };
  const slug = (input.id ?? input.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom";
  const caps = (input.capabilities ?? ["metrics.read"]).map((c) => (c === "alerts.receive" ? "alerts.send" : c)).filter((c): c is PluginCapability => (PLUGIN_CAPABILITIES as readonly string[]).includes(c));
  const abbr = input.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "CP";
  return pluginManifestSchema.parse({
    id: (slug.startsWith("custom-") ? slug : `custom-${slug}`).slice(0, 41).replace(/-$/, ""),
    name: input.name,
    version: input.version ?? "1.0.0",
    kind: "rest",
    category: categoryMap[input.category ?? ""] ?? "ad_platform",
    description: `Custom plugin · ${input.source?.baseUrl ?? ""}`.slice(0, 400),
    icon: { abbr },
    capabilities: caps.length ? caps : ["metrics.read"],
    live: true,
    refresh: input.refresh === "daily" ? "daily" : input.refresh === "manual" ? "manual" : "hourly",
    rest: {
      baseUrl: input.source?.baseUrl ?? "https://",
      auth: authFromLabel(input.source?.auth),
      report: {
        method: "GET",
        path: input.source?.report ?? "/reports?date_from={start}&date_to={end}",
        dateFormat: "YYYY-MM-DD",
        rowsPath: "data.rows",
      },
      mapping: { date: input.mapping?.date || "date", spend: input.mapping?.spend || "spend", conversions: input.mapping?.conversions || undefined, currency: input.mapping?.currency || undefined },
    },
  });
}
