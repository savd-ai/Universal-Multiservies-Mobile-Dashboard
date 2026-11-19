import {
  fromPrototypeManifest,
  pluginManifestSchema,
  type FieldRef,
  type ManifestIssue,
  type ManifestValidationResult,
  type PluginManifest,
  type RestAuth,
  type RestSourceSpec,
} from "../contracts/plugins";
import { FormulaError, parseFormula } from "../metrics/formula";
import { parsePath, PathError } from "./dot-path";
import { TEMPLATE_VARS, templateVariables, validateTemplate } from "./mapping";

// Normalization + validation for no-code REST plugin manifests. Accepts our manifest, an exported
// `{kind:"savd.plugin", manifest}` file, the prototype's manifest preview, or the prototype builder's flat form
// state ({name, url, auth, spend, conv, cat}). Pure: server code adds SSRF / env / storage checks on top.

export const CUSTOM_PREFIX = "custom-";
export const PLUGIN_ENV_REF = /^PLUGIN_[A-Z0-9_]{1,60}$/;
export const EXPORT_KIND = "savd.plugin";

type SecretRefLike = { enc: string } | { env: string };

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** `custom-<slug>`, ≤ 41 chars, never ending in "-". */
export function customPluginId(raw: string | undefined, name: string): string {
  const slug = slugify(raw || name) || "plugin";
  const withPrefix = slug.startsWith(CUSTOM_PREFIX) ? slug : `${CUSTOM_PREFIX}${slug}`;
  return withPrefix.slice(0, 41).replace(/-+$/, "");
}

/** Which plaintext credential (from the request's `secrets`) an auth type consumes. */
export function authSecretKey(auth: RestAuth): "apiKey" | "token" | "password" | null {
  switch (auth.type) {
    case "api_key_header":
    case "api_key_query":
      return "apiKey";
    case "bearer":
      return "token";
    case "basic":
      return "password";
    case "none":
      return null;
  }
}

export function authSecretRef(auth: RestAuth): SecretRefLike | undefined {
  if (auth.type === "basic") return auth.password;
  if (auth.type === "none") return undefined;
  return auth.secret;
}

export function withAuthSecret(auth: RestAuth, ref: SecretRefLike | undefined): RestAuth {
  switch (auth.type) {
    case "none":
      return auth;
    case "basic": {
      const { password: _p, ...rest } = auth;
      return ref ? { ...rest, password: ref } : rest;
    }
    default: {
      const { secret: _s, ...rest } = auth;
      return (ref ? { ...rest, secret: ref } : rest) as RestAuth;
    }
  }
}

/** The manifest as the API shows it: encrypted credential blobs removed (env references are names, kept). */
export function publicManifest(m: PluginManifest): PluginManifest {
  if (!m.rest) return m;
  const ref = authSecretRef(m.rest.auth);
  if (!ref || !("enc" in ref)) return m;
  return { ...m, rest: { ...m.rest, auth: withAuthSecret(m.rest.auth, undefined) } };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

/** True when the input carries a client-supplied `{enc}` credential (never accepted from requests). */
export function hasEncryptedRef(input: unknown): boolean {
  const auth = isRecord(input) && isRecord(input.rest) && isRecord(input.rest.auth) ? input.rest.auth : null;
  if (!auth) return false;
  return [auth.secret, auth.password].some((r) => isRecord(r) && "enc" in r);
}

/** Recognize the input shape and turn it into a candidate manifest object (validated later). */
export function normalizeManifestInput(input: unknown): { candidate: Record<string, unknown> | null; issues: ManifestIssue[] } {
  const issues: ManifestIssue[] = [];
  let raw: unknown = input;
  if (isRecord(raw) && raw.kind === EXPORT_KIND && isRecord(raw.manifest)) raw = raw.manifest;
  if (!isRecord(raw)) return { candidate: null, issues: [{ level: "error", path: "", message: "The manifest must be a JSON object" }] };

  // Prototype shapes: nested manifest preview ({source, mapping}) or the builder's flat form state.
  if (!("rest" in raw) && ("source" in raw || "url" in raw || "spend" in raw || "cat" in raw)) {
    const flat = !("source" in raw);
    const proto = flat
      ? {
          id: str(raw.id),
          name: str(raw.name) ?? "",
          version: str(raw.version),
          category: str(raw.cat) ?? str(raw.category),
          source: { baseUrl: str(raw.url) ?? str(raw.baseUrl), auth: str(raw.auth), report: str(raw.report) },
          mapping: { date: str(raw.date), spend: str(raw.spend), conversions: str(raw.conv) ?? str(raw.conversions), currency: str(raw.currency) },
          capabilities: str(raw.cat) === "Alerts" ? ["alerts.receive"] : ["metrics.read"],
          refresh: str(raw.refresh),
        }
      : (raw as Parameters<typeof fromPrototypeManifest>[0]);
    if (!proto.name) return { candidate: null, issues: [{ level: "error", path: "name", message: "Service name is required" }] };
    try {
      const m = fromPrototypeManifest(proto);
      issues.push({ level: "warning", path: "", message: "Converted from the prototype builder format — review auth, rowsPath and pagination before saving." });
      return { candidate: m as unknown as Record<string, unknown>, issues };
    } catch (err) {
      return { candidate: null, issues: [...issues, ...zodIssues(err)] };
    }
  }

  // Our manifest: fill what the builder may leave out, force what a REST plugin must be.
  const name = str(raw.name) ?? "";
  const c: Record<string, unknown> = { ...raw };
  c.id = customPluginId(str(raw.id), name);
  if (str(raw.id) && str(raw.id) !== c.id) issues.push({ level: "warning", path: "id", message: `Custom plugin ids start with "${CUSTOM_PREFIX}" — saved as "${String(c.id)}".` });
  if (raw.kind !== undefined && raw.kind !== "rest") issues.push({ level: "warning", path: "kind", message: 'Custom plugins built here are REST plugins — kind set to "rest".' });
  c.kind = "rest";
  if (raw.live === false) issues.push({ level: "warning", path: "live", message: "Custom REST plugins always fetch live data." });
  c.live = true;
  c.category ??= "ad_platform";
  if (Array.isArray(raw.capabilities) && raw.capabilities.some((x) => x !== "metrics.read")) {
    issues.push({ level: "warning", path: "capabilities", message: "Custom REST plugins read metrics — other capabilities were removed." });
  }
  c.capabilities = ["metrics.read"];
  if (!str(raw.description)) {
    const base = isRecord(raw.rest) ? str(raw.rest.baseUrl) : undefined;
    c.description = `Custom REST plugin${base ? ` · ${hostOf(base) ?? base}` : ""}`.slice(0, 400);
  }
  if (!isRecord(raw.icon) || !str(raw.icon.abbr)) c.icon = { abbr: name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "CP" };
  return { candidate: c, issues };
}

function hostOf(u: string): string | null {
  try {
    return new URL(u).host || null;
  } catch {
    return null;
  }
}

function zodIssues(err: unknown): ManifestIssue[] {
  const issues = (err as { issues?: { path: PropertyKey[]; message: string; code?: string }[] }).issues;
  if (!Array.isArray(issues)) return [{ level: "error", path: "", message: err instanceof Error ? err.message : "Invalid manifest" }];
  return issues.map((i) => {
    const path = i.path.map(String).join(".");
    const envRef = path.endsWith(".env") && i.code === "invalid_format";
    return { level: "error" as const, path, message: envRef ? "Only PLUGIN_* environment variables can be referenced by custom plugins (least privilege)" : i.message };
  });
}

export interface ValidateOptions {
  /** PLUGINS_ALLOW_HTTP / PLUGINS_ALLOW_PRIVATE_NETWORK */
  allowHttp: boolean;
  /** built-in and code plugin ids */
  reservedIds: ReadonlySet<string>;
  /** stored manifests carry {enc} refs; request bodies never may */
  allowEncryptedRefs?: boolean;
  /** a plaintext credential accompanies the manifest */
  hasTransientSecret?: boolean;
  accountCurrency?: string;
}

const FORBIDDEN_HEADERS = new Set(["host", "content-length", "transfer-encoding", "connection", "upgrade", "te", "trailer", "keep-alive", "proxy-connection", "expect"]);
const CREDENTIAL_HEADER = /^(authorization|proxy-authorization|cookie)$|api[-_]?key|token|secret|passw|session/i;
const HEADER_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,60}$/;

/** Full validation of a custom REST manifest candidate. Never throws. */
export function validateCustomManifest(input: unknown, opts: ValidateOptions): { manifest: PluginManifest | null; issues: ManifestIssue[] } {
  const issues: ManifestIssue[] = [];
  if (!opts.allowEncryptedRefs && hasEncryptedRef(isRecord(input) && input.kind === EXPORT_KIND ? input.manifest : input)) {
    issues.push({ level: "error", path: "rest.auth", message: "Encrypted credentials can't be supplied in a manifest — send the plaintext in `secrets` (it is encrypted on the server) or reference a PLUGIN_* env var." });
  }
  const norm = normalizeManifestInput(input);
  issues.push(...norm.issues);
  if (!norm.candidate) return { manifest: null, issues };
  const parsed = pluginManifestSchema.safeParse(norm.candidate);
  let m: PluginManifest;
  if (parsed.success) m = parsed.data;
  else {
    issues.push(...zodIssues(parsed.error));
    // Keep going on a copy without the broken fields so the builder sees every problem at once.
    const fallback = bestEffortParse(norm.candidate, parsed.error.issues);
    if (!fallback) return { manifest: null, issues };
    m = fallback;
  }
  const reported = new Set(issues.map((i) => `${i.path}|${i.message}`));
  const push = (level: ManifestIssue["level"], path: string, message: string) => {
    if (reported.has(`${path}|${message}`)) return;
    reported.add(`${path}|${message}`);
    issues.push({ level, path, message });
  };
  const err = (path: string, message: string) => push("error", path, message);
  const warn = (path: string, message: string) => push("warning", path, message);

  if (!m.id.startsWith(CUSTOM_PREFIX) || m.id.length <= CUSTOM_PREFIX.length) err("id", `Custom plugin ids must start with "${CUSTOM_PREFIX}"`);
  if (opts.reservedIds.has(m.id)) err("id", `"${m.id}" is reserved by a built-in or code plugin`);
  if (m.category === "alerts" || m.category === "export") err("category", "Custom REST plugins read metrics — deliver alerts through a Webhook alert channel instead.");
  for (const e of m.env ?? []) if (!PLUGIN_ENV_REF.test(e.key)) err("env", `Custom plugins may only declare PLUGIN_* environment variables (got ${e.key})`);
  const spec = m.rest;
  if (!spec) {
    err("rest", "A REST source (base URL, report path, mapping) is required");
    return { manifest: null, issues };
  }
  checkBaseUrl(spec.baseUrl, opts, err, warn);
  const configKeys = (m.configFields ?? []).map((f) => f.key);
  checkPath("rest.report.path", spec.report.path, configKeys, err, warn);
  if (spec.report.body !== undefined) for (const e of validateTemplate(spec.report.body, configKeys)) err("rest.report.body", e);
  if (spec.report.body !== undefined && spec.report.method !== "POST") warn("rest.report.body", "A body is only sent with method POST.");
  if (spec.report.body && /"(api[-_]?key|access[-_]?token|token|secret|client[-_]?secret|password)"\s*:\s*"(?!\{)[^"]+"/i.test(spec.report.body)) {
    warn("rest.report.body", "The body seems to contain a literal credential — it is stored in plain text; prefer the auth settings.");
  }
  if (spec.test?.path) checkPath("rest.test.path", spec.test.path, configKeys, err, warn);
  checkHeaders(spec.headers, err, warn);
  checkPagination(spec, err, warn);
  checkMapping(spec, err);
  checkDotPath("rest.report.rowsPath", spec.report.rowsPath, err);

  const ref = authSecretRef(spec.auth);
  const authBroken = issues.some((i) => i.level === "error" && i.path.startsWith("rest.auth"));
  if (authSecretKey(spec.auth) && !ref && !opts.hasTransientSecret && !authBroken) warn("rest.auth", "No credential is set — requests will be sent without one.");
  if (ref && "env" in ref && !PLUGIN_ENV_REF.test(ref.env)) err("rest.auth", "Only PLUGIN_* environment variables can be referenced by custom plugins (least privilege)");
  if (spec.mapping.currency && opts.accountCurrency && spec.mapping.currency !== opts.accountCurrency) {
    warn("rest.mapping.currency", `Amounts in ${spec.mapping.currency} are converted into ${opts.accountCurrency} with FX_RATES; values without a rate are excluded.`);
  }
  if (m.category === "commerce" && !spec.mapping.storeRevenue) warn("rest.mapping.storeRevenue", "Map storeRevenue so this store's revenue feeds MER on the Channels page.");
  if (m.category === "analytics" && !spec.mapping.sessions) warn("rest.mapping.sessions", "Map sessions to show traffic next to ad spend.");
  return { manifest: parsed.success ? m : null, issues };
}

/** Drop the fields zod rejected (a few rounds, for nested unions) and parse again; null when still invalid. */
function bestEffortParse(candidate: Record<string, unknown>, first: readonly { path: PropertyKey[] }[]): PluginManifest | null {
  const copy = structuredClone(candidate) as Record<string, unknown>;
  let pending = first;
  for (let round = 0; round < 4; round++) {
    for (const i of pending) deletePath(copy, i.path);
    const r = pluginManifestSchema.safeParse(copy);
    if (r.success) return r.data;
    pending = r.error.issues;
  }
  return null;
}

function deletePath(root: Record<string, unknown>, path: readonly PropertyKey[]): void {
  if (!path.length) return;
  let node: unknown = root;
  for (const key of path.slice(0, -1)) {
    if (!isRecord(node) && !Array.isArray(node)) return;
    node = (node as Record<PropertyKey, unknown>)[key as string];
  }
  const last = path[path.length - 1] as string | number;
  if (Array.isArray(node) && typeof last === "number") node.splice(last, 1);
  else if (isRecord(node)) delete node[last];
}

type Report = (path: string, message: string) => void;

function checkBaseUrl(raw: string, opts: ValidateOptions, err: Report, warn: Report): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    err("rest.baseUrl", "Base URL must be an absolute URL, e.g. https://api.example.com/v1");
    return;
  }
  if (url.protocol === "mock:") {
    if (url.host !== "platform") err("rest.baseUrl", "The only mock endpoint is mock://platform");
    return;
  }
  if (url.protocol === "http:") {
    if (!opts.allowHttp) err("rest.baseUrl", "Only https:// URLs are allowed (set PLUGINS_ALLOW_HTTP=true for http)");
    else warn("rest.baseUrl", "Plain http:// — credentials and data travel unencrypted.");
  } else if (url.protocol !== "https:") err("rest.baseUrl", "Base URL must use https://");
  if (url.username || url.password) err("rest.baseUrl", "Credentials in URLs are not allowed — use the auth settings instead");
  if (url.search || url.hash) err("rest.baseUrl", "The base URL can't carry a query string or fragment — put parameters in the report path and credentials in the auth settings.");
}

/** Query parameters that look like credentials must not hold literal values (they'd be stored in plain text). */
const CREDENTIAL_PARAM = /^(api[-_]?key|key|access[-_]?token|token|secret|client[-_]?secret|password|passwd|auth|signature|sig)$/i;

function checkLiteralCredentials(field: string, path: string, err: Report): void {
  const q = path.indexOf("?");
  if (q < 0) return;
  for (const pair of path.slice(q + 1).split("&")) {
    const [name = "", value = ""] = pair.split("=");
    if (CREDENTIAL_PARAM.test(decodeURIComponentSafe(name)) && value && !/^\{[a-zA-Z0-9_.]+\}$/.test(value)) {
      err(field, `"${name}" looks like a credential — use auth type "API key in query" (encrypted) instead of a literal value.`);
    }
  }
}

function decodeURIComponentSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function checkPath(field: string, path: string, configKeys: string[], err: Report, warn: Report): void {
  const trimmed = path.trim();
  if (!trimmed) err(field, "Path is required, e.g. /reports?date_from={start}&date_to={end}");
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) err(field, "The path must be relative to the base URL (no scheme or host)");
  if (trimmed.includes("\\")) err(field, "Backslashes are not allowed in paths");
  if (/(^|\/)\.\.(\/|$|\?)/.test(trimmed)) warn(field, '".." segments can climb out of the base path — the request still stays on the base URL\'s host.');
  for (const e of validateTemplate(path, configKeys)) err(field, e);
  checkLiteralCredentials(field, trimmed, err);
}

function checkHeaders(headers: Record<string, string> | undefined, err: Report, warn: Report): void {
  const entries = Object.entries(headers ?? {});
  if (entries.length > 20) err("rest.headers", "At most 20 headers");
  for (const [name, value] of entries) {
    const field = `rest.headers.${name}`;
    if (!HEADER_NAME.test(name)) err(field, `"${name}" is not a valid header name`);
    else if (FORBIDDEN_HEADERS.has(name.toLowerCase())) err(field, `The ${name} header is set by the server`);
    else if (CREDENTIAL_HEADER.test(name)) err(field, "Put credentials in the auth settings (encrypted) — header values are stored in plain text.");
    if (/[\r\n]/.test(value)) err(field, "Header values can't contain line breaks");
    if (templateVariables(value).length) warn(field, "Header values are sent as-is (templates are not rendered in headers).");
  }
}

function checkPagination(spec: RestSourceSpec, err: Report, warn: Report): void {
  const pg = spec.report.pagination;
  const path = spec.report.path;
  if (!pg || pg.type === "none") {
    for (const v of ["cursor", "page", "offset"]) if (path.includes(`{${v}}`)) warn("rest.report.pagination", `{${v}} is used in the path but pagination is off — it renders empty.`);
    return;
  }
  const placeholder = `{${pg.type}}`;
  if (!pg.param && !path.includes(placeholder)) err("rest.report.pagination.param", `Set the query parameter name for the ${pg.type}, or put ${placeholder} in the path`);
  if (pg.type === "cursor") {
    if (!pg.cursorPath) err("rest.report.pagination.cursorPath", "cursorPath (where the next cursor is in the response) is required for cursor pagination");
    else checkDotPath("rest.report.pagination.cursorPath", pg.cursorPath, err);
  } else if (!pg.pageSize) {
    warn("rest.report.pagination.pageSize", "Set pageSize to the API's page size — paging stops at the first page shorter than it (default 100).");
  }
}

function checkDotPath(field: string, path: string, err: Report): void {
  try {
    parsePath(path);
  } catch (e) {
    err(field, e instanceof PathError ? e.message : "Invalid path");
  }
}

function checkRef(field: string, ref: FieldRef | undefined, err: Report): void {
  if (ref === undefined) return;
  if (typeof ref === "string") return checkDotPath(field, ref, err);
  if (ref.expr) {
    try {
      parseFormula(ref.expr);
    } catch (e) {
      err(field, e instanceof FormulaError ? `${e.message} (at character ${e.position})` : "Invalid formula");
    }
    return;
  }
  if (!ref.path) return err(field, "Set a path or an expr");
  checkDotPath(field, ref.path, err);
}

function checkMapping(spec: RestSourceSpec, err: Report): void {
  const mp = spec.mapping;
  const refs: [string, FieldRef | undefined][] = [
    ["date", mp.date],
    ["spend", mp.spend],
    ["impressions", mp.impressions],
    ["clicks", mp.clicks],
    ["conversions", mp.conversions],
    ["conversionValue", mp.conversionValue],
    ["campaign", mp.campaign],
    ["storeRevenue", mp.storeRevenue],
    ["sessions", mp.sessions],
    ["orders", mp.orders],
  ];
  for (const [k, ref] of refs) checkRef(`rest.mapping.${k}`, ref, err);
  if (typeof mp.date !== "string" && !mp.date.path) err("rest.mapping.date", "The date field needs a path");
  if (mp.dedupeKey) checkDotPath("rest.mapping.dedupeKey", mp.dedupeKey, err);
  if (mp.currency && !/^[A-Z]{3}$/.test(mp.currency)) err("rest.mapping.currency", "Currency must be a 3-letter ISO code, e.g. USD");
}

/** Shape the validator output for the API. */
export function toValidationResult(v: { manifest: PluginManifest | null; issues: ManifestIssue[] }): ManifestValidationResult {
  const fmt = (i: ManifestIssue) => (i.path ? `${i.path}: ${i.message}` : i.message);
  const errors = v.issues.filter((i) => i.level === "error").map(fmt);
  return {
    ok: errors.length === 0 && v.manifest !== null,
    errors,
    warnings: v.issues.filter((i) => i.level === "warning").map(fmt),
    issues: v.issues,
    manifest: v.manifest ? publicManifest(v.manifest) : null,
  };
}

/** Variables a report path may use (for the builder's hint list). */
export const REPORT_TEMPLATE_VARS: readonly string[] = [...TEMPLATE_VARS, "config.<field>"];
