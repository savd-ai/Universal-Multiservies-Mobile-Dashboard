// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { Tooltip } from "radix-ui";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useToasts } from "@/components/ui/toast";
import { adsTextLength } from "@/lib/domain/ai/ads-text";
import { ChatDrawer } from "@/features/ai-chat/chat-drawer";
import { AdCopyScreen } from "@/features/ai-studio/ad-copy-screen";
import { BlueprintScreen } from "@/features/ai-studio/blueprint-screen";
import { IdeasScreen } from "@/features/ai-studio/ideas-screen";
import { NegativesScreen } from "@/features/ai-studio/negatives-screen";
import { useStudio } from "@/features/ai-studio/studio-store";
import type { IdeaSet } from "@/lib/domain/contracts/ai";
import type { Dashboard } from "@/lib/domain/contracts/dashboard";
import { useUi } from "@/stores/ui";
import fx from "./fixtures/api.json";

// Render smoke tests of the AI studio screens and the Ask-AI drawer against captured demo API payloads (and the
// real SSE stream text): each screen renders its data, and the main flows send the right requests.

const nav = vi.hoisted(() => ({ pathname: "/ai", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("range=30d"),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={String(href)} className={rest.className as string | undefined}>
      {children}
    </a>
  ),
}));

const sets = (fx.ideaSets as { ideaSets: IdeaSet[] }).ideaSets;
const latest = sets[0] as IdeaSet;
const dashboards = (fx.dashboards as { dashboards: Dashboard[] }).dashboards;
const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
let hangChat = false;
let displayCurrency: string | null = null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function sse(text: string, hold = false, signal?: AbortSignal | null) {
  const bytes = new TextEncoder().encode(text);
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += 37) c.enqueue(bytes.slice(i, i + 37));
      if (!hold) c.close();
      signal?.addEventListener("abort", () => c.error(new DOMException("aborted", "AbortError")));
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream" } });
}

function chatFixture(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("device")) return fx.chatSseDevice;
  if (m.includes("trend")) return fx.chatSseTrend;
  if (m.includes("cpa rise")) return fx.chatSseTable;
  if (m.includes("spend, conversions")) return fx.chatSseKpi;
  return fx.chatSse;
}

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  Element.prototype.scrollIntoView ??= vi.fn();
  URL.createObjectURL = vi.fn(() => "blob:csv");
  URL.revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = vi.fn();
});

beforeEach(() => {
  calls.length = 0;
  hangChat = false;
  displayCurrency = null;
  nav.pathname = "/ai";
  nav.push.mockReset();
  useToasts.setState({ items: [] });
  useStudio.setState({ blueprints: {}, adCopy: null });
  useUi.setState({ chatOpen: false, chatSeed: null });
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(async () => undefined) }, configurable: true });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost");
      const method = init?.method ?? "GET";
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
      calls.push({ method, path: url.pathname, body });
      const p = url.pathname;
      if (p === "/api/status") return json(displayCurrency ? { ...fx.status, display: { currency: displayCurrency, fxRates: { VND: 25_400 } } } : fx.status);
      if (p === "/api/settings") return json(fx.settings);
      if (p === "/api/ai/status") return json(fx.aiStatus);
      if (p === "/api/meta/catalog") return json(fx.catalog);
      if (p === "/api/dashboards") return json(fx.dashboards);
      if (p === "/api/ai/idea-sets") return json(fx.ideaSets);
      if (p === "/api/ai/narrative") return json(fx.narrative);
      if (p === "/api/ai/negatives") return json(fx.negatives);
      if (p === "/api/ai/blueprint") return json(fx.blueprint);
      if (p === "/api/ai/ad-copy") return json(fx.adCopy);
      if (p === "/api/ai/ideas") return json({ ...latest, id: "new-set", goal: body?.goal, createdAt: "2026-09-29T13:00:00.000Z" });
      if (p === "/api/query/batch") return json({ results: ((body?.specs as unknown[]) ?? []).map(() => (fx.campaignsBatch as { results: unknown[] }).results[0]) });
      if (p === "/api/ai/chat") {
        const text = chatFixture(String(body?.message ?? ""));
        return sse(hangChat ? (text.split("event: suggestions")[0] ?? text) : text, hangChat, init?.signal);
      }
      if (p === "/api/actions/simulate") return json({ action: { id: "a1", summary: "Added negatives", type: "keywords.add_negatives", targets: [] }, simulated: true, message: "ok" });
      const one = /^\/api\/ai\/idea-sets\/([^/]+)$/.exec(p);
      if (one) {
        const s = sets.find((x) => x.id === decodeURIComponent(one[1] ?? ""));
        if (!s) return json({ error: { code: "NOT_FOUND", message: "Idea set not found" } }, 404);
        return json(method === "PATCH" ? { ...s, ideas: s.ideas.map((i) => (i.id === body?.ideaId ? { ...i, ...body } : i)) } : s);
      }
      const dash = /^\/api\/dashboards\/([^/]+)$/.exec(p);
      if (dash && method === "PUT") {
        const d = dashboards.find((x) => x.id === dash[1]) as Dashboard;
        return json({ ...d, ...(body?.doc as object), version: d.version + 1 });
      }
      return json({ error: { code: "NOT_FOUND", message: `No fixture for ${p}` } }, 404);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function wrap(ui: React.ReactNode, search = "") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NuqsTestingAdapter searchParams={search} hasMemory>
        <Tooltip.Provider>{ui}</Tooltip.Provider>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

const toastMessages = () => useToasts.getState().items.map((t) => t.message);

describe("IdeasScreen", () => {
  it("renders the prototype panel, insight, six idea cards and the history", async () => {
    wrap(<IdeasScreen />);
    expect(await screen.findByText(latest.ideas[0]?.title as string)).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(latest.ideas.filter((i) => !i.dismissed).length);
    expect(screen.getByRole("radiogroup", { name: "Goal" })).toBeTruthy();
    expect(screen.getByText(`Demo suggestions · goal: ${latest.goal}`)).toBeTruthy();
    expect(await screen.findByText((fx.narrative as { headline: string }).headline)).toBeTruthy();
    expect(screen.getAllByText("Build blueprint →")[0]?.getAttribute("href")).toBe(`/ai/blueprint?set=${latest.id}&idea=${latest.ideas[0]?.id}`);
    expect(screen.getByText("Idea history")).toBeTruthy();
    // cited campaigns resolve to short names from the campaign query
    await waitFor(() => expect(screen.getAllByText(/Competitor Terms ↗|Running Shoes ↗|Best Sellers ↗/).length).toBeGreaterThan(0));
  });

  it("adds an idea to the plan and dismisses with undo", async () => {
    wrap(<IdeasScreen />);
    const card = await screen.findByRole("article", { name: latest.ideas[0]?.title });
    fireEvent.click(within(card).getByRole("button", { name: /Add to plan|plan ✓/ }));
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ ideaId: latest.ideas[0]?.id, inPlan: !latest.ideas[0]?.inPlan }));
    fireEvent.click(within(card).getByRole("button", { name: `Dismiss “${latest.ideas[0]?.title}”` }));
    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH").at(-1)?.body).toEqual({ ideaId: latest.ideas[0]?.id, dismissed: true }));
    expect(toastMessages().some((m) => m.startsWith("Dismissed"))).toBe(true);
  });

  it("generates with the selected goal, budget and context", async () => {
    wrap(<IdeasScreen />);
    await screen.findByText(latest.ideas[0]?.title as string);
    fireEvent.click(screen.getByRole("radio", { name: "Q4 season" }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "4500" } });
    fireEvent.change(screen.getByPlaceholderText("New trail collection launches Oct 15"), { target: { value: "Trail launch Oct 15" } });
    fireEvent.click(screen.getByRole("button", { name: /Generate ideas/ }));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/ai/ideas")?.body).toEqual({ goal: "Q4 season", testBudget: 4500, context: "Trail launch Oct 15" }));
    await waitFor(() => expect(toastMessages()).toContain("AI unavailable — showing demo ideas"));
  });
});

describe("BlueprintScreen", () => {
  it("offers the latest ideas when no idea is chosen", async () => {
    wrap(<BlueprintScreen />);
    expect(await screen.findByText("Choose an idea")).toBeTruthy();
    expect(screen.getByText(latest.ideas[0]?.title as string)).toBeTruthy();
    expect(screen.getByText("+ Start from a blank idea")).toBeTruthy();
  });

  it("walks idea → structure → ads → review and exports the Editor CSV (all Paused)", async () => {
    const idea = latest.ideas[0] as IdeaSet["ideas"][number];
    wrap(<BlueprintScreen />, `?set=${latest.id}&idea=${idea.id}`);
    expect(await screen.findByDisplayValue(idea.title)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Generate blueprint/ }));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/ai/blueprint")?.body).toEqual({ ideaSetId: latest.id, ideaId: idea.id, format: "json" }));

    const bp = (fx.blueprint as { blueprint: { campaignName: string; adGroups: { name: string; rsa: { headlines: string[] } }[] } }).blueprint;
    expect(await screen.findByDisplayValue(bp.campaignName)).toBeTruthy();
    expect(screen.getByDisplayValue(bp.adGroups[0]?.name as string)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next: Ads →" }));
    const h2 = bp.adGroups[0]?.rsa.headlines[1] as string;
    expect(await screen.findByDisplayValue(h2)).toBeTruthy();
    expect(screen.getAllByText(`${adsTextLength(h2)}/30`).length).toBeGreaterThan(0);
    // live counter + validation after an edit
    fireEvent.change(screen.getByRole("textbox", { name: "Headline 3" }), { target: { value: "This headline is far too long for Google" } });
    expect(await screen.findByText(/Too long \(40\/30\)/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next: Review →" }));
    expect(await screen.findByText("Launch checklist")).toBeTruthy();
    expect(screen.getByText(/issue.* to fix before importing/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Download Google Ads Editor CSV" }));
    const blob = (URL.createObjectURL as unknown as { mock: { calls: [Blob][] } }).mock.calls.at(-1)?.[0] as Blob;
    // jsdom's Blob has no .text(); FileReader reads it
    const csv = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsText(blob);
    });
    expect(csv.split("\r\n")[0]).toContain("Campaign,Campaign Type,Campaign Status");
    expect(csv).toContain("This headline is far too long for Google");
    expect(csv).not.toMatch(/,Enabled,/);
    expect(csv).toContain(",Paused,");
  });
});

describe("AdCopyScreen", () => {
  it("generates, checks lines, keeps locked lines on regenerate and copies all", async () => {
    wrap(<AdCopyScreen />);
    const generate = screen.getByRole("button", { name: /Generate ad copy/ }) as HTMLButtonElement;
    expect(generate.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("Waterproof trail running shoes"), { target: { value: "Trail running shoes" } });
    fireEvent.change(screen.getByPlaceholderText("trail running shoes, waterproof trail shoes"), { target: { value: "trail running shoes" } });
    fireEvent.click(screen.getByRole("radio", { name: "Urgent" }));
    fireEvent.click(screen.getByRole("button", { name: /Generate ad copy/ }));
    await waitFor(() => expect(calls.find((c) => c.path === "/api/ai/ad-copy")?.body).toMatchObject({ product: "Trail running shoes", keywords: ["trail running shoes"], tone: "urgent" }));

    const first = (fx.adCopy as { headlines: { text: string }[] }).headlines[0]?.text as string;
    expect(await screen.findByDisplayValue(first)).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Headline 1" }), { target: { value: "My locked headline" } });
    fireEvent.click(screen.getByRole("button", { name: "Lock headline 1" }));
    fireEvent.click(screen.getByRole("button", { name: /Regenerate unlocked/ }));
    await waitFor(() => expect(calls.filter((c) => c.path === "/api/ai/ad-copy")).toHaveLength(2));
    await waitFor(() => expect(toastMessages()).toContain("Unlocked lines regenerated"));
    expect(screen.getByDisplayValue("My locked headline")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Copy all" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    expect(String((navigator.clipboard.writeText as unknown as { mock: { calls: [string][] } }).mock.calls[0]?.[0])).toMatch(/^Headlines\n1\. My locked headline/);
  });
});

describe("NegativesScreen", () => {
  it("lists candidates, filters by verdict and adds the selection through the write guard", async () => {
    nav.pathname = "/ai/negatives";
    wrap(<NegativesScreen />);
    const n = (fx.negatives as { candidates: unknown[] }).candidates.length;
    expect(await screen.findByRole("table", { name: "Negative keyword candidates" })).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(n + 1);
    expect(screen.getByText("Brand protected")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: /^Review ·/ }));
    await waitFor(() => expect(screen.getAllByRole("row").length).toBeLessThan(n + 1));
    fireEvent.click(screen.getByRole("radio", { name: /^All ·/ }));

    fireEvent.click(screen.getByRole("button", { name: /Select AI negatives/ }));
    const add = await screen.findByRole("button", { name: /^Add \d+ negatives?$/ });
    fireEvent.click(add);
    await waitFor(() => expect(calls.find((c) => c.path === "/api/actions/simulate")).toBeTruthy());
    const body = calls.find((c) => c.path === "/api/actions/simulate")?.body as { type: string; negatives: { text: string; matchType: string; campaignId: string }[] };
    expect(body.type).toBe("keywords.add_negatives");
    expect(body.negatives.length).toBeGreaterThan(0);
    expect(body.negatives.every((x) => x.campaignId && ["Exact", "Phrase", "Broad"].includes(x.matchType) && !/\bacme\b/.test(x.text))).toBe(true);
    await waitFor(() => expect(toastMessages().some((m) => /^Added \d+ negative keywords? to \d+ campaigns? · simulated$/.test(m))).toBe(true));
  });
});

describe("ChatDrawer", () => {
  it("opens with suggested prompts, streams an answer with an inline result and actions", async () => {
    nav.pathname = "/overview";
    wrap(<ChatDrawer />);
    act(() => useUi.getState().openChat());
    expect(await screen.findByRole("dialog", { name: "Ask your data" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Top 5 campaigns by ROAS last 7 days/ }));
    expect(await screen.findByRole("region", { name: "Top 5 campaigns by ROAS · Last 7 days" })).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/All campaigns combined/)).toBeTruthy());
    expect(await screen.findByText("Show the daily trend")).toBeTruthy();
    const req = calls.find((c) => c.path === "/api/ai/chat")?.body as { message: string; history: unknown[]; context: Record<string, string> };
    expect(req.message).toBe("Top 5 campaigns by ROAS last 7 days");
    expect(req.history).toEqual([]);
    expect(req.context).toMatchObject({ page: "/overview", range: "30d" });
    expect(screen.getAllByText("Demo engine").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Open in Explore ↗" }));
    const href = String(nav.push.mock.calls[0]?.[0]);
    expect(href.startsWith("/explore?q=")).toBe(true);
    const payload = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(href.slice("/explore?q=".length)))))) as { spec: { metrics: string[] }; viz: { type: string } };
    expect(payload.spec.metrics[0]).toBe("roas");
    expect(payload.viz).toEqual({ type: "bar", horizontal: true });
  });

  it("adds a result to a dashboard as a Question widget", async () => {
    wrap(<ChatDrawer />);
    act(() => useUi.getState().openChat("Spend by device this month vs last month"));
    expect(await screen.findByRole("region", { name: "Spend by device · Month to date vs previous period" })).toBeTruthy();
    const trigger = screen.getByRole("button", { name: /Add to dashboard/ });
    fireEvent.keyDown(trigger, { key: "Enter" });
    const target = dashboards[0] as Dashboard;
    fireEvent.click(await screen.findByRole("menuitem", { name: new RegExp(target.name) }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")).toBeTruthy());
    const put = calls.find((c) => c.method === "PUT") as unknown as { path: string; body: { doc: { widgets: { type: string; title?: string; config: Record<string, unknown> }[]; layout: { i: string }[] }; version: number } };
    expect(put.path).toBe(`/api/dashboards/${target.id}`);
    expect(put.body.version).toBe(target.version);
    const w = put.body.doc.widgets.at(-1);
    expect(w).toMatchObject({ type: "question", title: "Spend by device", config: { preset: "ai-chat", viz: { type: "bar", horizontal: true }, query: { metrics: ["cost"], dimensions: ["device"], dateRange: { preset: "mtd" } } } });
    expect(put.body.doc.layout.some((l) => l.i === (w as unknown as { id: string }).id)).toBe(true);
  });

  it("renders KPI, line and table results", async () => {
    wrap(<ChatDrawer />);
    act(() => useUi.getState().openChat("Spend, conversions and CPA last 7 days vs previous period"));
    expect(await screen.findByRole("region", { name: "Spend · Conv. · CPA · Last 7 days vs previous period" })).toBeTruthy();
    expect(screen.getAllByText(/vs \$/).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole("textbox", { name: /Ask a question/ }), { target: { value: "Why did CPA rise last week?" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: /Ask a question/ }), { key: "Enter", metaKey: true });
    expect(await screen.findByRole("table", { name: "Query result" })).toBeTruthy();
    const second = calls.filter((c) => c.path === "/api/ai/chat")[1]?.body as { history: { role: string }[] };
    expect(second.history.map((h) => h.role)).toEqual(["user", "assistant"]);
  });

  it("stop keeps the partial answer and offers retry", async () => {
    hangChat = true;
    wrap(<ChatDrawer />);
    act(() => useUi.getState().openChat("top 5 campaigns by ROAS last 7 days"));
    expect(await screen.findByText(/All campaigns combined/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(await screen.findByText("Stopped — the partial answer is kept.")).toBeTruthy();
    expect(screen.getByText(/All campaigns combined/)).toBeTruthy();
    hangChat = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry ↻" }));
    await waitFor(() => expect(calls.filter((c) => c.path === "/api/ai/chat")).toHaveLength(2));
    await waitFor(() => expect(screen.queryByText("Stopped — the partial answer is kept.")).toBeNull());
  });
});

describe("display currency", () => {
  it("converts account amounts into the display currency in chat results and negatives", async () => {
    displayCurrency = "VND";
    const { unmount } = wrap(<ChatDrawer />);
    act(() => useUi.getState().openChat("Spend, conversions and CPA last 7 days vs previous period"));
    const kpis = await screen.findByRole("region", { name: "Spend · Conv. · CPA · Last 7 days vs previous period" });
    await waitFor(() => expect(within(kpis).getAllByText(/₫/).length).toBeGreaterThan(0));
    expect(within(kpis).queryByText(/\$/)).toBeNull();
    unmount();

    nav.pathname = "/ai/negatives";
    wrap(<NegativesScreen />);
    const table = await screen.findByRole("table", { name: "Negative keyword candidates" });
    await waitFor(() => expect(within(table).getAllByText(/^₫/).length).toBeGreaterThan(0));
    expect(within(table).queryByText(/^\$/)).toBeNull();
  });
});
