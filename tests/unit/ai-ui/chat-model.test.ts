import { describe, expect, it } from "vitest";
import { appendWidget, dashboardHref, providerLabel, questionWidgetFor, resultRangeLabel, splitChartTitle, streamPhase, vizForChart, widgetQueryFrom } from "@/features/ai-chat/chat-model";
import { bodyOf } from "@/features/dashboards/use-dashboard-draft";
import { buildHistory, chatContextFrom, chatReducer, INITIAL_CHAT, parseSseText, toChatEvent, type ChatMessage, type ChatState } from "@/lib/api/sse";
import type { ChatChart, ChatEvent } from "@/lib/domain/contracts/ai";
import { dashboardBodySchema, vizSettingsSchema, widgetQuerySchema, type Dashboard, type DashboardBody } from "@/lib/domain/contracts/dashboard";
import type { QueryResult } from "@/lib/domain/query/spec";
import fx from "./fixtures/api.json";

// Chat state reducer, request history/context builders and the chart → widget helpers of the Ask-AI drawer.

const user = (id: string, content: string): ChatMessage => ({ id, role: "user", content, status: "done", results: [], notices: [] });
const assistant = (id: string, over: Partial<ChatMessage> = {}): ChatMessage => ({ id, role: "assistant", content: "", status: "pending", results: [], notices: [], ...over });

const RESULT: QueryResult = {
  columns: [
    { key: "campaign", label: "Campaign", kind: "dimension" },
    { key: "roas", label: "ROAS", kind: "metric", format: "ratio" },
  ],
  rows: [{ campaign: "Brand — Core Terms", campaign_id: "c1", roas: 22.9 }],
  meta: { range: { start: "2026-09-22", end: "2026-09-28", days: 7 }, table: "campaign_daily", grain: "daily", currency: "USD", timezone: "UTC", sources: [], truncated: false, rowCount: 1, warnings: [], tookMs: 1 },
};

const chart = (over: Partial<ChatChart> & { query?: unknown } = {}): ChatChart => ({
  id: "q1",
  title: "Top 5 campaigns by ROAS · Last 7 days",
  type: "bar",
  query: { source: "google_ads", metrics: ["roas", "cost"], dimensions: ["campaign"], dateRange: { preset: "last_7d" }, compare: "none", limit: 5 },
  ...over,
});

function run(events: ChatEvent[], start: ChatState = { messages: [user("u1", "hi"), assistant("a1")], meta: null }): ChatState {
  return events.reduce((s, event) => chatReducer(s, { type: "event", id: "a1", event }), start);
}

describe("chatReducer", () => {
  it("appends a user turn and a pending answer; keep truncates for retries", () => {
    const s1 = chatReducer(INITIAL_CHAT, { type: "send", user: user("u1", "a"), assistant: assistant("a1") });
    expect(s1.messages.map((m) => m.id)).toEqual(["u1", "a1"]);
    const s2 = chatReducer(s1, { type: "send", user: user("u2", "a"), assistant: assistant("a2"), keep: 0 });
    expect(s2.messages.map((m) => m.id)).toEqual(["u2", "a2"]);
  });

  it("applies meta, plan, results (ordered by index), deltas, notices, suggestions and done", () => {
    const meta = { provider: "demo" as const, model: null, mode: "demo" as const, dataMode: "demo" as const };
    const s = run([
      { event: "meta", data: meta },
      { event: "plan", data: { intent: "query", queries: [], planner: "nl-lite", notes: ["Skipped 1 invalid query."] } },
      { event: "result", data: { index: 1, chart: chart({ id: "q2" }), result: RESULT } },
      { event: "result", data: { index: 0, chart: chart(), result: RESULT } },
      { event: "delta", data: { text: "**Top 5**" } },
      { event: "delta", data: { text: " campaigns" } },
      { event: "notice", data: { message: "Using the rule-based parser." } },
      { event: "suggestions", data: { prompts: ["Show the daily trend"] } },
      { event: "done", data: { model: null } },
    ]);
    const a = s.messages[1] as ChatMessage;
    expect(s.meta).toEqual(meta);
    expect(a.meta).toEqual(meta);
    expect(a.results.map((r) => r.chart.id)).toEqual(["q1", "q2"]);
    expect(a.content).toBe("**Top 5** campaigns");
    expect(a.notices).toEqual(["Skipped 1 invalid query.", "Using the rule-based parser."]);
    expect(a.suggestions).toEqual(["Show the daily trend"]);
    expect(a.status).toBe("done");
  });

  it("stop keeps the partial answer and ignores late events", () => {
    let s = run([{ event: "delta", data: { text: "Partial" } }]);
    expect(s.messages[1]?.status).toBe("streaming");
    s = chatReducer(s, { type: "stop", id: "a1" });
    s = run([{ event: "delta", data: { text: " late" } }, { event: "done", data: { model: null } }], s);
    expect(s.messages[1]).toMatchObject({ status: "stopped", content: "Partial" });
  });

  it("error events and failures mark the answer; a finished answer is never downgraded", () => {
    expect(run([{ event: "error", data: { code: "AI_DOWN", message: "Provider down" } }]).messages[1]).toMatchObject({ status: "error", error: { code: "AI_DOWN" } });
    const done = run([{ event: "delta", data: { text: "ok" } }, { event: "done", data: { model: "m" } }]);
    expect(chatReducer(done, { type: "fail", id: "a1", error: { code: "NETWORK", message: "x" } }).messages[1]?.status).toBe("done");
  });

  it("a stream that ends without done is done when it produced output, an error when it produced nothing", () => {
    expect(chatReducer(run([{ event: "delta", data: { text: "x" } }]), { type: "end", id: "a1" }).messages[1]?.status).toBe("done");
    expect(chatReducer(run([]), { type: "end", id: "a1" }).messages[1]).toMatchObject({ status: "error", error: { code: "STREAM_ENDED" } });
  });

  it("reset clears the conversation", () => {
    expect(chatReducer(run([]), { type: "reset" })).toBe(INITIAL_CHAT);
  });
});

describe("toChatEvent", () => {
  it("accepts contract events and drops malformed or unknown ones", () => {
    expect(toChatEvent({ event: "delta", data: { text: "a" } })).toEqual({ event: "delta", data: { text: "a" } });
    expect(toChatEvent({ event: "delta", data: { text: 1 } })).toBeNull();
    expect(toChatEvent({ event: "delta", data: "raw" })).toBeNull();
    expect(toChatEvent({ event: "result", data: { index: 0, chart: {}, result: {} } })).toBeNull();
    expect(toChatEvent({ event: "result", data: { index: 0, chart: chart(), result: RESULT } })?.event).toBe("result");
    expect(toChatEvent({ event: "ping", data: {} })).toBeNull();
    expect(toChatEvent({ event: "error", data: {} })).toEqual({ event: "error", data: { code: "ERROR", message: "The answer failed." } });
    expect(toChatEvent({ event: "suggestions", data: { prompts: ["a", 2, "b"] } })).toEqual({ event: "suggestions", data: { prompts: ["a", "b"] } });
  });
});

describe("buildHistory", () => {
  it("keeps user turns and finished/stopped answers with text, last 12, clipped to 8,000 chars", () => {
    const msgs: ChatMessage[] = [user("u1", "q1"), assistant("a1", { status: "done", content: "answer 1" }), user("u2", "q2"), assistant("a2", { status: "error", content: "" }), user("u3", "q3"), assistant("a3", { status: "stopped", content: "partial" })];
    expect(buildHistory(msgs)).toEqual([
      { role: "user", content: "q1" },
      { role: "assistant", content: "answer 1" },
      { role: "user", content: "q2" },
      { role: "user", content: "q3" },
      { role: "assistant", content: "partial" },
    ]);
    const many = Array.from({ length: 20 }, (_, i) => user(`u${i}`, `q${i}`));
    expect(buildHistory(many)).toHaveLength(12);
    expect(buildHistory([user("u", "x".repeat(9000))])[0]?.content).toHaveLength(8000);
  });
});

describe("chatContextFrom", () => {
  const params = (q: string) => new URLSearchParams(q);

  it("carries page, dashboard, campaign and the URL slicers", () => {
    expect(chatContextFrom({ pathname: "/overview/perf-1", search: params("range=7d&cmp=yoy&types=Search,PMax&campaign=c3"), defaultDashboardId: "d0" })).toEqual({
      page: "/overview/perf-1",
      dashboardId: "perf-1",
      campaignId: "c3",
      range: "7d",
      compare: "yoy",
      types: ["Search", "PMax"],
    });
  });

  it("sends only valid enums: compare off/unknown and unknown campaign types are omitted", () => {
    expect(chatContextFrom({ pathname: "/campaigns", search: params("cmp=off&types=Search,Bogus,Search,Demand%20Gen") })).toEqual({ page: "/campaigns", range: "30d", types: ["Search", "Demand Gen"] });
    expect(chatContextFrom({ pathname: "/campaigns", search: params("cmp=weird&types=Nope") })).toEqual({ page: "/campaigns", range: "30d" });
  });

  it("uses the default dashboard on /overview, the campaign page id and defaults for missing slicers", () => {
    expect(chatContextFrom({ pathname: "/overview", search: params(""), defaultDashboardId: "d0" })).toEqual({ page: "/overview", dashboardId: "d0", range: "30d", compare: "prev" });
    expect(chatContextFrom({ pathname: "/campaigns/c8", search: null })).toEqual({ page: "/campaigns/c8", campaignId: "c8", range: "30d", compare: "prev" });
  });

  it("encodes custom ranges and drops values over the schema limits", () => {
    expect(chatContextFrom({ pathname: "/explore", search: params("range=custom&from=2026-09-01&to=2026-09-28") }).range).toBe("2026-09-01..2026-09-28");
    expect(chatContextFrom({ pathname: "/explore", search: params(`campaign=${"x".repeat(80)}`) }).campaignId).toBeUndefined();
  });
});

describe("chart helpers", () => {
  it("labels the provider chip", () => {
    expect(providerLabel({ provider: "demo", model: null, mode: "demo" })).toBe("Demo engine");
    expect(providerLabel({ provider: "anthropic", model: "claude-sonnet-4-5", mode: "ai" })).toBe("claude-sonnet-4-5");
    expect(providerLabel({ provider: "openai", model: null })).toBe("OpenAI");
    expect(providerLabel(null)).toBe("AI");
  });

  it("describes the stream phase until text arrives", () => {
    expect(streamPhase(assistant("a"))).toBe("Reading the question…");
    const planned = assistant("a", { plan: { intent: "query", queries: [{ id: "q1", title: "t", chart: "bar", query: {} }, { id: "q2", title: "t", chart: "bar", query: {} }], planner: "ai" } });
    expect(streamPhase(planned)).toBe("Running 2 queries…");
    expect(streamPhase({ ...planned, results: [{ index: 0, chart: chart(), result: RESULT }, { index: 1, chart: chart(), result: RESULT }] })).toBe("Writing the answer…");
    expect(streamPhase({ ...planned, content: "text", status: "streaming" })).toBeNull();
    expect(streamPhase({ ...planned, status: "done" })).toBeNull();
  });

  it("maps chart types to Question visualizations", () => {
    expect(vizForChart(chart())).toEqual({ type: "bar", horizontal: true });
    expect(vizForChart(chart({ query: { metrics: ["cost"], dimensions: ["date"] } }))).toEqual({ type: "bar", horizontal: false });
    expect(vizForChart(chart({ type: "kpi", query: { metrics: ["cost", "cpa"] } }))).toEqual({ type: "kpi-strip" });
    expect(vizForChart(chart({ type: "kpi", query: { metrics: ["cost"] } }))).toEqual({ type: "number" });
    expect(vizForChart(chart({ type: "line" }))).toEqual({ type: "line" });
    expect(vizForChart(chart({ type: "table" }))).toEqual({ type: "table" });
  });

  it("drops absolute date ranges (and the account) from widget queries but keeps presets", () => {
    expect(widgetQueryFrom({ metrics: ["cost"], dateRange: { start: "2026-09-21", end: "2026-09-27" }, accountId: "123", compare: "previous_period" })).toEqual({ metrics: ["cost"], compare: "previous_period" });
    expect(widgetQueryFrom({ metrics: ["cost"], dateRange: { preset: "last_7d" } })).toEqual({ metrics: ["cost"], dateRange: { preset: "last_7d" } });
  });

  it("splits a chart title into widget title and subtitle", () => {
    expect(splitChartTitle("Top 5 campaigns by ROAS · Last 7 days", true)).toEqual({ title: "Top 5 campaigns by ROAS", subtitle: "Last 7 days" });
    expect(splitChartTitle("Spend · Conv. · CPA · Last 7 days vs previous period", true)).toEqual({ title: "Spend · Conv. · CPA", subtitle: "Last 7 days vs previous period" });
    expect(splitChartTitle("CPA, Spend by campaign · Sep 21 – Sep 27, 2026 vs previous period", false)).toEqual({ title: "CPA, Spend by campaign", subtitle: "vs previous period" });
    expect(splitChartTitle("Spend by device · Sep 1 – Sep 28, 2026", false)).toEqual({ title: "Spend by device", subtitle: "Follows the dashboard range" });
    expect(splitChartTitle("Top campaigns · ROAS", true)).toEqual({ title: "Top campaigns · ROAS", subtitle: "From Ask AI" });
  });

  it("builds a Question widget and appends it to the end of the layout", () => {
    const { widget, size } = questionWidgetFor(chart(), "ai-1");
    expect(widget).toEqual({
      id: "ai-1",
      type: "question",
      title: "Top 5 campaigns by ROAS",
      subtitle: "Last 7 days",
      config: { preset: "ai-chat", query: { source: "google_ads", metrics: ["roas", "cost"], dimensions: ["campaign"], dateRange: { preset: "last_7d" }, compare: "none", limit: 5 }, viz: { type: "bar", horizontal: true } },
    });
    expect(size).toEqual({ w: 6, h: 16 });
    const body: DashboardBody = { name: "D", isDefault: false, defaults: {}, widgets: [{ id: "a", type: "pacing", config: {} }], layout: [{ i: "a", x: 0, y: 0, w: 8, h: 10 }] };
    const next = appendWidget(body, widget, size);
    expect(next.widgets.map((w) => w.id)).toEqual(["a", "ai-1"]);
    expect(next.layout.find((l) => l.i === "ai-1")).toEqual({ i: "ai-1", x: 0, y: 10, w: 6, h: 16 });
  });

  it("produces a dashboard document the API accepts, for every captured chat chart", () => {
    const dash = (fx.dashboards as { dashboards: Dashboard[] }).dashboards[0] as Dashboard;
    const streams = [fx.chatSse, fx.chatSseKpi, fx.chatSseTrend, fx.chatSseDevice, fx.chatSseTable];
    for (const text of streams) {
      const result = parseSseText(text).find((m) => m.event === "result");
      const { chart: c } = JSON.parse(result?.data ?? "{}") as { chart: ChatChart };
      const { widget, size } = questionWidgetFor(c, "ai-test");
      const doc = appendWidget(bodyOf(dash), widget, size);
      expect(() => dashboardBodySchema.parse(doc)).not.toThrow();
      const cfg = widget.config as { query: unknown; viz: unknown };
      expect(widgetQuerySchema.safeParse(cfg.query).success).toBe(true);
      expect(vizSettingsSchema.safeParse(cfg.viz).success).toBe(true);
      expect((cfg.query as { dateRange?: { start?: string } }).dateRange?.start).toBeUndefined();
    }
  });

  it("links dashboards and formats result ranges", () => {
    expect(dashboardHref({ id: "x y", isDefault: false })).toBe("/overview/x%20y");
    expect(dashboardHref({ id: "d0", isDefault: true })).toBe("/overview");
    expect(resultRangeLabel(RESULT, (d) => d.slice(5))).toBe("09-22 – 09-28");
    expect(resultRangeLabel({ ...RESULT, meta: { ...RESULT.meta, compareRange: { start: "2026-09-15", end: "2026-09-21" } } }, (d) => d.slice(5))).toBe("09-22 – 09-28 vs 09-15 – 09-21");
  });
});
