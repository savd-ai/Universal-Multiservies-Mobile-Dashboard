import type { FieldRef, RestSourceSpec } from "../contracts/plugins";
import { isCivilDate, toCivil } from "../dates";
import { compileFormula } from "../metrics/formula";
import type { PlatformDailyRow } from "../schema/facts";
import { getPath, toNumber } from "./dot-path";

// Templating and field mapping for no-code REST plugins.

export const TEMPLATE_VARS = ["start", "end", "start_compact", "end_compact", "start_unix", "end_unix", "cursor", "page", "page_size", "offset"] as const;

export function formatDateFor(d: string, fmt: RestSourceSpec["report"]["dateFormat"], endOfDay = false): string {
  switch (fmt) {
    case "YYYY-MM-DD":
      return d;
    case "YYYYMMDD":
      return d.replace(/-/g, "");
    case "unix":
      return String(Math.floor(Date.parse(`${d}T${endOfDay ? "23:59:59" : "00:00:00"}Z`) / 1000));
    case "unix_ms":
      return String(Date.parse(`${d}T${endOfDay ? "23:59:59" : "00:00:00"}Z`));
    case "iso":
      return `${d}T${endOfDay ? "23:59:59" : "00:00:00"}Z`;
  }
}

/** Variables referenced by a template ({start}, {config.account_id} …). */
export function templateVariables(template: string): string[] {
  return [...template.matchAll(/\{([a-zA-Z0-9_.]+)\}/g)].map((m) => m[1] as string);
}

export function validateTemplate(template: string, configKeys: readonly string[]): string[] {
  const errors: string[] = [];
  for (const v of templateVariables(template)) {
    if ((TEMPLATE_VARS as readonly string[]).includes(v)) continue;
    if (v.startsWith("config.") && configKeys.includes(v.slice(7))) continue;
    errors.push(`Unknown template variable {${v}}`);
  }
  return errors;
}

export function renderTemplate(template: string, vars: Record<string, string>, encode: "url" | "json" | "none"): string {
  return template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_, name: string) => {
    const v = vars[name];
    if (v === undefined) return "";
    if (encode === "url") return encodeURIComponent(v);
    if (encode === "json") return JSON.stringify(v).slice(1, -1);
    return v;
  });
}

type Compiled = ReturnType<typeof compileFormula>;

/** A field reference prepared once per mapping run (formulas compiled up front, not per row). */
interface PreparedRef {
  path?: string;
  transform?: "number" | "micros" | "cents" | "percent" | "sum";
  formula?: Compiled;
}

function prepare(ref: FieldRef | undefined): PreparedRef | null {
  if (ref === undefined) return null;
  if (typeof ref === "string") return ref ? { path: ref } : null;
  if (ref.expr) return { formula: compileFormula(ref.expr) };
  return ref.path ? { path: ref.path, transform: ref.transform } : null;
}

/** Formula identifiers read top-level keys; `a__b` reaches the nested field `a.b` (dots aren't identifiers). */
function formulaValue(row: unknown, name: string): number | null {
  const top = getPath(row, name);
  if (top !== undefined || !name.includes("__")) return toNumber(top);
  return toNumber(getPath(row, name.split("__").join(".")));
}

function sumValues(raw: unknown): number {
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.reduce<number>((s, x) => s + (toNumber(typeof x === "object" && x !== null && "value" in x ? (x as { value: unknown }).value : x) ?? 0), 0);
}

function applyRef(row: unknown, ref: PreparedRef | null): number | null {
  if (!ref) return null;
  if (ref.formula) return ref.formula.run((name) => formulaValue(row, name));
  if (!ref.path) return null;
  if (ref.transform === "sum") return sumValues(getPath(row, ref.path, { all: true }));
  const raw = getPath(row, ref.path);
  const n = toNumber(raw);
  if (n === null) return null;
  switch (ref.transform) {
    case "micros":
      return n / 1_000_000;
    case "cents":
      return n / 100;
    case "percent":
      // "12.5" → 0.125; "12.5%" is already a fraction after toNumber
      return typeof raw === "string" && raw.trim().endsWith("%") ? n : n / 100;
    default:
      return n;
  }
}

/** Evaluate one field reference against one item (used by tests and the builder's field probe). */
export function readField(row: unknown, ref: FieldRef | undefined): number | null {
  return applyRef(row, prepare(ref));
}

export function parseRowDate(v: unknown, fmt: RestSourceSpec["report"]["dateFormat"]): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    // 20260928 as a number is a compact date, not a timestamp
    if (fmt === "YYYYMMDD" || (Number.isInteger(v) && v >= 19_000_101 && v <= 21_001_231 && fmt !== "unix" && fmt !== "unix_ms")) {
      const s = String(v);
      const d = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
      return isCivilDate(d) ? d : null;
    }
    const ms = fmt === "unix" || (fmt !== "unix_ms" && v < 1e11) ? v * 1000 : v;
    return toCivil(ms);
  }
  const s = String(v).trim();
  if (/^\d{8}$/.test(s)) {
    const d = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    return isCivilDate(d) ? d : null;
  }
  if (/^\d{9,13}$/.test(s)) return parseRowDate(Number(s), fmt);
  const iso = s.slice(0, 10);
  if (isCivilDate(iso)) return iso;
  const t = Date.parse(s);
  return Number.isFinite(t) ? toCivil(t) : null;
}

export interface MappedRows {
  rows: PlatformDailyRow[];
  warnings: string[];
  /** items skipped as duplicates (same dedupeKey, or byte-identical items) */
  duplicates: number;
}

export interface MapContext {
  accountId: string;
  platform: string;
  accountCurrency: string;
  range: { start: string; end: string };
  /** convert an amount into the account currency; null = no rate (value excluded) */
  fx: (amount: number, from: string) => number | null;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Map raw API items to daily platform rows (summed per date × campaign). */
export function mapRows(items: unknown[], spec: RestSourceSpec, ctx: MapContext): MappedRows {
  const m = spec.mapping;
  const refs = {
    spend: prepare(m.spend),
    impressions: prepare(m.impressions),
    clicks: prepare(m.clicks),
    conversions: prepare(m.conversions),
    conversionValue: prepare(m.conversionValue),
    storeRevenue: prepare(m.storeRevenue),
    sessions: prepare(m.sessions),
    orders: prepare(m.orders),
  };
  const datePath = typeof m.date === "string" ? m.date : m.date.path;
  const campaignPath = m.campaign === undefined ? undefined : typeof m.campaign === "string" ? m.campaign : m.campaign.path;
  const currency = m.currency ?? ctx.accountCurrency;

  const warnings: string[] = [];
  const byKey = new Map<string, PlatformDailyRow>();
  const seen = new Set<string>();
  let outOfRange = 0;
  let badDate = 0;
  let noFx = 0;
  let duplicates = 0;

  const money = (v: number | null) => {
    if (v === null) return 0;
    if (currency === ctx.accountCurrency) return v;
    const c = ctx.fx(v, currency);
    if (c === null) {
      noFx++;
      return 0;
    }
    return c;
  };

  for (const item of items) {
    const identity = m.dedupeKey ? getPath(item, m.dedupeKey) : undefined;
    const fingerprint = identity !== undefined && identity !== null ? `id:${String(identity)}` : m.dedupeKey ? null : `raw:${stableJson(item)}`;
    if (fingerprint) {
      if (seen.has(fingerprint)) {
        duplicates++;
        continue;
      }
      seen.add(fingerprint);
    }
    const date = parseRowDate(datePath ? getPath(item, datePath) : undefined, spec.report.dateFormat);
    if (!date) {
      badDate++;
      continue;
    }
    if (date < ctx.range.start || date > ctx.range.end) {
      outOfRange++;
      continue;
    }
    const campaignRaw = campaignPath ? getPath(item, campaignPath) : undefined;
    const campaign = campaignRaw === undefined || campaignRaw === null || typeof campaignRaw === "object" ? undefined : String(campaignRaw).slice(0, 200);
    const key = `${date}|${campaign ?? ""}`;
    const row = byKey.get(key) ?? { date, account_id: ctx.accountId, platform: ctx.platform, platform_campaign: campaign, currency: ctx.accountCurrency, cost: 0, impressions: 0, clicks: 0, conversions: 0, conv_value: 0 };
    row.cost += money(applyRef(item, refs.spend));
    row.impressions += applyRef(item, refs.impressions) ?? 0;
    row.clicks += applyRef(item, refs.clicks) ?? 0;
    row.conversions += applyRef(item, refs.conversions) ?? 0;
    row.conv_value += money(applyRef(item, refs.conversionValue));
    if (refs.storeRevenue) row.store_revenue = (row.store_revenue ?? 0) + money(applyRef(item, refs.storeRevenue));
    if (refs.sessions) row.sessions = (row.sessions ?? 0) + (applyRef(item, refs.sessions) ?? 0);
    if (refs.orders) row.orders = (row.orders ?? 0) + (applyRef(item, refs.orders) ?? 0);
    byKey.set(key, row);
  }
  if (badDate) warnings.push(`${plural(badDate, "row")} had no parseable date and ${badDate === 1 ? "was" : "were"} skipped.`);
  if (outOfRange) warnings.push(`${plural(outOfRange, "row")} fell outside the requested dates and ${outOfRange === 1 ? "was" : "were"} dropped.`);
  if (noFx) warnings.push(`${plural(noFx, "value")} had no exchange rate from ${currency} into ${ctx.accountCurrency} and ${noFx === 1 ? "was" : "were"} excluded.`);
  if (duplicates) warnings.push(`${plural(duplicates, "duplicate row")} ${duplicates === 1 ? "was" : "were"} ignored.`);
  const rows = [...byKey.values()].sort((a, b) => (a.date === b.date ? (a.platform_campaign ?? "").localeCompare(b.platform_campaign ?? "") : a.date < b.date ? -1 : 1));
  return { rows, warnings, duplicates };
}

/** JSON with sorted keys, so two identical items with different key order dedupe too. */
function stableJson(v: unknown, depth = 0): string {
  if (depth > 8 || v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map((x) => stableJson(x, depth + 1)).join(",")}]`;
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k], depth + 1)}`).join(",")}}`;
}
