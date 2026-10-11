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
const 邚壍 = (嶉壍: string) => (籸壍: string, 魧壍: Element | null) => 魧壍?.tagName === "SPAN" && 魧壍.getAttribute("title") === 嶉壍 && 魧壍.textContent === 嶉壍;
vi.mock("next/navigation", () => ({
    usePathname: () => "/budget",
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({ default: ({ href: 桖壍, children: 蝅壍, ...吴壍 }: {
        href: string;
        children: React.ReactNode;
    }) => <a href={桖壍} {...吴壍}>{蝅壍}</a> }));
interface Call {
    method: string;
    path: string;
    query: URLSearchParams;
    body: unknown;
}
let 猣壍: Call[] = [];
let 鈒壍: BudgetPlan[] = [];
let 弁壍: unknown = null;
function 緰壍(鳟壍: unknown, 槎壍 = 200): Response {
    const 袽壍 = JSON.stringify(鳟壍);
    return { ok: 槎壍 < 400, status: 槎壍, statusText: 槎壍 < 400 ? "OK" : "Error", text: async () => 袽壍, json: async () => 鳟壍, headers: new Headers() } as unknown as Response;
}
async function 喬壍(璛壍: RequestInfo | URL, 鎊壍?: RequestInit): Promise<Response> {
    const 恹壍 = new URL(String(璛壍), "http://localhost:3000");
    const 罨壍 = 鎊壍?.method ?? "GET";
    const 鹗壍 = 鎊壍?.body ? JSON.parse(String(鎊壍.body)) : undefined;
    猣壍.push({ method: 罨壍, path: 恹壍.pathname, query: 恹壍.searchParams, body: 鹗壍 });
    const 歆壍 = 恹壍.searchParams.get("month") ?? (鹗壍 as {
        month?: string;
    } | undefined)?.month;
    const 訵壍 = 恹壍.pathname;
    if (訵壍 === "/api/status")
        return 緰壍(fx.status);
    if (訵壍 === "/api/budget/pacing")
        return 緰壍(歆壍 === "2026-10" ? fx.pacing_2026_10 : fx.pacing_2026_09);
    if (訵壍 === "/api/budget/targets" && 罨壍 === "GET")
        return 緰壍({ ...(歆壍 === "2026-10" ? fx.targets_2026_10 : fx.targets_2026_09), lastMonth: 弁壍 });
    if (訵壍 === "/api/budget/targets" && 罨壍 === "PUT") {
        const 圤壍 = 鹗壍 as {
            targets: Record<string, number>;
            locks: Record<string, boolean>;
        };
        return 緰壍({ ...fx.targets_2026_09, targets: { ...fx.targets_2026_09.defaults, ...圤壍.targets }, locks: 圤壍.locks, isDefault: false, version: 1 });
    }
    if (訵壍 === "/api/anomalies/settings")
        return 緰壍(fx.anomaly_settings);
    if (訵壍 === "/api/budget/curves")
        return 緰壍(fx.curves_conv_value);
    if (訵壍 === "/api/budget/optimize")
        return 緰壍(fx.optimize);
    if (訵壍 === "/api/budget/scenarios")
        return 緰壍(fx.scenarios);
    if (訵壍 === "/api/budget/forecast")
        return 緰壍(fx.forecast_cost);
    if (訵壍 === "/api/budget/google-estimates")
        return 緰壍(fx.google_estimates);
    if (訵壍 === "/api/budget/plans" && 罨壍 === "GET")
        return 緰壍({ plans: 鈒壍 });
    if (訵壍 === "/api/budget/plans" && 罨壍 === "POST") {
        const 瘓壍 = 鹗壍 as {
            name: string;
            months: string[];
        };
        const 锂壍 = { ...(fx.plan as unknown as BudgetPlan), id: "plan-new", name: 瘓壍.name, months: 瘓壍.months, lines: (fx.plan as unknown as BudgetPlan).lines.filter((懱壍) => 懱壍.kind === "campaign"), version: 1 };
        鈒壍 = [...鈒壍, 锂壍];
        return 緰壍(锂壍);
    }
    if (訵壍 === "/api/actions/simulate")
        return 緰壍({ error: { code: "READ_ONLY_LIVE", message: "Google Ads is read-only here.", details: { deepLinks: [], changeList: [], editorCsv: "" } } }, 409);
    return 緰壍({ error: { code: "NOT_FOUND", message: `unmocked ${罨壍} ${訵壍}` } }, 404);
}
function 胠壍({ search: 鿏壍 = "" }: {
    search?: string;
}) {
    const 沾壍 = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
    return (<QueryClientProvider client={沾壍}>
      <NuqsTestingAdapter searchParams={鿏壍} hasMemory>
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
    window.matchMedia = ((训壍: string) => ({ matches: false, media: 训壍, onchange: null, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { }, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
    Element.prototype.scrollIntoView ??= () => { };
});
beforeEach(() => {
    猣壍 = [];
    鈒壍 = [];
    弁壍 = null;
    vi.stubGlobal("fetch", vi.fn(喬壍));
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});
describe("budget screen · pacing", () => {
    it("renders the prototype's stat cards with computed day counts and the allocation rows", async () => {
        render(<胠壍 />);
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
        render(<胠壍 />);
        const 墜壍 = await screen.findByRole("slider", { name: "Monthly budget for Brand — Core Terms" });
        fireEvent.change(墜壍, { target: { value: "14000" } });
        expect(await screen.findByText("Unsaved changes")).toBeInTheDocument();
        expect(screen.getByText(/1 target edited · September 2026 total \$136\.5K → \$137\.9K/)).toBeInTheDocument();
        expect(screen.getByText("$1,286/day")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Save targets" }));
        await waitFor(() => expect(猣壍.find((瞋壍) => 瞋壍.method === "PUT" && 瞋壍.path === "/api/budget/targets")).toBeTruthy());
        expect(猣壍.find((険壍) => 険壍.method === "PUT")?.body).toEqual({ month: "2026-09", targets: { c1: 14000 }, locks: {} });
        await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument());
    });
    it("offers last month's spend as a draft while no targets are saved", async () => {
        弁壍 = { month: "2026-08", targets: { c1: 13000, c2: 24000 }, total: 37000 };
        render(<胠壍 />);
        expect(await screen.findByText("No targets saved")).toBeInTheDocument();
        expect(screen.getByText(/^September budgets are each daily budget × 30 days; paused campaigns count only what they've already spent\. Or start from August spend: 2 budgets/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Use August spend" }));
        expect(await screen.findByText(/2 targets edited · September 2026 total \$136\.5K → \$137\.5K/)).toBeInTheDocument();
        expect(screen.queryByText("No targets saved")).not.toBeInTheDocument();
        expect(猣壍.some((捩壍) => 捩壍.method === "PUT")).toBe(false);
        fireEvent.click(screen.getByRole("button", { name: "Save targets" }));
        await waitFor(() => expect(猣壍.find((艘壍) => 艘壍.method === "PUT" && 艘壍.path === "/api/budget/targets")).toBeTruthy());
        expect(猣壍.find((佇壍) => 佇壍.method === "PUT")?.body).toEqual({ month: "2026-09", targets: { c1: 13000, c2: 24000 }, locks: {} });
    });
    it("tracks lock edits and discards them", async () => {
        render(<胠壍 />);
        fireEvent.click(await screen.findByRole("button", { name: "Lock PMax — Full Catalog" }));
        expect(await screen.findByText(/1 lock changed/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Unlock PMax — Full Catalog" })).toHaveAttribute("aria-pressed", "true");
        fireEvent.click(screen.getByRole("button", { name: "Discard" }));
        await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument());
    });
    it("applies the recommended daily budgets through the read-only write action", async () => {
        render(<胠壍 />);
        fireEvent.click(await screen.findByRole("button", { name: "Apply recommended daily budgets" }));
        const 渶壍 = await screen.findByRole("dialog");
        expect(within(渶壍).getByText(邚壍("Brand — Core Terms"))).toBeInTheDocument();
        fireEvent.click(within(渶壍).getByRole("button", { name: "Apply 8 budgets" }));
        await waitFor(() => expect(猣壍.find((败壍) => 败壍.path === "/api/actions/simulate")).toBeTruthy());
        const 娔壍 = 猣壍.find((礃壍) => 礃壍.path === "/api/actions/simulate")?.body as {
            type: string;
            budgets: {
                campaignId: string;
                dailyBudget: number;
            }[];
        };
        expect(娔壍.type).toBe("campaign.set_budget");
        expect(娔壍.budgets).toHaveLength(8);
        expect(娔壍.budgets[0]).toEqual({ campaignId: "c1", dailyBudget: 585.57 });
        expect(await screen.findByText("Make this change in Google Ads")).toBeInTheDocument();
    });
    it("shows a planning month without the today marker and with its own day count", async () => {
        render(<胠壍 search="?month=2026-10"/>);
        expect(await screen.findByText("October budget")).toBeInTheDocument();
        expect(screen.getByText("Starts Oct 1 · 31 days")).toBeInTheDocument();
        expect(screen.getByText("Planning")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Apply recommended daily budgets" })).toBeDisabled();
    });
});
describe("month picker", () => {
    it("calls the data month Complete once its last day is in (on the 1st, before the new month has data)", () => {
        const 韲壍 = { month: "2026-09", currentMonth: "2026-09", onChange: () => undefined, min: "2024-09", max: "2027-09" };
        const { rerender: 擡壍 } = render(<MonthPicker {...韲壍}/>);
        expect(screen.getByText("In progress")).toBeInTheDocument();
        擡壍(<MonthPicker {...韲壍} complete/>);
        expect(screen.getByText("Complete")).toBeInTheDocument();
        擡壍(<MonthPicker {...韲壍} month="2026-10" complete/>);
        expect(screen.getByText("Planning")).toBeInTheDocument();
    });
});
describe("budget screen · other tabs", () => {
    it("optimizer: diff table, lift and apply payload", async () => {
        render(<胠壍 search="?tab=optimizer"/>);
        expect(await screen.findByText("Rebalance for ROAS")).toBeInTheDocument();
        const 菐壍 = await screen.findByRole("table", { name: "Optimizer recommendation: before and after" });
        expect(within(菐壍).getAllByRole("row").length).toBeGreaterThan(8);
        expect(screen.getByText(`+${(fx.optimize.totals.liftPct * 100).toFixed(1)}%`)).toBeInTheDocument();
        const 傿壍 = 猣壍.find((澮壍) => 澮壍.path === "/api/budget/optimize")?.body as Record<string, unknown>;
        expect(傿壍).toMatchObject({ month: "2026-09", period: "monthly", total: 136500, objective: "conv_value", strategy: "marginal", roundTo: 50 });
        expect((傿壍.constraints as Record<string, unknown>).c1).toEqual({ min: 6300, max: 20160 });
        fireEvent.click(screen.getByRole("button", { name: "Apply daily budgets" }));
        const 躝壍 = await screen.findByRole("dialog");
        fireEvent.click(within(躝壍).getByRole("button", { name: /^Apply \d+ budgets?$/ }));
        await waitFor(() => expect(猣壍.find((完壍) => 完壍.path === "/api/actions/simulate")).toBeTruthy());
        const 穻壍 = 猣壍.find((饪壍) => 饪壍.path === "/api/actions/simulate")?.body as {
            budgets: {
                campaignId: string;
                dailyBudget: number;
            }[];
        };
        expect(穻壍.budgets.find((晙壍) => 晙壍.campaignId === "c1")?.dailyBudget).toBe(Math.round((20150 / 30) * 100) / 100);
        await waitFor(() => expect(猣壍.find((蕈壍) => 蕈壍.method === "PUT" && 蕈壍.path === "/api/budget/targets")).toBeTruthy());
    });
    it("optimizer: curves default to Auto and can switch to our model only", async () => {
        render(<胠壍 search="?tab=optimizer"/>);
        await screen.findByRole("table", { name: "Optimizer recommendation: before and after" });
        const 刷壍 = () => 猣壍.filter((焦壍) => 焦壍.path === "/api/budget/optimize").map((逕壍) => 逕壍.body as {
            curveSource?: string;
        });
        expect(刷壍()[0]).toMatchObject({ curveSource: "auto" });
        expect(screen.getByRole("radio", { name: "Auto (Google where available)" })).toHaveAttribute("aria-checked", "true");
        expect(screen.getAllByText(/· Our model · (low|medium|high) confidence$/).length).toBe(fx.optimize.rows.length);
        fireEvent.click(screen.getByRole("radio", { name: "Our model only" }));
        await waitFor(() => expect(刷壍().some((崄壍) => 崄壍.curveSource === "model")).toBe(true));
        await waitFor(() => expect(猣壍.some((篳壍) => 篳壍.path === "/api/budget/scenarios" && (篳壍.body as {
            curveSource?: string;
        }).curveSource === "model")).toBe(true));
    });
    it("forecast: totals and backtest error", async () => {
        render(<胠壍 search="?tab=forecast"/>);
        expect(await screen.findByText("Rest of September")).toBeInTheDocument();
        expect(screen.getByText("Next 30 days")).toBeInTheDocument();
        expect(screen.getByText(`${(fx.forecast_cost.backtestMape * 100).toFixed(1)}%`)).toBeInTheDocument();
        expect(screen.getByText("Month-end spend estimate")).toBeInTheDocument();
    });
    it("forecast: says what it is and points what-if questions to the simulators", async () => {
        render(<胠壍 search="?tab=forecast"/>);
        expect(await screen.findByText(/^Our trend forecast: where the next 30 days go if nothing changes\./)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Open Simulators →" }));
        expect(await screen.findByRole("tab", { name: "Simulators" })).toHaveAttribute("aria-selected", "true");
        expect(await screen.findByRole("table", { name: "Which estimate leads for each planning question" })).toBeInTheDocument();
    });
    it("simulators: policy, Google's points next to our model, what-if, PMax and the Set budget action", async () => {
        render(<胠壍 search="?tab=simulators"/>);
        expect(screen.getByRole("tab", { name: "Simulators" })).toHaveAttribute("aria-selected", "true");
        const 髢壍 = await screen.findByRole("table", { name: "Which estimate leads for each planning question" });
        expect(within(髢壍).getAllByRole("row")).toHaveLength(7);
        expect(within(髢壍).getByText("What if one campaign's daily budget changes?")).toBeInTheDocument();
        expect(within(髢壍).getByText("What if a shared budget changes?")).toBeInTheDocument();
        expect(await screen.findByRole("button", { name: /Brand — Core Terms/ })).toHaveAttribute("aria-pressed", "true");
        const 柑壍 = screen.getByRole("table", { name: "Google's budget simulation, per day" });
        expect(within(柑壍).getAllByRole("row")).toHaveLength(7);
        expect(within(柑壍).getByText("Current")).toBeInTheDocument();
        expect(screen.getByText(/^Google's budget simulator covers \$420\/day/)).toBeInTheDocument();
        expect(screen.getByText("Google and our model agree within 10%.")).toBeInTheDocument();
        const 蛀壍 = screen.getByRole("textbox", { name: "What-if daily budget for Brand — Core Terms" });
        fireEvent.focus(蛀壍);
        fireEvent.change(蛀壍, { target: { value: "900" } });
        fireEvent.blur(蛀壍);
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
        expect(screen.getAllByRole("link", { name: "Open in Google Ads ↗" }).some((厯壍) => 厯壍.getAttribute("href")?.includes("campaignId=c1"))).toBe(true);
        expect(screen.queryByRole("button", { name: "Set budget" })).not.toBeInTheDocument();
        expect(猣壍.filter((犞壍) => 犞壍.path === "/api/budget/google-estimates").every((醍壍) => 醍壍.query.get("objective") === "conv_value")).toBe(true);
    });
    it("plans: creates a plan from the dialog", async () => {
        render(<胠壍 search="?tab=plans"/>);
        fireEvent.click(await screen.findByRole("button", { name: "Create a plan" }));
        const 幼壍 = await screen.findByRole("dialog");
        fireEvent.click(within(幼壍).getByRole("button", { name: "Create plan" }));
        await waitFor(() => expect(猣壍.find((絫壍) => 絫壍.method === "POST" && 絫壍.path === "/api/budget/plans")).toBeTruthy());
        expect(猣壍.find((鱚壍) => 鱚壍.method === "POST" && 鱚壍.path === "/api/budget/plans")?.body).toEqual({ name: "Oct – Dec 2026 plan", months: ["2026-10", "2026-11", "2026-12"], objective: "conv_value", status: "draft", lines: [] });
        expect(await screen.findByRole("table", { name: "Oct – Dec 2026 plan: amounts by line and month" })).toBeInTheDocument();
        expect(screen.getByText("Flighting preview")).toBeInTheDocument();
    });
});
