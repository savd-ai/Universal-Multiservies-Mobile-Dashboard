import "server-only";
import type { PluginManifest, RestAuth, RestSourceSpec } from "@/lib/domain/contracts/plugins";
import { addDays, diffDays, minDate, todayInTz, type DateRange } from "@/lib/domain/dates";
import { getPath } from "@/lib/domain/plugins/dot-path";
import { formatDateFor, mapRows, renderTemplate } from "@/lib/domain/plugins/mapping";
import type { PlatformDailyRow } from "@/lib/domain/schema/facts";
import { Lru, singleton } from "../cache";
import { resolveSecret } from "../crypto/secrets";
import { appConfig } from "../env/config";
import { AppError } from "../http/errors";
import { redact } from "../log";
import { getStore } from "../store";
import { definePlugin, type PluginContext, type PluginRuntime, type PreviewResult } from "./define";
import { mockPlatformHandle } from "./mock-platform";

// Generic REST connector behind no-code custom plugins: templated report URL, auth injection, pagination,
// dot-path field mapping, FX, caching, test + preview. All network I/O goes through ctx.fetch (SSRF-guarded);
// the base URL mock://platform is answered in-process by the mock platform, so the guard is never loosened.

const cache = () => singleton("plugins:rest-cache", () => new Lru<PlatformDailyRow[]>(200, 60 * 60_000));
const TTL: Record<PluginManifest["refresh"], number> = { manual: 24 * 3600_000, hourly: 3600_000, daily: 6 * 3600_000 };

/** The REST spec plus the manifest's declared config keys (for {config.x} templates). */
type EngineSpec = RestSourceSpec & { configKeys?: readonly string[] };

interface FetchOutcome {
  items: unknown[];
  firstRaw: unknown;
  pages: number;
}

interface AuthParts {
  headers: Record<string, string>;
  query: Record<string, string>;
  /** credential values in use — scrubbed from any error text or sample */
  secrets: string[];
}

function authParts(auth: RestAuth, manifestId: string, ctx: PluginContext): AuthParts {
  const headers: Record<string, string> = {};
  const query: Record<string, string> = {};
  const secrets: string[] = [];
  const secret = (ref: unknown, fallbackKey: string) => {
    const fromRef = ref ? resolveSecret(ref as never, `plugins:${manifestId}:auth`) : undefined;
    const v = fromRef ?? ctx.config[fallbackKey];
    if (v) secrets.push(v);
    return v;
  };
  switch (auth.type) {
    case "none":
      break;
    case "api_key_header": {
      const v = secret(auth.secret, "apiKey");
      if (v) headers[auth.header] = v;
      break;
    }
    case "api_key_query": {
      const v = secret(auth.secret, "apiKey");
      if (v) query[auth.param] = v;
      break;
    }
    case "bearer": {
      const v = secret(auth.secret, "token");
      if (v) headers.Authorization = `Bearer ${v}`;
      break;
    }
    case "basic": {
      const pw = secret(auth.password, "password") ?? "";
      headers.Authorization = `Basic ${Buffer.from(`${auth.username}:${pw}`).toString("base64")}`;
      break;
    }
  }
  return { headers, query, secrets };
}

/** Add query params without re-serializing the template's own (searchParams.set would turn %20 into +). */
function appendQuery(u: URL, params: Record<string, string>): void {
  const extra = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  if (extra.length) u.search = `${u.search ? `${u.search}&` : "?"}${extra.join("&")}`;
}

function scrub(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const s of secrets) if (s.length >= 4) out = out.split(s).join("[redacted]");
  return redact(out);
}

async function request(spec: RestSourceSpec, manifestId: string, ctx: PluginContext, pathTemplate: string, vars: Record<string, string>): Promise<unknown> {
  const rendered = renderTemplate(pathTemplate, vars, "url");
  const auth = authParts(spec.auth, manifestId, ctx);
  const headers: Record<string, string> = { Accept: "application/json", ...(spec.headers ?? {}), ...auth.headers };
  const body = spec.report.method === "POST" && spec.report.body ? renderTemplate(spec.report.body, vars, "json") : undefined;
  if (body) headers["Content-Type"] = "application/json";

  if (spec.baseUrl.startsWith("mock://")) {
    const u = new URL(rendered.replace(/^\/*/, "/"), "http://mock/");
    appendQuery(u, auth.query);
    const res = mockPlatformHandle(`${u.pathname}${u.search}`, new Headers(headers));
    if (res.status >= 400) throw new AppError("UPSTREAM_ERROR", scrub(`HTTP ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`, auth.secrets));
    return res.body;
  }

  const base = new URL(spec.baseUrl);
  const basePath = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`;
  const target = new URL(rendered.replace(/^\//, ""), `${base.origin}${basePath}`);
  if (target.origin !== base.origin) throw new AppError("SSRF_BLOCKED", "The report path must stay on the base URL's host");
  appendQuery(target, auth.query);
  let res: Response;
  try {
    res = await ctx.fetch(target.toString(), { method: spec.report.method, headers, body, timeoutMs: spec.limits?.timeoutMs, maxBytes: spec.limits?.maxBytes });
  } catch (err) {
    if (err instanceof AppError) throw new AppError(err.code, scrub(err.message, auth.secrets));
    throw new AppError("UPSTREAM_ERROR", scrub(err instanceof Error ? err.message : "Request failed", auth.secrets));
  }
  const text = await res.text();
  if (!res.ok) throw new AppError("UPSTREAM_ERROR", scrub(`HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`, auth.secrets));
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("UPSTREAM_ERROR", "The endpoint did not return JSON");
  }
}

function dateVars(spec: RestSourceSpec, start: string, end: string): Record<string, string> {
  return {
    start: formatDateFor(start, spec.report.dateFormat),
    end: formatDateFor(end, spec.report.dateFormat, true),
    start_compact: start.replace(/-/g, ""),
    end_compact: end.replace(/-/g, ""),
    start_unix: formatDateFor(start, "unix"),
    end_unix: formatDateFor(end, "unix", true),
  };
}

/** {config.<key>} template values — only the manifest's declared config fields (never the auth credential). */
function configVars(spec: EngineSpec, ctx: PluginContext): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of spec.configKeys ?? []) {
    const v = ctx.config[k];
    if (v !== undefined) out[`config.${k}`] = v;
  }
  return out;
}

async function fetchRange(spec: EngineSpec, manifestId: string, ctx: PluginContext, range: DateRange): Promise<FetchOutcome> {
  const items: unknown[] = [];
  let firstRaw: unknown = undefined;
  let pages = 0;
  const chunk = spec.report.chunkDays ?? 92;
  for (let start = range.start; start <= range.end; start = addDays(start, chunk)) {
    const end = minDate(addDays(start, chunk - 1), range.end);
    const pg = spec.report.pagination ?? { type: "none" as const };
    const pageSize = pg.pageSize ?? 100;
    let cursor = "";
    let page = 1;
    let offset = 0;
    for (let i = 0; i < (pg.maxPages ?? 50); i++) {
      const vars: Record<string, string> = { ...dateVars(spec, start, end), cursor, page: String(page), page_size: String(pageSize), offset: String(offset), ...configVars(spec, ctx) };
      let path = spec.report.path;
      if (pg.type !== "none" && pg.param && !path.includes(`{${pg.type}}`)) {
        const value = pg.type === "cursor" ? cursor : pg.type === "page" ? String(page) : String(offset);
        if (pg.type !== "cursor" || cursor) path += `${path.includes("?") ? "&" : "?"}${pg.param}=${encodeURIComponent(value)}`;
      }
      if (pg.pageSizeParam && !path.includes("{page_size}")) path += `${path.includes("?") ? "&" : "?"}${pg.pageSizeParam}=${pageSize}`;
      const json = await request(spec, manifestId, ctx, path, vars);
      pages++;
      if (firstRaw === undefined) firstRaw = json;
      const rows = getPath(json, spec.report.rowsPath);
      if (!Array.isArray(rows)) throw new AppError("VALIDATION_ERROR", `rowsPath "${spec.report.rowsPath}" did not resolve to a list in the response`);
      items.push(...rows);
      if (pg.type === "none") break;
      if (pg.type === "cursor") {
        const next = pg.cursorPath ? getPath(json, pg.cursorPath) : undefined;
        if (next === null || next === undefined || next === "" || String(next) === cursor) break;
        cursor = String(next);
      } else if (pg.type === "page") {
        if (rows.length < pageSize) break;
        page++;
      } else {
        if (rows.length < pageSize) break;
        offset += pageSize;
      }
    }
    if (diffDays(start, range.end) < chunk) break;
  }
  return { items, firstRaw, pages };
}

const SENSITIVE_KEY = /(token|secret|passw|api[-_]?key|access[-_]?key|private[-_]?key|authorization|credential|cookie|session)/i;

function redactSample(v: unknown, depth = 0): unknown {
  if (depth > 6) return "…";
  if (Array.isArray(v)) return v.slice(0, 3).map((x) => redactSample(x, depth + 1));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v).slice(0, 30)) out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : redactSample(x, depth + 1);
    return out;
  }
  if (typeof v === "string") return redact(v).slice(0, 200);
  return v;
}

/** FX into the account currency: FX_RATES / settings hold units of X per 1 unit of the account currency. */
async function fxFor(ctx: PluginContext): Promise<(amount: number, from: string) => number | null> {
  const settings = await getStore().settings.get().catch(() => null);
  const rates: Record<string, number> = { ...appConfig().fxRates, ...(settings?.fxRates ?? {}) };
  return (amount, from) => {
    if (from === ctx.account.currency) return amount;
    const r = rates[from];
    return r && r > 0 ? amount / r : null;
  };
}

/** Yesterday in the account's time zone (complete data). */
function accountYesterday(ctx: PluginContext): string {
  let today: string;
  try {
    today = todayInTz(ctx.account.timezone, ctx.now);
  } catch {
    today = ctx.now.toISOString().slice(0, 10);
  }
  return addDays(today, -1);
}

export function createRestPlugin(manifest: PluginManifest, version = 1): PluginRuntime {
  if (!manifest.rest) throw new AppError("VALIDATION_ERROR", `Plugin ${manifest.id} has no REST source`);
  const spec: EngineSpec = { ...manifest.rest, configKeys: (manifest.configFields ?? []).map((f) => f.key) };
  const adPlatform = manifest.category !== "analytics" && manifest.category !== "commerce";

  const map = async (items: unknown[], range: DateRange, ctx: PluginContext) =>
    mapRows(items, spec, { accountId: ctx.account.id, platform: manifest.id, accountCurrency: ctx.account.currency, range, fx: await fxFor(ctx) });

  const fetchMetrics = async (range: DateRange, ctx: PluginContext) => {
    const key = `${manifest.id}|v${version}|${ctx.account.id}|${range.start}|${range.end}`;
    const hit = cache().get(key);
    if (hit) return hit;
    const out = await fetchRange(spec, manifest.id, ctx, range);
    const { rows } = await map(out.items, range, ctx);
    cache().set(key, rows, TTL[manifest.refresh]);
    return rows;
  };

  return definePlugin({
    manifest,
    demoKind: manifest.category === "analytics" ? "analytics" : manifest.category === "commerce" ? "commerce" : "ad_platform",
    fetchMetrics,
    async testConnection(ctx) {
      try {
        const end = accountYesterday(ctx);
        if (spec.test?.path) {
          await request(spec, manifest.id, ctx, spec.test.path, { ...dateVars(spec, end, end), cursor: "", page: "1", page_size: "1", offset: "0", ...configVars(spec, ctx) });
          return { ok: true, message: "Connected — the test endpoint answered." };
        }
        const out = await fetchRange(spec, manifest.id, ctx, { start: addDays(end, -1), end });
        return { ok: true, message: `Connected — ${out.items.length} row${out.items.length === 1 ? "" : "s"} for the last 2 days.`, details: { items: out.items.length, pages: out.pages } };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : "Connection failed" };
      }
    },
    async preview(range, ctx): Promise<PreviewResult> {
      const t0 = Date.now();
      const out = await fetchRange(spec, manifest.id, ctx, range);
      const mapped = await map(out.items, range, ctx);
      const warnings = [...mapped.warnings];
      if (!out.items.length) warnings.push(`The endpoint returned no rows for ${range.start} – ${range.end}.`);
      if (adPlatform && out.items.length && !mapped.rows.some((r) => r.cost > 0)) warnings.push("No spend was mapped — check the spend field path.");
      if (!adPlatform && out.items.length && !mapped.rows.some((r) => (r.store_revenue ?? 0) > 0 || (r.sessions ?? 0) > 0)) {
        warnings.push(manifest.category === "commerce" ? "No store revenue was mapped — set mapping.storeRevenue." : "No sessions were mapped — set mapping.sessions.");
      }
      const rowsSample = getPath(out.firstRaw, spec.report.rowsPath);
      return {
        rawSample: redactSample(Array.isArray(rowsSample) ? rowsSample : out.firstRaw),
        rows: mapped.rows.slice(0, 20),
        warnings,
        tookMs: Date.now() - t0,
        stats: { items: out.items.length, pages: out.pages, mappedRows: mapped.rows.length, range },
      };
    },
  });
}

export function invalidateRestCache(pluginId?: string): void {
  if (pluginId) cache().delete(`${pluginId}|`);
  else cache().clear();
}
