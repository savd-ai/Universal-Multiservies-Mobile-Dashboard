import type { ChatChart } from "../contracts/ai";
import { addDays, addMonths, formatRange, isCivilDate, make, monthEnd, parts, PRESET_LABELS, quarterStart, weekStart, type DatePreset } from "../dates";
import { BUILTIN_METRICS } from "../metrics/registry";
import type { QueryFilter, QueryHaving, QuerySpecInput } from "../query/spec";
import { DIMENSIONS, type DimensionKey } from "../schema/dimensions";
import type { CivilDate, MetricDirection, MetricFormat } from "../types";

// NL-lite: a rule-based question → QuerySpec parser used when no AI provider is available (or step 1 of the AI
// planner fails). Lexicons cover metrics, dimensions, time phrases, top/worst N, compare, filters and having.
// Pure and deterministic; the chat service validates every spec with planQuery before running it.

export interface NlMetricInfo {
  key: string;
  label: string;
  direction: MetricDirection;
  format: MetricFormat;
}

export interface NlLiteContext {
  today: CivilDate;
  /** registry metrics (built-ins + custom); defaults to the built-ins */
  metrics?: readonly NlMetricInfo[];
  /** campaign names, so "for Competitor Terms" becomes a filter */
  campaignNames?: readonly string[];
}

export interface NlLiteQuery {
  title: string;
  chart: ChatChart["type"];
  spec: QuerySpecInput;
}

export interface NlLiteResult {
  intent: "query" | "clarify";
  queries: NlLiteQuery[];
  /** how ambiguous phrases were read, e.g. "“last week” = Mon–Sun of the previous week" */
  notes: string[];
  examples: string[];
}

export const NL_EXAMPLES = [
  "Spend, conversions and CPA last 7 days vs previous period",
  "Top 5 campaigns by ROAS last 30 days",
  "CPA by device this month",
  "Search terms with no conversions last 30 days",
  "Daily spend for PMax campaigns in the last 14 days",
  "Cross-channel spend and ROAS by platform last month",
];

// ── Lexicons ───────────────────────────────────────────────────────────────────────────────────────────

/** Specific phrases first: matched spans are blanked so "cost per conversion" never also counts as cost. */
const METRIC_LEXICON: [RegExp, string][] = [
  [/\bcost per (?:acquisition|conversion|conv|sale|order|purchase|lead)s?\b|\bcpa\b|\bcost\/conv\.?/g, "cpa"],
  [/\bcost per click\b|\bcpc\b/g, "cpc"],
  [/\bcost per (?:thousand|mille)(?: impressions)?\b|\bcpm\b/g, "cpm"],
  [/\breturn on ad spend\b|\broas\b/g, "roas"],
  [/\bclick[- ]?through(?: rate)?\b|\bctr\b/g, "ctr"],
  [/\bconv(?:ersion)?\.? ?rate\b|\bcvr\b/g, "cvr"],
  [/\b(?:avg\.?|average) order value\b|\baov\b/g, "aov"],
  [/\blost (?:impression share|is) (?:to |due to |from )?budget\b|\blost is budget\b|\bbudget[- ]lost (?:impression share|is)\b/g, "lost_is_budget"],
  [/\blost (?:impression share|is) (?:to |due to |from )?(?:ad )?rank\b|\blost is rank\b|\brank[- ]lost (?:impression share|is)\b/g, "lost_is_rank"],
  [/\b(?:search )?impr(?:ession)?\.? share\b|\bsearch is\b/g, "search_is"],
  [/\bquality scores?\b|\bqs\b/g, "avg_qs"],
  [/\bmarketing efficiency ratio\b|\bmer\b/g, "mer"],
  [/\bconv(?:ersion)?s?\.? value\b|\brevenue\b|\bsales value\b|\bvalue\b/g, "conv_value"],
  [/\bconversions?\b|\bconvs?\b|\bpurchases\b|\bsales\b|\borders\b|\bleads\b/g, "conversions"],
  [/\bclicks?\b/g, "clicks"],
  [/\bimpressions?\b|\bimpr\b/g, "impressions"],
  [/\bad spend\b|\bspend(?:ing)?\b|\bspent\b|\bcosts?\b/g, "cost"],
];

/** Ratio metrics expand to their components when they are the only metric asked for. */
const COMPONENTS: Record<string, string[]> = {
  roas: ["cost", "conv_value"],
  cpa: ["cost", "conversions"],
  ctr: ["clicks", "impressions"],
  cpc: ["cost", "clicks"],
  cvr: ["conversions", "clicks"],
  cpm: ["cost", "impressions"],
  aov: ["conv_value", "conversions"],
  mer: ["cost"],
};

const DEFAULT_METRICS = ["cost", "conversions", "cpa", "roas"];

const DIMENSION_LEXICON: [RegExp, DimensionKey][] = [
  [/\bsearch (?:terms?|quer(?:y|ies))\b|\bqueries\b/g, "search_term"],
  [/\bday of (?:the )?week\b|\bweekdays?\b|\bday-of-week\b|\bby dow\b/g, "dow"],
  [/\bhour of (?:the )?day\b|\btime of day\b|\bhourly\b|\bby hour\b|\bper hour\b|\bhours\b/g, "hour"],
  [/\bcampaign types?\b|\bchannel types?\b|\bby (?:campaign )?type\b|\bper type\b|\bby channel\b|\bper channel\b/g, "campaign_type"],
  [/\bmatch types?\b/g, "match_type"],
  [/\bbid(?:ding)? strateg(?:y|ies)\b/g, "bidding_strategy"],
  [/\bad ?groups?\b/g, "ad_group"],
  [/\bkeywords?\b/g, "keyword"],
  [/\bcampaigns?\b/g, "campaign"],
  [/\bdevices?\b|\bmobile vs\.? desktop\b|\bdesktop vs\.? mobile\b/g, "device"],
  [/\bcountr(?:y|ies)\b|\bgeos?\b|\bgeograph(?:y|ic)\b|\blocations?\b|\bby region\b|\bmarkets?\b/g, "country"],
  [/\bweekly\b|\bby week\b|\bper week\b|\beach week\b|\bweek by week\b/g, "week"],
  [/\bmonthly\b|\bby month\b|\bper month\b|\beach month\b|\bmonth by month\b/g, "month"],
  [/\bquarterly\b|\bby quarter\b|\bper quarter\b/g, "quarter"],
  [/\bdaily\b|\bby day\b|\bper day\b|\beach day\b|\bday by day\b|\btrend(?:s|ing)?\b|\bover time\b|\btime series\b/g, "date"],
  [/\bby status\b|\bcampaign status\b/g, "campaign_status"],
];

const CROSS_CHANNEL_RE = /\bcross[- ]?(?:channel|platform)\b|\ball (?:channels|platforms)\b|\bblended\b|\bby platform\b|\bper platform\b|\bplatforms\b|\bchannel mix\b/g;

/** Campaign-type filters consume a trailing "campaigns" (a type alone asks for a filtered total). */
const TYPE_FILTERS: [RegExp, string][] = [
  [/\bsearch (?:campaigns?|ads?|network)\b|\bon search\b|\bsearch only\b/g, "Search"],
  [/\b(?:pmax|p-max|performance max)(?: campaigns?)?\b/g, "PMax"],
  [/\bshopping(?: campaigns?| ads?)?\b/g, "Shopping"],
  [/\bvideo (?:campaigns?|ads?)\b|\byoutube(?: campaigns?| ads?)?\b|\bon video\b/g, "Video"],
  [/\bdisplay (?:campaigns?|ads?|network)\b|\bon display\b|\bgdn\b/g, "Display"],
  [/\b(?:demand gen(?:eration)?|discovery)(?: campaigns?)?\b/g, "Demand Gen"],
  [/\bapp campaigns?\b/g, "App"],
];

const DEVICE_WORDS: Record<string, string> = { mobile: "Mobile", phone: "Mobile", phones: "Mobile", desktop: "Desktop", computer: "Desktop", computers: "Desktop", tablet: "Tablet", tablets: "Tablet", tv: "Connected TV", ctv: "Connected TV", "connected tv": "Connected TV" };

const COUNTRY_WORDS: [RegExp, string][] = [
  [/\b(?:in|from) (?:the )?(?:us|usa|u\.s\.a?\.?|united states|america)\b|\bfor (?:the )?(?:usa|united states)\b/g, "US"],
  [/\b(?:in|from|for) canada\b/g, "CA"],
  [/\b(?:in|from|for) (?:the )?(?:uk|u\.k\.|united kingdom|great britain|britain|england)\b/g, "GB"],
  [/\b(?:in|from|for) australia\b/g, "AU"],
  [/\b(?:in|from|for) germany\b/g, "DE"],
  [/\b(?:in|from|for) france\b/g, "FR"],
  [/\b(?:in|from|for) vietnam\b/g, "VN"],
  [/\b(?:in|from|for) japan\b/g, "JP"],
  [/\b(?:in|from|for) singapore\b/g, "SG"],
];

const MONTHS: Record<string, number> = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
const MONTH_ALT = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec";

const PRESET_BY_DAYS: Record<number, DatePreset> = { 7: "last_7d", 14: "last_14d", 28: "last_28d", 30: "last_30d", 90: "last_90d", 365: "last_365d" };

// ── Text helpers ───────────────────────────────────────────────────────────────────────────────────────

/** Mutable working text: matches are blanked (same length) so indices stay stable and nothing matches twice. */
class Text {
  constructor(public value: string) {}
  take(re: RegExp): RegExpExecArray[] {
    const out: RegExpExecArray[] = [];
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    for (let m = g.exec(this.value); m; m = g.exec(this.value)) {
      out.push(m);
      if (m[0].length === 0) g.lastIndex++;
    }
    for (const m of out) this.blank(m.index, m[0].length);
    return out;
  }
  blank(index: number, length: number): void {
    this.value = this.value.slice(0, index) + " ".repeat(length) + this.value.slice(index + length);
  }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’`]/g, "'")
    .replace(/[–—]/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMonthDay(s: string, today: CivilDate): CivilDate | null {
  const m = /^([a-z]{3,9})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/.exec(s.trim());
  if (!m) return null;
  const month = MONTHS[m[1] ?? ""];
  if (!month) return null;
  const day = Number(m[2]);
  const t = parts(today);
  let y = m[3] ? Number(m[3]) : t.y;
  let d = make(y, month, day);
  if (!m[3] && d >= today) d = make((y = t.y - 1), month, day);
  return isCivilDate(d) ? d : null;
}

// ── Date ranges ────────────────────────────────────────────────────────────────────────────────────────

interface ParsedRange {
  spec: { preset: DatePreset } | { start: CivilDate; end: CivilDate };
  label: string;
}

const presetRange = (preset: DatePreset): ParsedRange => ({ spec: { preset }, label: PRESET_LABELS[preset] });
const customRange = (start: CivilDate, end: CivilDate): ParsedRange => {
  const [s, e] = start <= end ? [start, end] : [end, start];
  return { spec: { start: s, end: e }, label: formatRange({ start: s, end: e }) };
};

function monthRange(month: number, year: number | null, today: CivilDate): ParsedRange {
  const yesterday = addDays(today, -1);
  let y = year ?? parts(today).y;
  let start = make(y, month, 1);
  if (!year && start > yesterday) start = make((y = y - 1), month, 1);
  const end = monthEnd(start);
  return customRange(start, end > yesterday ? (yesterday < start ? start : yesterday) : end);
}

function parseDates(t: Text, today: CivilDate, notes: string[]): ParsedRange | null {
  const yesterday = addDays(today, -1);
  const iso = "(\\d{4}-\\d{2}-\\d{2})";
  const md = `((?:${MONTH_ALT})\\.? \\d{1,2}(?:,? \\d{4})?)`;

  let m = t.take(new RegExp(`\\b(?:between|from) ${iso} (?:and|to|until|through|-) ${iso}\\b`))[0];
  if (m && isCivilDate(m[1]) && isCivilDate(m[2])) return customRange(m[1], m[2]);
  m = t.take(new RegExp(`\\b(?:between|from) ${md} (?:and|to|until|through|-) ${md}\\b`))[0];
  if (m) {
    const a = parseMonthDay(m[1] ?? "", today);
    const b = parseMonthDay(m[2] ?? "", today);
    if (a && b) return customRange(a, b);
  }
  m = t.take(new RegExp(`\\bsince ${iso}\\b`))[0];
  if (m && isCivilDate(m[1])) return customRange(m[1], yesterday);
  m = t.take(new RegExp(`\\bsince ${md}\\b`))[0];
  if (m) {
    const a = parseMonthDay(m[1] ?? "", today);
    if (a) return customRange(a, yesterday);
  }
  m = t.take(new RegExp(`\\bsince (${MONTH_ALT})(?: (\\d{4}))?\\b`))[0];
  if (m) {
    const r = monthRange(MONTHS[m[1] ?? ""] ?? 1, m[2] ? Number(m[2]) : null, today);
    return customRange("start" in r.spec ? r.spec.start : yesterday, yesterday);
  }
  m = t.take(new RegExp(`\\b(?:on )?${iso}\\b`))[0];
  if (m && isCivilDate(m[1])) return customRange(m[1], m[1]);

  if (t.take(/\btoday\b|\bso far today\b/).length) return { spec: { preset: "today" }, label: "Today (partial day)" };
  if (t.take(/\byesterday\b/).length) return presetRange("yesterday");
  if (t.take(/\b(?:the )?(?:last|past) 24 hours\b/).length) {
    notes.push("Reports use complete days, so “last 24 hours” = yesterday.");
    return presetRange("yesterday");
  }

  m = t.take(/\b(?:(?:in )?the )?(?:last|past|previous|trailing|prior) (\d{1,3}) ?(days?|d|weeks?|w|months?|mo)\b/)[0] ?? t.take(/\b(\d{1,3}) ?(days?|d)\b(?! (?:ago|before))/)[0];
  if (m) {
    const n = Math.max(1, Math.min(730, Number(m[1])));
    const unit = (m[2] ?? "d").charAt(0);
    if (unit === "d") return PRESET_BY_DAYS[n] ? presetRange(PRESET_BY_DAYS[n] as DatePreset) : customRange(addDays(today, -n), yesterday);
    if (unit === "w") return customRange(addDays(today, -7 * n), yesterday);
    return customRange(addDays(addMonths(today, -n), 0), yesterday);
  }
  if (t.take(/\b(?:the )?last 12 months\b|\bpast year\b|\blast 365 days\b/).length) return presetRange("last_365d");
  if (t.take(/\bthis week\b|\bweek to date\b|\bwtd\b/).length) {
    const start = weekStart(today);
    return customRange(start, yesterday < start ? start : yesterday);
  }
  if (t.take(/\b(?:last|previous|past) week\b/).length) {
    const start = addDays(weekStart(today), -7);
    notes.push("“Last week” = Monday–Sunday of the previous week.");
    return customRange(start, addDays(start, 6));
  }
  if (t.take(/\bthis month\b|\bmonth to date\b|\bmtd\b/).length) return presetRange("mtd");
  if (t.take(/\b(?:last|previous|past) month\b/).length) return presetRange("last_month");
  if (t.take(/\bthis quarter\b|\bquarter to date\b|\bqtd\b/).length) return presetRange("qtd");
  if (t.take(/\b(?:last|previous|past) quarter\b/).length) return presetRange("last_quarter");
  if (t.take(/\bthis year\b|\byear to date\b|\bytd\b/).length) return presetRange("ytd");
  if (t.take(/\b(?:last|previous) year\b/).length) {
    const y = parts(today).y - 1;
    return customRange(make(y, 1, 1), make(y, 12, 31));
  }
  m = t.take(/\bq([1-4])(?: (\d{4}))?\b/)[0];
  if (m) {
    const q = Number(m[1]);
    let y = m[2] ? Number(m[2]) : parts(today).y;
    let start = make(y, (q - 1) * 3 + 1, 1);
    if (!m[2] && start > quarterStart(today)) start = make((y = y - 1), (q - 1) * 3 + 1, 1);
    const end = addDays(addMonths(start, 3), -1);
    return customRange(start, end > yesterday ? yesterday : end);
  }
  // "may" is only a month with a preposition or a year next to it
  m = t.take(new RegExp(`\\b(?:(?:in|for|during|of) )?(${MONTH_ALT.replace("|may", "")})(?: (\\d{4}))?\\b|\\b(?:in|for|during|of) (may)(?: (\\d{4}))?\\b|\\b(may) (\\d{4})\\b`))[0];
  if (m) {
    const name = m[1] ?? m[3] ?? m[5] ?? "";
    const year = m[2] ?? m[4] ?? m[6];
    const month = MONTHS[name];
    if (month) return monthRange(month, year ? Number(year) : null, today);
  }
  return null;
}

// ── Compare ────────────────────────────────────────────────────────────────────────────────────────────

function parseCompare(t: Text): { mode: "previous_period" | "previous_year"; defaultRange?: DatePreset } | null {
  if (t.take(/\b(?:vs\.?|versus|compared (?:to|with)|against) (?:the )?(?:same (?:period|time|days?) )?(?:last|previous|prior) year\b|\byoy\b|\byear[- ]over[- ]year\b|\bvs\.? ly\b/).length) return { mode: "previous_year" };
  if (t.take(/\bwow\b|\bweek[- ]over[- ]week\b/).length) return { mode: "previous_period", defaultRange: "last_7d" };
  if (t.take(/\bmom\b|\bmonth[- ]over[- ]month\b/).length) return { mode: "previous_period", defaultRange: "last_month" };
  if (t.take(/\b(?:vs\.?|versus|compared (?:to|with)|against) (?:the )?(?:previous|prior|preceding|last) (?:period|\d+ days|week|month|quarter)\b|\b(?:vs\.?|versus|compared (?:to|with)) (?:the )?(?:previous|prior|before)\b|\bperiod[- ]over[- ]period\b|\bpop\b/).length)
    return { mode: "previous_period" };
  return null;
}

// ── Metrics, having, ranking ───────────────────────────────────────────────────────────────────────────

interface MetricHit {
  key: string;
  index: number;
  /** "by ROAS", "highest CPA" → ranking metric */
  ranked: boolean;
}

function metricLexicon(metrics: readonly NlMetricInfo[]): [RegExp, string][] {
  const custom = metrics
    .filter((m) => !BUILTIN_METRICS.some((b) => b.key === m.key))
    .map((m): [RegExp, string] => [new RegExp(`\\b(?:${escapeRe(m.label.toLowerCase())}|${escapeRe(m.key.toLowerCase())})\\b`, "g"), m.key]);
  return [...custom, ...METRIC_LEXICON];
}

const HAVING_OPS: [RegExp, QueryHaving["op"]][] = [
  [/^(?:>=|at least|no less than|minimum of)$/, "gte"],
  [/^(?:<=|at most|no more than|maximum of)$/, "lte"],
  [/^(?:>|above|over|greater than|more than|higher than|exceeding|exceeds)$/, "gt"],
  [/^(?:<|below|under|less than|lower than|fewer than)$/, "lt"],
  [/^(?:=|equal to|equals|of|exactly)$/, "eq"],
];
const OP_ALT = ">=|<=|>|<|=|at least|no less than|minimum of|at most|no more than|maximum of|above|over|greater than|more than|higher than|exceeding|exceeds|below|under|less than|lower than|fewer than|equal to|equals|exactly";
const opOf = (word: string): QueryHaving["op"] => HAVING_OPS.find(([re]) => re.test(word.trim()))?.[1] ?? "gt";

function havingValue(raw: string, unit: string | undefined, format: MetricFormat | undefined): number {
  const v = Number(raw.replace(/,/g, ""));
  if (format === "percent" && (unit === "%" || v > 1)) return v / 100;
  return v;
}

function parseHaving(t: Text, lexicon: [RegExp, string][], formats: Map<string, MetricFormat>): QueryHaving[] {
  const out: QueryHaving[] = [];
  if (t.take(/\b(?:with |that have |having |had )?(?:no|zero|0) (?:conversions?|convs?|sales|purchases)\b|\bwithout (?:any )?conversions?\b|\bnot converting\b|\bnon[- ]?converting\b|\bdid(?:n'?t| not) convert\b|\bnever converted\b/).length)
    out.push({ metric: "conversions", op: "eq", value: 0 });
  if (t.take(/\b(?:with |having )?(?:no|zero|0) clicks\b/).length) out.push({ metric: "clicks", op: "eq", value: 0 });
  for (const m of t.take(/\bspent (more|less) than \$?(\d[\d,]*(?:\.\d+)?)/)) out.push({ metric: "cost", op: m[1] === "more" ? "gt" : "lt", value: Number((m[2] ?? "0").replace(/,/g, "")) });
  // Lexicon sources only use non-capturing groups, so the captures below are always (op, value, unit).
  for (const [re, key] of lexicon) {
    const metric = `(?:${re.source})`;
    const after = new RegExp(`\\b(?:with |where |having |and |whose )?(?:an? |the )?${metric} (?:is |was )?(${OP_ALT}) ?\\$?(\\d[\\d,]*(?:\\.\\d+)?) ?(%|x)?`, "g");
    for (const m of t.take(after)) out.push({ metric: key, op: opOf(m[1] ?? "gt"), value: havingValue(m[2] ?? "0", m[3], formats.get(key)) });
    const before = new RegExp(`\\b(${OP_ALT}) \\$?(\\d[\\d,]*(?:\\.\\d+)?) ?(%|x)? ?${metric}`, "g");
    for (const m of t.take(before)) {
      const op = m[1] ?? "gt";
      out.push({ metric: key, op: opOf(op), value: havingValue(m[2] ?? "0", m[3], formats.get(key)) });
    }
  }
  return out;
}

type RankMode = "top" | "bottom" | "desc" | "asc";
interface Ranking {
  mode: RankMode;
  n: number | null;
  word: string;
  index: number;
}

function parseRanking(t: Text): Ranking | null {
  const words: Record<string, RankMode> = { top: "top", best: "top", worst: "bottom", bottom: "bottom", highest: "desc", most: "desc", biggest: "desc", largest: "desc", lowest: "asc", least: "asc", smallest: "asc" };
  const alt = Object.keys(words).join("|");
  const withN = t.take(new RegExp(`\\b(${alt}) (\\d{1,3})\\b`))[0];
  if (withN) return { mode: words[withN[1] ?? "top"] ?? "top", n: Number(withN[2]), word: withN[1] ?? "top", index: withN.index };
  const plain = t.take(new RegExp(`\\b(${alt})\\b`))[0];
  if (plain) return { mode: words[plain[1] ?? "top"] ?? "top", n: null, word: plain[1] ?? "top", index: plain.index };
  return null;
}

function parseMetrics(t: Text, original: string, lexicon: [RegExp, string][]): MetricHit[] {
  const hits: MetricHit[] = [];
  for (const [re, key] of lexicon) {
    for (const m of t.take(re)) {
      const before = original.slice(Math.max(0, m.index - 24), m.index);
      const ranked = /\b(?:by|in terms of|ranked by|sorted by|ordered by)\s+(?:the\s+)?$/.test(before) || /\b(?:highest|lowest|most|least|best|worst|top|bottom|biggest|largest|smallest)\s+(?:\d{1,3}\s+)?(?:\w+\s+)?$/.test(before);
      hits.push({ key, index: m.index, ranked });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

// ── Filters & dimensions ───────────────────────────────────────────────────────────────────────────────

function parseFilters(t: Text, quotes: string[], campaignNames: readonly string[], dims: Set<DimensionKey>): QueryFilter[] {
  const filters: QueryFilter[] = [];
  const types: string[] = [];
  for (const [re, type] of TYPE_FILTERS) if (t.take(re).length && !types.includes(type)) types.push(type);
  if (types.length === 1) filters.push({ dim: "campaign_type", op: "eq", value: types[0] ?? "" });
  else if (types.length > 1) filters.push({ dim: "campaign_type", op: "in", value: types });

  const vs = t.take(/\b(mobile|desktop|tablets?) (?:vs\.?|versus|and|or) (mobile|desktop|tablets?)\b/)[0];
  if (vs) {
    dims.add("device");
    filters.push({ dim: "device", op: "in", value: [DEVICE_WORDS[vs[1] ?? ""] ?? "Mobile", DEVICE_WORDS[vs[2] ?? ""] ?? "Desktop"] });
  } else {
    const dev = t.take(/\b(?:on|via|from) (mobile|phones?|desktops?|computers?|tablets?|(?:connected )?tv|ctv)\b|\b(mobile|desktop|tablet) (?:only|traffic|users|devices?)\b/)[0];
    if (dev) {
      const w = (dev[1] ?? dev[2] ?? "").replace(/s$/, "");
      filters.push({ dim: "device", op: "eq", value: DEVICE_WORDS[w] ?? "Mobile" });
    }
  }
  for (const [re, code] of COUNTRY_WORDS) if (t.take(re).length) filters.push({ dim: "country", op: "eq", value: code });

  const target: Record<string, DimensionKey> = { campaign: "campaign", campaigns: "campaign", keyword: "keyword", keywords: "keyword", "search term": "search_term", "search terms": "search_term", "ad group": "ad_group", "ad groups": "ad_group" };
  const contains = t.take(/\b(campaigns?|keywords?|search terms?|ad groups?)(?: that| whose names?)? (?:contain(?:s|ing)?|with|named|called|matching|like|including) (?:the (?:word|text) )?(?:__q(\d+)__|([a-z0-9][\w-]{1,40}))/)[0];
  if (contains) {
    const dim = target[contains[1] ?? "campaign"] ?? "campaign";
    const value = contains[2] !== undefined ? (quotes[Number(contains[2])] ?? "") : (contains[3] ?? "");
    if (value) {
      filters.push({ dim, op: "contains", value });
      dims.add(dim);
    }
  }
  if (t.take(/\bnon[- ]?brand(?:ed)?\b|\bexcluding brand\b|\bwithout brand\b|\bexcept brand\b/).length) filters.push({ dim: "campaign", op: "ncontains", value: "brand" });

  if (!filters.some((f) => f.dim === "campaign" || f.dim === "campaign_type")) {
    const lower = t.value;
    for (const name of campaignNames) {
      const full = normalize(name);
      const short = normalize(name.split("—").pop() ?? name);
      if (full.length >= 4 && lower.includes(full)) {
        filters.push({ dim: "campaign", op: "eq", value: name });
        t.blank(lower.indexOf(full), full.length);
        break;
      }
      if (short.length >= 6 && short !== full && lower.includes(short)) {
        filters.push({ dim: "campaign", op: "contains", value: short });
        t.blank(lower.indexOf(short), short.length);
        break;
      }
    }
  }
  return filters;
}

function parseDimensions(t: Text): { dims: DimensionKey[]; blended: boolean } {
  const blended = t.take(CROSS_CHANNEL_RE).length > 0;
  const hits: { key: DimensionKey; index: number }[] = [];
  for (const [re, key] of DIMENSION_LEXICON) for (const m of t.take(re)) hits.push({ key, index: m.index });
  const dims = [...new Set(hits.sort((a, b) => a.index - b.index).map((h) => h.key))];
  return { dims, blended };
}

// ── Assembly ───────────────────────────────────────────────────────────────────────────────────────────

const PLURAL: Partial<Record<DimensionKey, string>> = { campaign: "campaigns", keyword: "keywords", search_term: "search terms", ad_group: "ad groups", device: "devices", country: "countries", campaign_type: "campaign types", platform: "platforms" };
const TIME_DIMS = new Set<DimensionKey>(["date", "week", "month", "quarter", "year"]);
const BLENDED_OK = new Set(["cost", "clicks", "impressions", "conversions", "conv_value", "roas", "cpa", "ctr", "cpc", "cvr", "cpm", "aov", "mer"]);

function chartFor(dims: DimensionKey[], metrics: string[], ranked: boolean): ChatChart["type"] {
  const first = dims[0];
  if (!first) return "kpi";
  if (TIME_DIMS.has(first)) return "line";
  if (first === "hour" || first === "dow") return "bar";
  if (first === "search_term" || first === "keyword" || dims.length > 1) return "table";
  if (!ranked && metrics.length >= 3) return "table";
  return "bar";
}

export function parseNlQuery(question: string, ctx: NlLiteContext): NlLiteResult {
  const notes: string[] = [];
  const metricsInfo = ctx.metrics ?? BUILTIN_METRICS.map((m) => ({ key: m.key, label: m.label, direction: m.direction, format: m.format }));
  const info = new Map(metricsInfo.map((m) => [m.key, m]));
  const formats = new Map(metricsInfo.map((m) => [m.key, m.format]));
  const lexicon = metricLexicon(metricsInfo);

  // Quoted strings become placeholders so their words are never read as metrics or dates.
  const quotes: string[] = [];
  const normalized = normalize(question)
    .replace(/"([^"]{1,80})"|(?<![\p{L}\p{N}])'([^']{1,80})'(?![\p{L}\p{N}])/gu, (_m, a: string | undefined, b: string | undefined) => {
      quotes.push((a ?? b ?? "").trim());
      return ` __q${quotes.length - 1}__ `;
    })
    .replace(/\s+/g, " ")
    .trim();
  const t = new Text(normalized);

  const compare = parseCompare(t);
  let range = parseDates(t, ctx.today, notes);
  const having = parseHaving(t, lexicon, formats);
  const ranking = parseRanking(t);
  const metricHits = parseMetrics(t, normalized, lexicon);
  const dimSet = new Set<DimensionKey>();
  const filters = parseFilters(t, quotes, ctx.campaignNames ?? [], dimSet);
  const { dims: lexDims, blended } = parseDimensions(t);
  const why = /\bwhy\b|\bwhat (?:happened|changed|caused|drove)\b|\b(?:go|goes|went|gone|going) (?:up|down)\b|\b(?:increase[ds]?|increasing|decrease[ds]?|decreasing|drop(?:s|ped|ping)?|spike[ds]?|spiking|jump(?:s|ed|ing)?|fell|fall(?:s|ing)?|rose|rise[sn]?|rising)\b/.test(normalized);
  const directionUp = /\b(?:up|increase[ds]?|increasing|spike[ds]?|spiking|jump(?:s|ed|ing)?|rose|rise[sn]?|rising|higher|grew|grow(?:s|ing|n)?)\b/.test(normalized);

  const overview = /\bhow (?:are|is|was|were|did|do)\b.*\b(?:doing|performing|perform|going|do)\b|\bperformance\b|\boverview\b|\bsummary\b|\bsummari[sz]e\b|\bkpis?\b|\bresults\b/.test(normalized);
  const recognized = !!(compare || range || having.length || ranking || metricHits.length || filters.length || lexDims.length || blended || overview);
  if (!recognized || /^(?:hi|hello|hey|thanks?|thank you|help|\?+)[\s!.?]*$/.test(normalized)) {
    return { intent: "clarify", queries: [], notes, examples: NL_EXAMPLES.slice(0, 4) };
  }

  // Dimensions (explicit breakdowns first; filters may add one; ranking/why default to campaign).
  let dims: DimensionKey[] = [...new Set([...lexDims, ...dimSet])];
  if (blended) {
    const dropped = dims.filter((d) => d !== "date" && d !== "platform");
    if (dropped.length) notes.push(`Cross-channel data only breaks down by date and platform (ignored: ${dropped.map((d) => DIMENSIONS[d].label.toLowerCase()).join(", ")}).`);
    dims = [...(dims.includes("date") ? (["date"] as DimensionKey[]) : []), "platform"];
  }
  if (!dims.length && (ranking || why)) dims = ["campaign"];
  dims = dims.slice(0, 3);
  // Device and country live in separate fact tables, and hourly data has neither: keep what was asked first.
  const uses = (d: "device" | "country") => dims.includes(d) || filters.some((f) => f.dim === d);
  const dropDim = (d: DimensionKey, why: string) => {
    dims = dims.filter((x) => x !== d);
    for (let i = filters.length - 1; i >= 0; i--) if (filters[i]?.dim === d) filters.splice(i, 1);
    notes.push(why);
  };
  if (uses("device") && uses("country")) dropDim("country", "Device and country can't be combined in one query; showing the device view.");
  if (dims.includes("hour")) for (const d of ["device", "country"] as const) if (uses(d)) dropDim(d, `Hourly data has no ${d} breakdown; ignored the ${d} part.`);
  if (!range && compare?.defaultRange) range = presetRange(compare.defaultRange);
  if (!range) {
    range = presetRange("last_30d");
    notes.push("No date range given — using the last 30 days.");
  }

  // Metrics: explicit mentions (ranked one first), single-ratio expansion, defaults, having metrics appended.
  const mentioned = [...new Set(metricHits.map((h) => h.key))];
  const rankHit = metricHits.find((h) => h.ranked);
  let rankMetric: string | null = rankHit?.key ?? null;
  if (ranking && !rankMetric) rankMetric = mentioned[0] ?? (ranking.word === "best" || ranking.word === "worst" ? "conversions" : "cost");
  let metrics = mentioned.length ? mentioned : [...DEFAULT_METRICS];
  if (rankMetric) metrics = [rankMetric, ...metrics.filter((m) => m !== rankMetric)];
  if (mentioned.length === 1 && mentioned[0] && COMPONENTS[mentioned[0]]) metrics = [mentioned[0], ...(COMPONENTS[mentioned[0]] ?? [])];
  for (const h of having) if (!metrics.includes(h.metric)) metrics.push(h.metric);
  if (blended) {
    const dropped = metrics.filter((m) => !BLENDED_OK.has(m) && !m.startsWith("cm_"));
    metrics = metrics.filter((m) => !dropped.includes(m));
    if (dropped.length) notes.push(`Cross-channel data has no ${dropped.join(", ")}.`);
    if (!metrics.length) metrics = ["cost", "conv_value", "roas"];
  }
  metrics = [...new Set(metrics)].slice(0, 12);

  // Sorting & limit.
  let sort: QuerySpecInput["sort"];
  let limit: number | undefined;
  const entityDim = dims.find((d) => !TIME_DIMS.has(d) && d !== "hour" && d !== "dow");
  if (ranking && rankMetric && entityDim) {
    const dir = info.get(rankMetric)?.direction ?? "neutral";
    const goodDesc = dir !== "down_good";
    const desc = ranking.mode === "desc" ? true : ranking.mode === "asc" ? false : ranking.mode === "top" ? goodDesc : !goodDesc;
    sort = [{ key: rankMetric, dir: desc ? "desc" : "asc" }];
    const singular = new RegExp(`\\b${ranking.word}\\s+(?:\\d+\\s+)?(?:campaign|keyword|device|country|search term|ad group|platform)\\b(?!s)`).test(normalized) || /\bwhich (?:campaign|keyword|device|country|search term|ad group)\b(?!s)/.test(normalized);
    limit = ranking.n ?? (singular ? 1 : 10);
  } else if (why && entityDim && metrics[0]) {
    sort = [{ key: `${metrics[0]}__delta`, dir: directionUp ? "desc" : "asc" }];
    limit = 10;
  } else if (entityDim === "search_term" || entityDim === "keyword") {
    limit = 50;
  }
  const compareMode = compare?.mode ?? (why || (overview && !dims.length) ? "previous_period" : "none");
  if ((why || (overview && !dims.length)) && !compare) notes.push("Compared with the previous period to show what changed.");

  const spec: QuerySpecInput = {
    source: blended ? "blended" : "google_ads",
    metrics,
    dimensions: dims,
    filters,
    having,
    dateRange: range.spec,
    compare: compareMode,
    ...(sort ? { sort } : {}),
    ...(limit ? { limit } : {}),
    ...(dims.length === 1 && dims[0] === "date" ? { fillGaps: true } : {}),
  };

  const short = (k: string) => BUILTIN_METRICS.find((b) => b.key === k)?.short ?? info.get(k)?.label ?? k;
  const dimLabel = (d: DimensionKey) => PLURAL[d] ?? DIMENSIONS[d].label.toLowerCase();
  let title: string;
  if (ranking && rankMetric && entityDim) {
    const lead = ranking.mode === "bottom" ? "Worst" : ranking.mode === "asc" ? "Lowest" : ranking.mode === "desc" ? "Highest" : "Top";
    title =
      limit === 1
        ? `${DIMENSIONS[entityDim].label} with the ${ranking.mode === "bottom" ? "worst" : ranking.mode === "asc" ? "lowest" : ranking.mode === "desc" ? "highest" : "best"} ${short(rankMetric)}`
        : `${lead} ${limit ?? ""} ${dimLabel(entityDim)} by ${short(rankMetric)}`.replace(/\s+/g, " ");
  } else if (dims.length) {
    title = `${metrics.slice(0, 3).map(short).join(", ")} by ${dims.map((d) => DIMENSIONS[d].label.toLowerCase()).join(" & ")}`;
  } else {
    title = metrics.slice(0, 4).map(short).join(" · ");
  }
  title = `${title.charAt(0).toUpperCase()}${title.slice(1)} · ${range.label}${compareMode === "previous_year" ? " vs last year" : compareMode === "previous_period" ? " vs previous period" : ""}`;

  return { intent: "query", queries: [{ title, chart: chartFor(dims, metrics, !!ranking), spec }], notes, examples: [] };
}
