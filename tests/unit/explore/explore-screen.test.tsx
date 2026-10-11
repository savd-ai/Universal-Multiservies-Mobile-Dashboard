/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { Tooltip } from "radix-ui";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useToasts } from "@/components/ui/toast";
import { decodeExploreParam } from "@/features/explore/codec";
import { ExploreScreen } from "@/features/explore/explore-screen";
import { generateDemoDataset, googlePlatformRows } from "../../support/synthetic/generator";
import { DEMO_ACCOUNTS } from "../../support/synthetic/scenario";
import { checkFormula } from "@/lib/domain/metrics/formula";
import { executeQuery, planQuery, QueryError } from "@/lib/domain/query/engine";
import { querySpecSchema } from "@/lib/domain/query/spec";
import { makeCatalog } from "./fixtures";
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
    usePathname: () => "/explore",
    useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
    default: ({ href: 咢壍, children: 玑壍, ...銀壍 }: {
        href: string;
        children: React.ReactNode;
    }) => (<a href={咢壍} {...銀壍}>
      {玑壍}
    </a>),
}));
const { registry: 彯壍 } = makeCatalog();
const 繞壍 = generateDemoDataset(DEMO_ACCOUNTS[0]!, { profile: "realistic", seed: "savd-demo-v1", anchor: "2026-09-28", scenarios: "extended", timezone: "America/New_York" });
const 鵍壍 = {
    mode: "live",
    reasonText: "Google Ads API connected · read-only.",
    account: { id: "4821193307", name: "Acme Running Co.", currency: "USD", timezone: "America/New_York", isManager: false, mode: "live" },
    accounts: [],
    today: "2026-09-29",
    dataThrough: "2026-09-28",
    display: { currency: "USD", fxRates: {} },
};
function 樼壍(褫壍: unknown) {
    try {
        const 嘚壍 = querySpecSchema.parse(褫壍);
        const 甉壍 = planQuery(嘚壍, { today: "2026-09-29", registry: 彯壍 });
        const 鏸壍 = (甉壍.table === "platform_daily" ? googlePlatformRows(繞壍) : 繞壍.tables[甉壍.table]) as unknown as Record<string, unknown>[];
        return { ok: true, result: executeQuery(甉壍, { rows: 鏸壍, grain: "daily" }, { dims: 繞壍.dims, registry: 彯壍, currency: "USD", timezone: "America/New_York", sources: [{ id: "google_ads", label: "Google Ads", mode: "live" }] }, 3) };
    }
    catch (惧壍) {
        if (惧壍 instanceof QueryError)
            return { ok: false, error: { code: 惧壍.code, message: 惧壍.message } };
        throw 惧壍;
    }
}
const 翖壍 = (黅壍: unknown) => new Response(JSON.stringify(黅壍), { status: 200, headers: { "Content-Type": "application/json" } });
const 殴壍: {
    path: string;
    method: string;
    body: unknown;
}[] = [];
let 誣壍: Record<string, unknown>[] = [];
const 垒壍 = {
    id: "overview",
    name: "Overview",
    isDefault: true,
    template: "performance",
    defaults: {},
    widgets: [{ id: "kpis", type: "question", config: {} }],
    layout: [{ i: "kpis", x: 0, y: 0, w: 12, h: 10 }],
    schemaVersion: 1,
    version: 5,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
};
beforeAll(() => {
    vi.stubGlobal("fetch", vi.fn(async (皁壍: string, 镰壍?: RequestInit) => {
        const 扟壍 = new URL(String(皁壍), "http://localhost:3000");
        const 腎壍 = 镰壍?.body ? JSON.parse(String(镰壍.body)) : undefined;
        const 丽壍 = 镰壍?.method ?? "GET";
        殴壍.push({ path: 扟壍.pathname, method: 丽壍, body: 腎壍 });
        if (扟壍.pathname === "/api/questions" && 丽壍 === "POST") {
            const 洬壍 = { ...腎壍, id: `q${誣壍.length + 1}`, version: 1, createdAt: "2026-09-29T10:00:00.000Z", updatedAt: "2026-09-29T10:00:00.000Z" };
            誣壍 = [洬壍, ...誣壍];
            return 翖壍(洬壍);
        }
        if (扟壍.pathname === "/api/dashboards/overview" && 丽壍 === "PUT")
            return 翖壍({ ...垒壍, ...腎壍.doc, version: 垒壍.version + 1 });
        switch (扟壍.pathname) {
            case "/api/dashboards":
                return 翖壍({ dashboards: [垒壍] });
            case "/api/status":
                return 翖壍(鵍壍);
            case "/api/questions":
                return 翖壍({ questions: 誣壍 });
            case "/api/metrics/custom":
                return 翖壍({ metrics: [] });
            case "/api/metrics/custom/validate":
                return 翖壍({ ...checkFormula(腎壍.formula, 彯壍.keys()), deps: [] });
            case "/api/query/batch":
                return 翖壍({ results: 腎壍.specs.map(樼壍) });
        }
        return new Response("{}", { status: 404 });
    }));
    vi.stubGlobal("ResizeObserver", class {
        observe() { }
        unobserve() { }
        disconnect() { }
    });
    vi.stubGlobal("matchMedia", (谛壍: string) => ({ matches: false, media: 谛壍, addEventListener() { }, removeEventListener() { }, addListener() { }, removeListener() { } }));
});
afterEach(() => {
    cleanup();
    useToasts.setState({ items: [] });
    殴壍.length = 0;
    誣壍 = [];
});
function 夊壍(矹壍 = "") {
    const 雨壍: URLSearchParams[] = [];
    const 揗壍 = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={揗壍}>
      <NuqsTestingAdapter searchParams={矹壍} hasMemory onUrlUpdate={(苆壍: UrlUpdateEvent) => 雨壍.push(苆壍.searchParams)}>
        <Tooltip.Provider>
          <ExploreScreen />
        </Tooltip.Provider>
      </NuqsTestingAdapter>
    </QueryClientProvider>);
    const 侵壍 = () => {
        const 溤壍 = 雨壍.at(-1)?.get("q");
        const 趓壍 = 溤壍 ? decodeExploreParam(溤壍) : null;
        return 趓壍?.ok ? 趓壍.state : null;
    };
    return { urls: 雨壍, lastState: 侵壍 };
}
const 媂壍 = (祱壍: unknown) => encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(祱壍)))));
const 顠壍 = () => useToasts.getState().items.map((敏壍) => 敏壍.message);
describe("ExploreScreen", () => {
    it("opens a starter question into the notebook and the URL", async () => {
        const { lastState: 萾壍 } = 夊壍();
        fireEvent.click(await screen.findByRole("button", { name: /Spend and ROAS by campaign type/ }));
        expect(await screen.findByRole("heading", { level: 2, name: "Spend and ROAS by campaign type" })).toBeInTheDocument();
        for (const 儭壍 of ["Data", "Metrics", "Group by", "Sort & limit", "Date range", "Visualization"])
            expect(screen.getByRole("region", { name: 儭壍 })).toBeInTheDocument();
        expect(萾壍()?.spec).toMatchObject({ metrics: ["cost", "roas"], dimensions: ["campaign_type"] });
        expect(萾壍()?.viz).toEqual({ type: "bar" });
        expect(await within(screen.getByRole("region", { name: "Preview" })).findByText("Campaign · daily")).toBeInTheDocument();
    });
    it("edits the question through the notebook (metric chips write ?q=)", async () => {
        const { lastState: 瀜壍 } = 夊壍(`?q=${媂壍({ spec: { metrics: ["cost"], dimensions: ["campaign_type"] } })}`);
        const 輋壍 = await screen.findByRole("region", { name: "Metrics" });
        fireEvent.click(within(輋壍).getByRole("button", { name: /^CTR/ }));
        await waitFor(() => expect(瀜壍()?.spec.metrics).toEqual(["cost", "ctr"]));
        const 寺壍 = screen.getByRole("region", { name: "Group by" });
        fireEvent.click(within(寺壍).getByRole("button", { name: "Device" }));
        await waitFor(() => expect(瀜壍()?.spec.dimensions).toEqual(["campaign_type", "device"]));
        expect(within(screen.getByRole("region", { name: "Metrics" })).getByRole("button", { name: /Search impr\. share/ })).toHaveAttribute("aria-disabled", "true");
    });
    it("shows engine errors inline with one-click fixes", async () => {
        夊壍(`?q=${媂壍({ spec: { metrics: ["cost"], dimensions: ["hour", "device"] } })}`);
        expect(await screen.findByText("This question can't be answered as asked")).toBeInTheDocument();
        expect(screen.getByText("Hour cannot be combined with device or country breakdowns.")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Remove Device from Group by" }));
        await waitFor(() => expect(screen.queryByText("This question can't be answered as asked")).toBeNull());
        expect(await within(screen.getByRole("region", { name: "Preview" })).findByText("Campaign × hour")).toBeInTheDocument();
    });
    it("falls back to a fresh notebook with a toast for an unreadable link", async () => {
        夊壍("?q=garbage!!");
        expect(await screen.findByRole("heading", { level: 2, name: "Spend and Conversions by date" })).toBeInTheDocument();
        expect(顠壍().some((竩壍) => 竩壍.startsWith("Couldn't open that question"))).toBe(true);
    });
    it("renders every row in the Table view", async () => {
        夊壍(`?q=${媂壍({ spec: { metrics: ["cost", "roas"], dimensions: ["campaign_type"] } })}&view=table`);
        const 駘壍 = await screen.findByRole("table", { name: /result rows/ }, { timeout: 5000 });
        await waitFor(() => expect(within(駘壍).getAllByRole("row").length).toBe(1 + 6 + 1));
        expect(within(駘壍).getByText("Search")).toBeInTheDocument();
    });
    it("saves the question, then adds it to a dashboard without pinning the range", async () => {
        const { urls: 曇壍 } = 夊壍(`?q=${媂壍({ spec: { metrics: ["cost", "roas"], dimensions: ["campaign_type"] }, viz: { type: "bar" } })}`);
        fireEvent.click(await screen.findByRole("button", { name: "Save question" }));
        const 薶壍 = await screen.findByRole("dialog", { name: "Save as a question" });
        expect(within(薶壍).getByLabelText("Name")).toHaveValue("Spend and ROAS by campaign type");
        fireEvent.click(within(薶壍).getByRole("button", { name: "Save" }));
        await waitFor(() => expect(曇壍.at(-1)?.get("question")).toBe("q1"));
        const 劥壍 = 殴壍.find((熔壍) => 熔壍.path === "/api/questions" && 熔壍.method === "POST");
        expect(劥壍?.body).toMatchObject({ name: "Spend and ROAS by campaign type", origin: "explore", viz: { type: "bar" }, query: { metrics: ["cost", "roas"], dimensions: ["campaign_type"], dateRange: { preset: "last_30d" } } });
        expect(await screen.findByText("Saved")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Add to dashboard" }));
        const 邃壍 = await screen.findByRole("dialog", { name: "Add to dashboard" });
        fireEvent.click(await within(邃壍).findByRole("button", { name: "Add widget" }));
        await waitFor(() => expect(殴壍.some((嵲壍) => 嵲壍.path === "/api/dashboards/overview" && 嵲壍.method === "PUT")).toBe(true));
        const 籡壍 = 殴壍.find((魐壍) => 魐壍.path === "/api/dashboards/overview" && 魐壍.method === "PUT")?.body as {
            doc: {
                widgets: {
                    id: string;
                    type: string;
                    title: string;
                    config: {
                        query: Record<string, unknown>;
                        viz: unknown;
                    };
                }[];
                layout: {
                    i: string;
                    x: number;
                    y: number;
                    w: number;
                    h: number;
                }[];
            };
            version: number;
        };
        const 栿壍 = 籡壍.doc.widgets.at(-1)!;
        expect(籡壍.version).toBe(5);
        expect(籡壍.doc.widgets).toHaveLength(2);
        expect(栿壍).toMatchObject({ type: "question", title: "Spend and ROAS by campaign type", config: { query: { metrics: ["cost", "roas"], dimensions: ["campaign_type"] }, viz: { type: "bar" } } });
        expect(栿壍.config.query.dateRange).toBeUndefined();
        expect(籡壍.doc.layout.at(-1)).toEqual({ i: 栿壍.id, x: 0, y: 10, w: 6, h: 16 });
        await waitFor(() => expect(顠壍()).toContain("Added “Spend and ROAS by campaign type” to Overview"));
    });
    it("validates custom metric formulas live and marks the error position", async () => {
        夊壍(`?q=${媂壍({ spec: { metrics: ["cost"] } })}`);
        fireEvent.click(await screen.findByRole("button", { name: "+ New custom metric" }));
        const 蜮壍 = await screen.findByRole("dialog", { name: "New custom metric" });
        fireEvent.change(within(蜮壍).getByLabelText("Label"), { target: { value: "Profit" } });
        expect(within(蜮壍).getByLabelText("Key")).toHaveValue("profit");
        const 吝壍 = within(蜮壍).getByLabelText("Formula");
        fireEvent.change(吝壍, { target: { value: "(conv_value - cost" } });
        expect(await within(蜮壍).findByText(/Missing closing parenthesis · column 19/)).toBeInTheDocument();
        expect(within(蜮壍).getByRole("button", { name: "Create metric" })).toBeDisabled();
        fireEvent.change(吝壍, { target: { value: "(conv_value - costs)" } });
        expect(await within(蜮壍).findByText(/Unknown metric "costs" · column 15/)).toBeInTheDocument();
        fireEvent.change(吝壍, { target: { value: "conv_value - cost" } });
        expect(await within(蜮壍).findByText(/✓ Valid/)).toBeInTheDocument();
        await act(async () => { });
        expect(within(蜮壍).getByRole("button", { name: "Create metric" })).toBeEnabled();
    });
});
