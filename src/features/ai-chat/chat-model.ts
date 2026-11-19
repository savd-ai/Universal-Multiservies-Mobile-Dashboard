import { appendItem } from "@/features/dashboards/layout-engine";
import type { ChatMessage } from "@/lib/api/sse";
import type { ChatChart } from "@/lib/domain/contracts/ai";
import type { Dashboard, DashboardBody, VizSettings, WidgetInstance, WidgetQueryInput } from "@/lib/domain/contracts/dashboard";
import type { QueryResult, QuerySpecInput } from "@/lib/domain/query/spec";

// Pure helpers for the Ask-your-data drawer: provider labels, stream phase copy, chart → Question widget mapping
// (Explore deep links and "Add to dashboard").

export const DEFAULT_PROMPTS = ["Why did CPA rise last week?", "Top 5 campaigns by ROAS last 7 days", "Spend by device this month vs last month", "Search terms with no conversions last 30 days"];

export const TIME_DIMS: ReadonlySet<string> = new Set(["date", "week", "month", "quarter", "year"]);

const PROVIDER_NAMES: Record<string, string> = { anthropic: "Claude", openai: "OpenAI", gemini: "Gemini", demo: "Demo engine" };

/** Chip text: "Demo engine" for the deterministic engine, otherwise the model (or provider) name. */
export function providerLabel(meta: { provider: string; model: string | null; mode?: "ai" | "demo" } | null | undefined): string {
  if (!meta) return "AI";
  if (meta.mode === "demo" || meta.provider === "demo") return "Demo engine";
  return meta.model || PROVIDER_NAMES[meta.provider] || meta.provider;
}

/** Status line while an answer streams (null once text is flowing or the answer ended). */
export function streamPhase(m: ChatMessage): string | null {
  if (m.role !== "assistant" || (m.status !== "pending" && m.status !== "streaming")) return null;
  if (m.content) return null;
  if (!m.plan) return "Reading the question…";
  const n = m.plan.queries.length;
  if (m.plan.intent === "query" && m.results.length < n) return `Running ${n === 1 ? "1 query" : `${n} queries`}…`;
  return "Writing the answer…";
}

export function specOf(chart: ChatChart): QuerySpecInput {
  return (chart.query ?? { metrics: [] }) as QuerySpecInput;
}

/** Question visualization for a chat chart type (bars are horizontal unless the dimension is time). */
export function vizForChart(chart: ChatChart): VizSettings {
  const spec = specOf(chart);
  const time = (spec.dimensions ?? []).some((d) => TIME_DIMS.has(d));
  switch (chart.type) {
    case "kpi":
      return { type: (spec.metrics?.length ?? 0) <= 1 ? "number" : "kpi-strip" };
    case "line":
      return { type: "line" };
    case "area":
      return { type: "area" };
    case "bar":
      return { type: "bar", horizontal: !time };
    case "donut":
      return { type: "donut" };
    default:
      return { type: "table" };
  }
}

const WIDGET_SIZE: Record<string, { w: number; h: number }> = {
  "kpi-strip": { w: 12, h: 10 },
  number: { w: 3, h: 9 },
  line: { w: 6, h: 15 },
  area: { w: 6, h: 15 },
  bar: { w: 6, h: 16 },
  donut: { w: 4, h: 16 },
  table: { w: 8, h: 18 },
};

/** Widget query: absolute date ranges are dropped (the widget follows the dashboard range); presets stay pinned. */
export function widgetQueryFrom(spec: QuerySpecInput): WidgetQueryInput {
  const { dateRange, accountId: _account, ...rest } = spec;
  const pinned = dateRange && "preset" in dateRange ? { dateRange } : {};
  return { ...rest, ...pinned } as WidgetQueryInput;
}

const RANGE_WORDS = /\b(last|this|previous|month|quarter|year|week|today|yesterday|days?|mtd|qtd|ytd)\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d/i;
const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/**
 * "Top 5 campaigns by ROAS · Last 7 days" → title + subtitle. When the range is dropped (absolute dates) the
 * subtitle keeps only the comparison ("vs previous period") so the widget never shows stale dates.
 */
export function splitChartTitle(full: string, rangeKept: boolean): { title: string; subtitle: string } {
  const i = full.lastIndexOf(" · ");
  const tail = i >= 0 ? full.slice(i + 3) : "";
  if (i < 0 || !RANGE_WORDS.test(tail)) return { title: clip(full, 120), subtitle: "From Ask AI" };
  const head = full.slice(0, i);
  if (rangeKept) return { title: clip(head, 120), subtitle: clip(tail, 160) };
  const vs = /\bvs\.?\s.+$/i.exec(tail)?.[0];
  return { title: clip(head, 120), subtitle: vs ? clip(vs, 160) : "Follows the dashboard range" };
}

export function questionWidgetFor(chart: ChatChart, id: string): { widget: WidgetInstance; size: { w: number; h: number } } {
  const viz = vizForChart(chart);
  const query = widgetQueryFrom(specOf(chart));
  const { title, subtitle } = splitChartTitle(chart.title, !!query.dateRange);
  return {
    widget: { id, type: "question", title, subtitle, config: { preset: "ai-chat", query, viz } },
    size: WIDGET_SIZE[viz.type] ?? { w: 6, h: 16 },
  };
}

export const MAX_WIDGETS = 60;

/** Append a widget at the end of the reading order (re-flowed like the gallery's "Add widget"). */
export function appendWidget(body: DashboardBody, widget: WidgetInstance, size: { w: number; h: number }): DashboardBody {
  return { ...body, widgets: [...body.widgets, widget], layout: appendItem(body.layout, { i: widget.id, x: 0, y: 0, w: size.w, h: size.h }) };
}

export function dashboardHref(d: Pick<Dashboard, "id" | "isDefault">): string {
  return d.isDefault ? "/overview" : `/overview/${encodeURIComponent(d.id)}`;
}

/** "Sep 22 – Sep 28" (+ comparison range) for a result's meta line. */
export function resultRangeLabel(result: QueryResult, fmt: (d: string) => string): string {
  const r = result.meta?.range;
  if (!r) return "";
  const main = r.start === r.end ? fmt(r.start) : `${fmt(r.start)} – ${fmt(r.end)}`;
  const c = result.meta.compareRange;
  return c ? `${main} vs ${fmt(c.start)} – ${fmt(c.end)}` : main;
}
