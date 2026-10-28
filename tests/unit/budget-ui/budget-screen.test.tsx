/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { Tooltip } from "radix-ui";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster } from "@/components/ui/toast";
import type { BudgetPlan } from "@/lib/domain/contracts/budget";
import { BudgetScreen } from "@/features/budget/budget-screen";
import { MonthPicker } from "@/features/budget/budget-ui";
import fx from "./fixtures/budget-api.json";
const nameText = (name: string) => (_: string, el: Element | null) => el?.tagName === "SPAN" && el.getAttribute("title") === name && el.textContent === name;
vi.mock("next/navigation", () => ({
    usePathname: () => "/budget",
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: {
        href: string;
        children: React.ReactNode;
    }) => <a href={href} {...rest}>{children}</a> }));
interface Call {
    method: string;
    path: string;
    query: URLSearchParams;
    body: unknown;
}
let calls: Call[] = [];
let plans: BudgetPlan[] = [];
let lastMonth: unknown = null;
function json(data: unknown, status = 200): Response {
    const text = JSON.stringify(data);
    return { ok: status < 400, status, statusText: status < 400 ? "OK" : "Error", text: async () => text, json: async () => data, headers: new Headers() } as unknown as Response;
}
async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = new URL(String(input), "http://localhost:3000");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname, query: url.searchParams, body });
    const month = url.searchParams.get("month") ?? (body as {
        month?: string;
    } | undefined)?.month;
    const p = url.pathname;
    if (p === "/api/status")
        return json(fx.status);
    if (p === "/api/budget/pacing")
        return json(month === "2026-10" ? fx.pacing_2026_10 : fx.pacing_2026_09);
    if (p === "/api/budget/targets" && method === "GET")
        return json({ ...(month === "2026-10" ? fx.targets_2026_10 : fx.targets_2026_09), lastMonth });
    if (p === "/api/budget/targets" && method === "PUT") {
        const b = body as {
            targets: Record<string, number>;
            locks: Record<string, boolean>;
        };
        return json({ ...fx.targets_2026_09, targets: { ...fx.targets_2026_09.defaults, ...b.targets }, locks: b.locks, isDefault: false, version: 1 });
    }
    if (p === "/api/anomalies/settings")
        return json(fx.anomaly_settings);
    if (p === "/api/budget/curves")
        return json(fx.curves_conv_value);
    if (p === "/api/budget/optimize")
        return json(fx.optimize);
    if (p === "/api/budget/scenarios")
        return json(fx.scenarios);
    if (p === "/api/budget/forecast")
        return json(fx.forecast_cost);
    if (p === "/api/budget/google-estimates")
        return json(fx.google_estimates);
    if (p === "/api/budget/plans" && method === "GET")
        return json({ plans });
    if (p === "/api/budget/plans" && method === "POST") {
        const b = body as {
            name: string;
            months: string[];
        };
        const plan = { ...(fx.plan as unknown as BudgetPlan), id: "plan-new", name: b.name, months: b.months, lines: (fx.plan as unknown as BudgetPlan).lines.filter((l) => l.kind === "campaign"), version: 1 };
        plans = [...plans, plan];
        return json(plan);
    }
    if (p === "/api/actions/simulate")
        return json({ error: { code: "READ_ONLY_LIVE", message: "Google Ads is read-only here.", details: { deepLinks: [], changeList: [], editorCsv: "" } } }, 409);
    return json({ error: { code: "NOT_FOUND", message: `unmocked ${method} ${p}` } }, 404);
}
function Harness({ search = "" }: {
    search?: string;
}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
    return (<QueryClientProvider client={client}>
      <NuqsTestingAdapter searchParams={search} hasMemory>
        <Tooltip.Provider>
          <BudgetScreen />
          <Toaster />
        </Tooltip.Provider>
      </NuqsTestingAdapter>
    </QueryClientProvider>);
}
beforeAll(() => {
    globalThis.ResizeObserver = class {
        observe() { }
        unobserve() { }
        disconnect() { }
    } as unknown as typeof ResizeObserver;
    window.matchMedia = ((q: string) => ({ matches: false, media: q, onchange: null, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { }, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
    Element.prototype.scrollIntoView ??= () => { };
});
beforeEach(() => {
    calls = [];
    plans = [];
    lastMonth = null;
    vi.stubGlobal("fetch", vi.fn(mockFetch));
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});
describe("budget screen · pacing", () => {
    it("renders the prototype's stat cards with computed day counts and the allocation rows", async () => {
        render(<Harness />);
        expect(await screen.findByText("September budget")).toBeInTheDocument();
        expect(screen.getByText("$136.5K")).toBeInTheDocument();
        expect(screen.getByText("86% used · 28 of 30 days")).toBeInTheDocument();
        expect(screen.getByText("$9,827 headroom")).toBeInTheDocument();
        expect(screen.getByText("Projected above 105% of budget")).toBeInTheDocument();
        expect(screen.getByText("Cumulative spend · September")).toBeInTheDocument();
        expect(screen.getAllByRole("slider")).toHaveLength(8);
        expect(screen.getAllByText("Underpacing")).toHaveLength(2);
        expect(screen.getByRole("tab", { name: "Pacing" })).toHaveAttribute("aria-selected", "true");
    });
    it("keeps edits as a draft and saves only the changed target", async () => {
        render(<Harness />);
        const slider = await screen.findByRole("slider", { name: "Monthly budget for Brand — Core Terms" });
        fireEvent.change(slider, { target: { value: "14000" } });
        expect(await screen.findByText("Unsaved changes")).toBeInTheDocument();
        expect(screen.getByText(/1 target edited · September 2026 total \$136\.5K → \$137\.9K/)).toBeInTheDocument();
        expect(screen.getByText("$1,286/day")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Save targets" }));
        await waitFor(() => expect(calls.find((c) => c.method === "PUT" && c.path === "/api/budget/targets")).toBeTruthy());
        expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ month: "2026-09", targets: { c1: 14000 }, locks: {} });
        await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument());
    });
    it("offers last month's spend as a draft while no targets are saved", async () => {
        lastMonth = { month: "2026-08", targets: { c1: 13000, c2: 24000 }, total: 37000 };
        render(<Harness />);
        expect(await screen.findByText("No targets saved")).toBeInTheDocument();
        expect(screen.getByText(/^September budgets are each daily budget × 30 days; paused campaigns count only what they've already spent\. Or start from August spend: 2 budgets/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Use August spend" }));
        expect(await screen.findByText(/2 targets edited · September 2026 total \$136\.5K → \$137\.5K/)).toBeInTheDocument();
        expect(screen.queryByText("No targets saved")).not.toBeInTheDocument();
        expect(calls.some((c) => c.method === "PUT")).toBe(false);
        fireEvent.click(screen.getByRole("button", { name: "Save targets" }));
        await waitFor(() => expect(calls.find((c) => c.method === "PUT" && c.path === "/api/budget/targets")).toBeTruthy());
        expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ month: "2026-09", targets: { c1: 13000, c2: 24000 }, locks: {} });
    });
    it("tracks lock edits and discards them", async () => {
        render(<Harness />);
        fireEvent.click(await screen.findByRole("button", { name: "Lock PMax — Full Catalog" }));
        expect(await screen.findByText(/1 lock changed/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Unlock PMax — Full Catalog" })).toHaveAttribute("aria-pressed", "true");
        fireEvent.click(screen.getByRole("button", { name: "Discard" }));
        await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument());
    });
    it("applies the recommended daily budgets through the read-only write action", async () => {
        render(<Harness />);
        fireEvent.click(await screen.findByRole("button", { name: "Apply recommended daily budgets" }));
        const dialog = await screen.findByRole("dialog");
        expect(within(dialog).getByText(nameText("Brand — Core Terms"))).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole("button", { name: "Apply 8 budgets" }));
        await waitFor(() => expect(calls.find((c) => c.path === "/api/actions/simulate")).toBeTruthy());
        const body = calls.find((c) => c.path === "/api/actions/simulate")?.body as {
            type: string;
            budgets: {
                campaignId: string;
                dailyBudget: number;
            }[];
        };
        expect(body.type).toBe("campaign.set_budget");
        expect(body.budgets).toHaveLength(8);
        expect(body.budgets[0]).toEqual({ campaignId: "c1", dailyBudget: 585.57 });
        expect(await screen.findByText("Make this change in Google Ads")).toBeInTheDocument();
    });
    it("shows a planning month without the today marker and with its own day count", async () => {
        render(<Harness search="?month=2026-10"/>);
        expect(await screen.findByText("October budget")).toBeInTheDocument();
        expect(screen.getByText("Starts Oct 1 · 31 days")).toBeInTheDocument();
        expect(screen.getByText("Planning")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Apply recommended daily budgets" })).toBeDisabled();
    });
});
describe("month picker", () => {
    it("calls the data month Complete once its last day is in (on the 1st, before the new month has data)", () => {
        const props = { month: "2026-09", currentMonth: "2026-09", onChange: () => undefined, min: "2024-09", max: "2027-09" };
        const { rerender } = render(<MonthPicker {...props}/>);
        expect(screen.getByText("In progress")).toBeInTheDocument();
        rerender(<MonthPicker {...props} complete/>);
        expect(screen.getByText("Complete")).toBeInTheDocument();
        rerender(<MonthPicker {...props} month="2026-10" complete/>);
        expect(screen.getByText("Planning")).toBeInTheDocument();
    });
});
describe("budget screen · other tabs", () => {
    it("optimizer: diff table, lift and apply payload", async () => {
        render(<Harness search="?tab=optimizer"/>);
        expect(await screen.findByText("Rebalance for ROAS")).toBeInTheDocument();
        const table = await screen.findByRole("table", { name: "Optimizer recommendation: before and after" });
        expect(within(table).getAllByRole("row").length).toBeGreaterThan(8);
        expect(screen.getByText(`+${(fx.optimize.totals.liftPct * 100).toFixed(1)}%`)).toBeInTheDocument();
        const optimize = calls.find((c) => c.path === "/api/budget/optimize")?.body as Record<string, unknown>;
        expect(optimize).toMatchObject({ month: "2026-09", period: "monthly", total: 136500, objective: "conv_value", strategy: "marginal", roundTo: 50 });
        expect((optimize.constraints as Record<string, unknown>).c1).toEqual({ min: 6300, max: 20160 });
        fireEvent.click(screen.getByRole("button", { name: "Apply daily budgets" }));
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: /^Apply \d+ budgets?$/ }));
        await waitFor(() => expect(calls.find((c) => c.path === "/api/actions/simulate")).toBeTruthy());
        const sim = calls.find((c) => c.path === "/api/actions/simulate")?.body as {
            budgets: {
                campaignId: string;
                dailyBudget: number;
            }[];
        };
        expect(sim.budgets.find((b) => b.campaignId === "c1")?.dailyBudget).toBe(Math.round((20150 / 30) * 100) / 100);
        await waitFor(() => expect(calls.find((c) => c.method === "PUT" && c.path === "/api/budget/targets")).toBeTruthy());
    });
    it("optimizer: curves default to Auto and can switch to our model only", async () => {
        render(<Harness search="?tab=optimizer"/>);
        await screen.findByRole("table", { name: "Optimizer recommendation: before and after" });
        const optimizeCalls = () => calls.filter((c) => c.path === "/api/budget/optimize").map((c) => c.body as {
            curveSource?: string;
        });
        expect(optimizeCalls()[0]).toMatchObject({ curveSource: "auto" });
        expect(screen.getByRole("radio", { name: "Auto (Google where available)" })).toHaveAttribute("aria-checked", "true");
        expect(screen.getAllByText(/· Our model · (low|medium|high) confidence$/).length).toBe(fx.optimize.rows.length);
        fireEvent.click(screen.getByRole("radio", { name: "Our model only" }));
        await waitFor(() => expect(optimizeCalls().some((b) => b.curveSource === "model")).toBe(true));
        await waitFor(() => expect(calls.some((c) => c.path === "/api/budget/scenarios" && (c.body as {
            curveSource?: string;
        }).curveSource === "model")).toBe(true));
    });
    it("forecast: totals and backtest error", async () => {
        render(<Harness search="?tab=forecast"/>);
        expect(await screen.findByText("Rest of September")).toBeInTheDocument();
        expect(screen.getByText("Next 30 days")).toBeInTheDocument();
        expect(screen.getByText(`${(fx.forecast_cost.backtestMape * 100).toFixed(1)}%`)).toBeInTheDocument();
        expect(screen.getByText("Month-end spend estimate")).toBeInTheDocument();
    });
    it("forecast: says what it is and points what-if questions to the simulators", async () => {
        render(<Harness search="?tab=forecast"/>);
        expect(await screen.findByText(/^Our trend forecast: where the next 30 days go if nothing changes\./)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Open Simulators →" }));
        expect(await screen.findByRole("tab", { name: "Simulators" })).toHaveAttribute("aria-selected", "true");
        expect(await screen.findByRole("table", { name: "Which estimate leads for each planning question" })).toBeInTheDocument();
    });
    it("simulators: policy, Google's points next to our model, what-if, PMax and the Set budget action", async () => {
        render(<Harness search="?tab=simulators"/>);
        expect(screen.getByRole("tab", { name: "Simulators" })).toHaveAttribute("aria-selected", "true");
        const policy = await screen.findByRole("table", { name: "Which estimate leads for each planning question" });
        expect(within(policy).getAllByRole("row")).toHaveLength(7);
        expect(within(policy).getByText("What if one campaign's daily budget changes?")).toBeInTheDocument();
        expect(within(policy).getByText("What if a shared budget changes?")).toBeInTheDocument();
        expect(await screen.findByRole("button", { name: /Brand — Core Terms/ })).toHaveAttribute("aria-pressed", "true");
        const points = screen.getByRole("table", { name: "Google's budget simulation, per day" });
        expect(within(points).getAllByRole("row")).toHaveLength(7);
        expect(within(points).getByText("Current")).toBeInTheDocument();
        expect(screen.getByText(/^Google's budget simulator covers \$420\/day/)).toBeInTheDocument();
        expect(screen.getByText("Google and our model agree within 10%.")).toBeInTheDocument();
        const input = screen.getByRole("textbox", { name: "What-if daily budget for Brand — Core Terms" });
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: "900" } });
        fireEvent.blur(input);
        expect(await screen.findByText("$900/day is outside the budgets Google simulated ($210–$840/day), so our model leads.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /PMax — Full Catalog/ })).toHaveTextContent("No simulations from Google");
        fireEvent.click(screen.getByRole("button", { name: /PMax — Full Catalog/ }));
        expect(await screen.findByText("No simulations from Google for this campaign")).toBeInTheDocument();
        expect(screen.getByText("Google returned no budget simulation for this campaign, so our model leads.")).toBeInTheDocument();
        expect(screen.getByText(/use Performance Planner in the Google Ads interface/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /Shopping — Best Sellers/ }));
        fireEvent.click(await screen.findByRole("radio", { name: "Target ROAS" }));
        expect(await screen.findByRole("table", { name: "Google's target roas simulation, per day" })).toBeInTheDocument();
        expect(screen.getByText(/^We don't model bid targets, so Google's target simulator is the estimate here\./)).toBeInTheDocument();
        expect(screen.getByText("Google's budget recommendations")).toBeInTheDocument();
        expect(screen.getByText(/^Google's estimate per week: \+/)).toBeInTheDocument();
        expect(screen.getAllByRole("link", { name: "Open in Google Ads ↗" }).some((a) => a.getAttribute("href")?.includes("campaignId=c1"))).toBe(true);
        expect(screen.queryByRole("button", { name: "Set budget" })).not.toBeInTheDocument();
        expect(calls.filter((c) => c.path === "/api/budget/google-estimates").every((c) => c.query.get("objective") === "conv_value")).toBe(true);
    });
    it("plans: creates a plan from the dialog", async () => {
        render(<Harness search="?tab=plans"/>);
        fireEvent.click(await screen.findByRole("button", { name: "Create a plan" }));
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Create plan" }));
        await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.path === "/api/budget/plans")).toBeTruthy());
        expect(calls.find((c) => c.method === "POST" && c.path === "/api/budget/plans")?.body).toEqual({ name: "Oct – Dec 2026 plan", months: ["2026-10", "2026-11", "2026-12"], objective: "conv_value", status: "draft", lines: [] });
        expect(await screen.findByRole("table", { name: "Oct – Dec 2026 plan: amounts by line and month" })).toBeInTheDocument();
        expect(screen.getByText("Flighting preview")).toBeInTheDocument();
    });
});
