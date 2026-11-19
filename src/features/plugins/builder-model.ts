import type { FieldRef, ManifestIssue, PluginCategory, PluginManifest, PluginSecretsInput, RestAuth, RestSourceSpec } from "@/lib/domain/contracts/plugins";
import { authSecretKey, customPluginId, EXPORT_KIND, PLUGIN_ENV_REF } from "@/lib/domain/plugins/manifest";
import { TEMPLATE_VARS } from "@/lib/domain/plugins/mapping";

// Form model of the no-code REST plugin builder and its two-way conversion to a manifest. Pure and unit-tested:
// the server validates and normalizes, this only shapes what the user typed. The plaintext credential never lives
// in the form — it is separate, write-only component state sent once as `secrets`.

export const BUILDER_STEPS = ["basics", "endpoint", "mapping", "preview"] as const;
export type BuilderStep = (typeof BUILDER_STEPS)[number];
export const STEP_LABELS: Record<BuilderStep, string> = { basics: "Basics", endpoint: "Endpoint", mapping: "Mapping", preview: "Preview & save" };

export type BuilderCategory = Extract<PluginCategory, "ad_platform" | "analytics" | "commerce">;
export const BUILDER_CATEGORIES: { value: BuilderCategory; label: string }[] = [
  { value: "ad_platform", label: "Ad platform" },
  { value: "analytics", label: "Analytics" },
  { value: "commerce", label: "Commerce" },
];

export type AuthType = RestAuth["type"];
export const AUTH_TYPES: { value: AuthType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "api_key_header", label: "API key · header" },
  { value: "api_key_query", label: "API key · query" },
  { value: "bearer", label: "Bearer token" },
  { value: "basic", label: "Basic auth" },
];

/** Where the credential comes from: typed now (encrypted on save), a PLUGIN_* env var, or the one already saved. */
export type SecretSource = "value" | "env" | "saved";

export type DateFormat = RestSourceSpec["report"]["dateFormat"];
export const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
  { value: "YYYYMMDD", label: "YYYYMMDD" },
  { value: "unix", label: "Unix seconds" },
  { value: "unix_ms", label: "Unix milliseconds" },
  { value: "iso", label: "ISO 8601" },
];

export type PaginationType = NonNullable<RestSourceSpec["report"]["pagination"]>["type"];
export const PAGINATION_TYPES: { value: PaginationType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "cursor", label: "Cursor" },
  { value: "page", label: "Page" },
  { value: "offset", label: "Offset" },
];

export type Transform = "" | NonNullable<Exclude<FieldRef, string>["transform"]>;
export const TRANSFORMS: { value: Transform; label: string; hint: string }[] = [
  { value: "", label: "as is", hint: "numbers and numeric strings (1,234.50 · $9.99 · 12%)" },
  { value: "number", label: "number", hint: "coerce to a number" },
  { value: "micros", label: "micros", hint: "÷ 1,000,000" },
  { value: "cents", label: "cents", hint: "÷ 100" },
  { value: "percent", label: "percent", hint: "12.5 → 0.125" },
  { value: "sum", label: "sum", hint: "adds every match of [*] or [key=value]" },
];

export type MappingTarget = "date" | "campaign" | "spend" | "impressions" | "clicks" | "conversions" | "conversionValue" | "sessions" | "storeRevenue" | "orders";
export const MAPPING_TARGETS: { key: MappingTarget; label: string; hint: string }[] = [
  { key: "date", label: "date", hint: "Day of each item — any common date format" },
  { key: "campaign", label: "campaign", hint: "Campaign name (optional breakdown)" },
  { key: "spend", label: "spend", hint: "Ad spend" },
  { key: "impressions", label: "impressions", hint: "Impressions" },
  { key: "clicks", label: "clicks", hint: "Clicks" },
  { key: "conversions", label: "conversions", hint: "Platform-attributed conversions" },
  { key: "conversionValue", label: "conv_value", hint: "Conversion value attributed by the platform" },
  { key: "sessions", label: "sessions", hint: "Analytics sessions" },
  { key: "storeRevenue", label: "revenue", hint: "Store revenue — feeds MER on Channels" },
  { key: "orders", label: "orders", hint: "Store orders" },
];

/** Report-path variables ({config.<field>} needs config fields, which only imported manifests carry). */
export const TEMPLATE_HINTS: readonly string[] = [...TEMPLATE_VARS.map((v) => `{${v}}`), "{config.<field>}"];

export interface MappingRow {
  target: MappingTarget;
  path: string;
  transform: Transform;
  expr: string;
}

export interface BuilderForm {
  /** saved custom plugin id when editing ("" = derived from the name) */
  id: string;
  name: string;
  category: BuilderCategory;
  description: string;
  abbr: string;
  refresh: PluginManifest["refresh"];
  baseUrl: string;
  auth: { type: AuthType; header: string; param: string; username: string; source: SecretSource; env: string };
  report: { method: "GET" | "POST"; path: string; body: string; dateFormat: DateFormat; rowsPath: string; chunkDays: string; testPath: string };
  pagination: { type: PaginationType; param: string; cursorPath: string; pageSize: string; pageSizeParam: string; maxPages: string };
  mappings: MappingRow[];
  currency: string;
  dedupeKey: string;
  /** manifest parts the builder doesn't edit (imported manifests), carried through on save */
  extra: { version?: string; headers?: Record<string, string>; limits?: RestSourceSpec["limits"]; configFields?: PluginManifest["configFields"]; env?: PluginManifest["env"]; docsUrl?: string };
}

export const KLAVIYO_MOCK_KEY = "mock-key";

const row = (target: MappingTarget, path: string, transform: Transform = "", expr = ""): MappingRow => ({ target, path, transform, expr });

export function defaultMappings(category: BuilderCategory): MappingRow[] {
  if (category === "analytics") return [row("date", "date"), row("sessions", "sessions"), row("conversions", "conversions"), row("conversionValue", "revenue")];
  if (category === "commerce") return [row("date", "date"), row("storeRevenue", "revenue"), row("orders", "orders")];
  return [row("date", "date"), row("campaign", "campaign"), row("spend", "spend"), row("impressions", "impressions"), row("clicks", "clicks"), row("conversions", "conversions")];
}

export function blankForm(category: BuilderCategory = "ad_platform"): BuilderForm {
  return {
    id: "",
    name: "",
    category,
    description: "",
    abbr: "",
    refresh: "hourly",
    baseUrl: "https://",
    auth: { type: "bearer", header: "Authorization", param: "api_key", username: "", source: "value", env: "" },
    report: { method: "GET", path: "/reports?start={start}&end={end}", body: "", dateFormat: "YYYY-MM-DD", rowsPath: "data", chunkDays: "", testPath: "" },
    pagination: { type: "none", param: "", cursorPath: "", pageSize: "", pageSizeParam: "", maxPages: "" },
    mappings: defaultMappings(category),
    currency: "",
    dedupeKey: "",
    extra: {},
  };
}

/**
 * The prototype's builder defaults (Klaviyo · API key · metrics.spend · metrics.placed_order), pointed at the
 * in-process mock platform so Test & preview works out of the box. Use the key KLAVIYO_MOCK_KEY.
 */
export function klaviyoMockForm(): BuilderForm {
  return {
    ...blankForm(),
    name: "Klaviyo",
    description: "Klaviyo-style attributed spend and orders, served by the built-in mock platform. Point the base URL at https://a.klaviyo.com/api for the real service.",
    abbr: "KL",
    baseUrl: "mock://platform",
    auth: { type: "api_key_header", header: "x-api-key", param: "api_key", username: "", source: "value", env: "" },
    report: { method: "GET", path: "/reports?date_from={start}&date_to={end}&page_size=50", body: "", dateFormat: "YYYY-MM-DD", rowsPath: "data.rows", chunkDays: "", testPath: "/health" },
    pagination: { type: "cursor", param: "cursor", cursorPath: "paging.next", pageSize: "", pageSizeParam: "", maxPages: "" },
    mappings: [
      row("date", "day"),
      row("campaign", "campaign.name"),
      row("spend", "metrics.spend"),
      row("impressions", "metrics.impressions"),
      row("clicks", "metrics.clicks"),
      row("conversions", "metrics.placed_order"),
      row("conversionValue", "actions[action_type=purchase_value].value"),
    ],
  };
}

const BUILDER_CATEGORY_SET = new Set<string>(BUILDER_CATEGORIES.map((c) => c.value));
export const isBuilderCategory = (c: string): c is BuilderCategory => BUILDER_CATEGORY_SET.has(c);

/** "Build a live connector" from a demo-only built-in: its identity, an empty endpoint and category defaults. */
export function formFromBuiltin(m: Pick<PluginManifest, "name" | "category" | "icon">): BuilderForm {
  const category = isBuilderCategory(m.category) ? m.category : "ad_platform";
  return { ...blankForm(category), name: m.name, abbr: m.icon.abbr, description: `Live ${m.name} connector built with the REST builder.` };
}

export function defaultAbbr(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "CP";
}

/** The id the server will register: `custom-<slug>`. */
export function pluginIdFor(form: Pick<BuilderForm, "id" | "name">): string {
  return customPluginId(form.id || undefined, form.name.trim() || "plugin");
}

/** Mirrors the server's suggestion for users without APP_ENCRYPTION_KEY: custom-klaviyo → PLUGIN_KLAVIYO_KEY. */
export function suggestEnvKey(pluginId: string): string {
  return `PLUGIN_${pluginId
    .replace(/^custom-/, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .slice(0, 50)}_KEY`;
}

const posInt = (s: string): number | undefined => {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

export function authSpec(form: BuilderForm): RestAuth {
  const a = form.auth;
  const ref = a.source === "env" && a.env.trim() ? { env: a.env.trim() } : undefined;
  switch (a.type) {
    case "none":
      return { type: "none" };
    case "api_key_header":
      return { type: "api_key_header", header: a.header.trim() || "Authorization", ...(ref ? { secret: ref } : {}) };
    case "api_key_query":
      return { type: "api_key_query", param: a.param.trim() || "api_key", ...(ref ? { secret: ref } : {}) };
    case "bearer":
      return { type: "bearer", ...(ref ? { secret: ref } : {}) };
    case "basic":
      return { type: "basic", username: a.username.trim(), ...(ref ? { password: ref } : {}) };
  }
}

export function fieldRefOf(r: MappingRow): FieldRef {
  const expr = r.expr.trim();
  if (expr) return { expr };
  const path = r.path.trim();
  return r.transform ? { path, transform: r.transform } : path;
}

const hasRef = (r: MappingRow | undefined): r is MappingRow => !!r && (!!r.path.trim() || !!r.expr.trim());

export function formToManifest(form: BuilderForm): PluginManifest {
  const pg = form.pagination;
  const mapping: Record<string, FieldRef | string> = { date: "", spend: "" };
  for (const t of MAPPING_TARGETS) {
    const r = form.mappings.find((x) => x.target === t.key);
    if (hasRef(r)) mapping[t.key] = fieldRefOf(r);
  }
  const currency = form.currency.trim().toUpperCase();
  if (currency) mapping.currency = currency;
  if (form.dedupeKey.trim()) mapping.dedupeKey = form.dedupeKey.trim();

  const chunkDays = posInt(form.report.chunkDays);
  const pageSize = posInt(pg.pageSize);
  const maxPages = posInt(pg.maxPages);
  const report: RestSourceSpec["report"] = {
    method: form.report.method,
    path: form.report.path.trim(),
    ...(form.report.method === "POST" && form.report.body.trim() ? { body: form.report.body } : {}),
    dateFormat: form.report.dateFormat,
    rowsPath: form.report.rowsPath.trim(),
    ...(chunkDays ? { chunkDays } : {}),
    ...(pg.type !== "none"
      ? {
          pagination: {
            type: pg.type,
            ...(pg.param.trim() ? { param: pg.param.trim() } : {}),
            ...(pg.type === "cursor" && pg.cursorPath.trim() ? { cursorPath: pg.cursorPath.trim() } : {}),
            ...(pageSize ? { pageSize } : {}),
            ...(pg.pageSizeParam.trim() ? { pageSizeParam: pg.pageSizeParam.trim() } : {}),
            ...(maxPages ? { maxPages } : {}),
          },
        }
      : {}),
  };
  const rest: RestSourceSpec = {
    baseUrl: form.baseUrl.trim(),
    auth: authSpec(form),
    ...(form.extra.headers && Object.keys(form.extra.headers).length ? { headers: form.extra.headers } : {}),
    report,
    mapping: mapping as RestSourceSpec["mapping"],
    ...(form.report.testPath.trim() ? { test: { path: form.report.testPath.trim() } } : {}),
    ...(form.extra.limits ? { limits: form.extra.limits } : {}),
  };
  return {
    id: pluginIdFor(form),
    name: form.name.trim(),
    version: form.extra.version ?? "1.0.0",
    kind: "rest",
    category: form.category,
    description: form.description.trim(),
    icon: { abbr: (form.abbr.trim() || defaultAbbr(form.name)).slice(0, 3).toUpperCase() },
    capabilities: ["metrics.read"],
    live: true,
    refresh: form.refresh,
    rest,
    ...(form.extra.configFields?.length ? { configFields: form.extra.configFields } : {}),
    ...(form.extra.env?.length ? { env: form.extra.env } : {}),
    ...(form.extra.docsUrl ? { docsUrl: form.extra.docsUrl } : {}),
  };
}

/** A manifest (saved, imported or normalized by /validate) back into the form. */
export function manifestToForm(m: PluginManifest, opts: { savedSecret?: boolean } = {}): BuilderForm {
  const base = blankForm(isBuilderCategory(m.category) ? m.category : "ad_platform");
  const spec = m.rest;
  const auth: RestAuth = spec?.auth ?? { type: "none" };
  const ref = auth.type === "basic" ? auth.password : auth.type === "none" ? undefined : auth.secret;
  const env = ref && "env" in ref ? ref.env : "";
  const source: SecretSource = env ? "env" : opts.savedSecret || (ref && "enc" in ref) ? "saved" : "value";
  const mappings: MappingRow[] = [];
  for (const t of MAPPING_TARGETS) {
    const r = spec?.mapping[t.key];
    if (r === undefined || r === "") continue;
    mappings.push(typeof r === "string" ? row(t.key, r) : row(t.key, r.path ?? "", r.transform ?? "", r.expr ?? ""));
  }
  const pg = spec?.report.pagination;
  return {
    id: m.id,
    name: m.name,
    category: base.category,
    description: m.description ?? "",
    abbr: m.icon?.abbr ?? "",
    refresh: m.refresh ?? "hourly",
    baseUrl: spec?.baseUrl ?? base.baseUrl,
    auth: {
      type: auth.type,
      header: auth.type === "api_key_header" ? auth.header : base.auth.header,
      param: auth.type === "api_key_query" ? auth.param : base.auth.param,
      username: auth.type === "basic" ? auth.username : "",
      source,
      env,
    },
    report: {
      method: spec?.report.method ?? "GET",
      path: spec?.report.path ?? "",
      body: spec?.report.body ?? "",
      dateFormat: spec?.report.dateFormat ?? "YYYY-MM-DD",
      rowsPath: spec?.report.rowsPath ?? "",
      chunkDays: spec?.report.chunkDays ? String(spec.report.chunkDays) : "",
      testPath: spec?.test?.path ?? "",
    },
    pagination: {
      type: pg?.type ?? "none",
      param: pg?.param ?? "",
      cursorPath: pg?.cursorPath ?? "",
      pageSize: pg?.pageSize ? String(pg.pageSize) : "",
      pageSizeParam: pg?.pageSizeParam ?? "",
      maxPages: pg?.maxPages ? String(pg.maxPages) : "",
    },
    mappings,
    currency: spec?.mapping.currency ?? "",
    dedupeKey: spec?.mapping.dedupeKey ?? "",
    extra: {
      ...(m.version ? { version: m.version } : {}),
      ...(spec?.headers ? { headers: spec.headers } : {}),
      ...(spec?.limits ? { limits: spec.limits } : {}),
      ...(m.configFields?.length ? { configFields: m.configFields } : {}),
      ...(m.env?.length ? { env: m.env } : {}),
      ...(m.docsUrl ? { docsUrl: m.docsUrl } : {}),
    },
  };
}

/** Plaintext credential to send with preview / save, or `""` to remove a saved one. */
export function formSecrets(form: BuilderForm, secret: string, opts: { clearSaved?: boolean } = {}): PluginSecretsInput | undefined {
  const key = authSecretKey(authSpec(form));
  if (!key) return undefined;
  if (form.auth.source === "value" && secret) return { [key]: secret };
  if (opts.clearSaved) return { [key]: "" };
  return undefined;
}

/** Client-side checks that make a server round trip pointless (the server validates everything else). */
export function formIssues(form: BuilderForm): ManifestIssue[] {
  const out: ManifestIssue[] = [];
  const has = (t: MappingTarget) => hasRef(form.mappings.find((r) => r.target === t));
  if (!form.name.trim()) out.push({ level: "error", path: "name", message: "Give the service a name" });
  if (!form.baseUrl.trim() || form.baseUrl.trim() === "https://") out.push({ level: "error", path: "rest.baseUrl", message: "Enter the API base URL, e.g. https://api.example.com/v1" });
  if (!form.report.path.trim()) out.push({ level: "error", path: "rest.report.path", message: "Enter the report path, e.g. /reports?from={start}&to={end}" });
  if (!has("date")) out.push({ level: "error", path: "rest.mapping.date", message: "Map the date field — every row needs a day" });
  if (form.category === "ad_platform" && !has("spend")) out.push({ level: "warning", path: "rest.mapping.spend", message: "Map spend so this platform counts toward blended ad spend" });
  if (form.auth.type !== "none" && form.auth.source === "env" && !PLUGIN_ENV_REF.test(form.auth.env.trim())) {
    out.push({ level: "error", path: "rest.auth", message: "Env references must be PLUGIN_* variables, e.g. PLUGIN_ACME_KEY" });
  }
  return out;
}

/** Which builder step owns a manifest issue path. */
export function issueStep(path: string): BuilderStep {
  if (path.startsWith("rest.mapping")) return "mapping";
  if (path.startsWith("rest") || path.startsWith("secrets")) return "endpoint";
  return "basics";
}

/** The file "Download JSON" writes — the same shape the export endpoint returns (never with credentials). */
export function exportFile(manifest: PluginManifest, exportedAt: string): { kind: typeof EXPORT_KIND; schemaVersion: 1; exportedAt: string; manifest: PluginManifest } {
  return { kind: EXPORT_KIND, schemaVersion: 1, exportedAt, manifest };
}

export function parseManifestText(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const t = text.trim();
  if (!t) return { ok: false, error: "Paste a manifest or choose a .json file" };
  try {
    return { ok: true, value: JSON.parse(t) };
  } catch (err) {
    return { ok: false, error: `Not valid JSON — ${(err as Error).message}` };
  }
}
