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
    default: ({ href, children, ...rest }: {
        href: string;
        children: React.ReactNode;
    }) => (<a href={href} {...rest}>
      {children}
    </a>),
}));
const { registry } = makeCatalog();
const ds = generateDemoDataset(DEMO_ACCOUNTS[0]!, { profile: "realistic", seed: "savd-demo-v1", anchor: "2026-09-28", scenarios: "extended", timezone: "America/New_York" });
const status = {
    mode: "live",
    reasonText: "Google Ads API connected · read-only.",
    account: { id: "4821193307", name: "Acme Running Co.", currency: "USD", timezone: "America/New_York", isManager: false, mode: "live" },
    accounts: [],
    today: "2026-09-29",
    dataThrough: "2026-09-28",
    display: { currency: "USD", fxRates: {} },
};
function runOne(input: unknown) {
    try {
        const spec = querySpecSchema.parse(input);
        const plan = planQuery(spec, { today: "2026-09-29", registry });
        const rows = (plan.table === "platform_daily" ? googlePlatformRows(ds) : ds.tables[plan.table]) as unknown as Record<string, unknown>[];
        return { ok: true, result: executeQuery(plan, { rows, grain: "daily" }, { dims: ds.dims, registry, currency: "USD", timezone: "America/New_York", sources: [{ id: "google_ads", label: "Google Ads", mode: "live" }] }, 3) };
    }
    catch (e) {
        if (e instanceof QueryError)
            return { ok: false, error: { code: e.code, message: e.message } };
        throw e;
    }
}
const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200, headers: { "Content-Type": "application/json" } });
const calls: {
    path: string;
    method: string;
    body: unknown;
}[] = [];
let questions: Record<string, unknown>[] = [];
const overview = {
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
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
        const u = new URL(String(url), "http://localhost:3000");
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        const method = init?.method ?? "GET";
        calls.push({ path: u.pathname, method, body });
        if (u.pathname === "/api/questions" && method === "POST") {
            const created = { ...body, id: `q${questions.length + 1}`, version: 1, createdAt: "2026-09-29T10:00:00.000Z", updatedAt: "2026-09-29T10:00:00.000Z" };
            questions = [created, ...questions];
            return json(created);
        }
        if (u.pathname === "/api/dashboards/overview" && method === "PUT")
            return json({ ...overview, ...body.doc, version: overview.version + 1 });
        switch (u.pathname) {
            case "/api/dashboards":
                return json({ dashboards: [overview] });
            case "/api/status":
                return json(status);
            case "/api/questions":
                return json({ questions });
            case "/api/metrics/custom":
                return json({ metrics: [] });
            case "/api/metrics/custom/validate":
                return json({ ...checkFormula(body.formula, registry.keys()), deps: [] });
            case "/api/query/batch":
                return json({ results: body.specs.map(runOne) });
        }
        return new Response("{}", { status: 404 });
    }));
    vi.stubGlobal("ResizeObserver", class {
        observe() { }
        unobserve() { }
        disconnect() { }
    });
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() { }, removeEventListener() { }, addListener() { }, removeListener() { } }));
});
afterEach(() => {
    cleanup();
    useToasts.setState({ items: [] });
    calls.length = 0;
    questions = [];
});
function renderExplore(search = "") {
    const urls: URLSearchParams[] = [];
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}>
      <NuqsTestingAdapter searchParams={search} hasMemory onUrlUpdate={(e: UrlUpdateEvent) => urls.push(e.searchParams)}>
        <Tooltip.Provider>
          <ExploreScreen />
        </Tooltip.Provider>
      </NuqsTestingAdapter>
    </QueryClientProvider>);
    const lastState = () => {
        const q = urls.at(-1)?.get("q");
        const r = q ? decodeExploreParam(q) : null;
        return r?.ok ? r.state : null;
    };
    return { urls, lastState };
}
const enc = (payload: unknown) => encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
const toasts = () => useToasts.getState().items.map((t) => t.message);
describe("ExploreScreen", () => {
    it("opens a starter question into the notebook and the URL", async () => {
        const { lastState } = renderExplore();
        fireEvent.click(await screen.findByRole("button", { name: /Spend and ROAS by campaign type/ }));
        expect(await screen.findByRole("heading", { level: 2, name: "Spend and ROAS by campaign type" })).toBeInTheDocument();
        for (const step of ["Data", "Metrics", "Group by", "Sort & limit", "Date range", "Visualization"])
            expect(screen.getByRole("region", { name: step })).toBeInTheDocument();
        expect(lastState()?.spec).toMatchObject({ metrics: ["cost", "roas"], dimensions: ["campaign_type"] });
        expect(lastState()?.viz).toEqual({ type: "bar" });
        expect(await within(screen.getByRole("region", { name: "Preview" })).findByText("Campaign · daily")).toBeInTheDocument();
    });
    it("edits the question through the notebook (metric chips write ?q=)", async () => {
        const { lastState } = renderExplore(`?q=${enc({ spec: { metrics: ["cost"], dimensions: ["campaign_type"] } })}`);
        const metrics = await screen.findByRole("region", { name: "Metrics" });
        fireEvent.click(within(metrics).getByRole("button", { name: /^CTR/ }));
        await waitFor(() => expect(lastState()?.spec.metrics).toEqual(["cost", "ctr"]));
        const groupBy = screen.getByRole("region", { name: "Group by" });
        fireEvent.click(within(groupBy).getByRole("button", { name: "Device" }));
        await waitFor(() => expect(lastState()?.spec.dimensions).toEqual(["campaign_type", "device"]));
        expect(within(screen.getByRole("region", { name: "Metrics" })).getByRole("button", { name: /Search impr\. share/ })).toHaveAttribute("aria-disabled", "true");
    });
    it("shows engine errors inline with one-click fixes", async () => {
        renderExplore(`?q=${enc({ spec: { metrics: ["cost"], dimensions: ["hour", "device"] } })}`);
        expect(await screen.findByText("This question can't be answered as asked")).toBeInTheDocument();
        expect(screen.getByText("Hour cannot be combined with device or country breakdowns.")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Remove Device from Group by" }));
        await waitFor(() => expect(screen.queryByText("This question can't be answered as asked")).toBeNull());
        expect(await within(screen.getByRole("region", { name: "Preview" })).findByText("Campaign × hour")).toBeInTheDocument();
    });
    it("falls back to a fresh notebook with a toast for an unreadable link", async () => {
        renderExplore("?q=garbage!!");
        expect(await screen.findByRole("heading", { level: 2, name: "Spend and Conversions by date" })).toBeInTheDocument();
        expect(toasts().some((m) => m.startsWith("Couldn't open that question"))).toBe(true);
    });
    it("renders every row in the Table view", async () => {
        renderExplore(`?q=${enc({ spec: { metrics: ["cost", "roas"], dimensions: ["campaign_type"] } })}&view=table`);
        const table = await screen.findByRole("table", { name: /result rows/ }, { timeout: 5000 });
        await waitFor(() => expect(within(table).getAllByRole("row").length).toBe(1 + 6 + 1));
        expect(within(table).getByText("Search")).toBeInTheDocument();
    });
    it("saves the question, then adds it to a dashboard without pinning the range", async () => {
        const { urls } = renderExplore(`?q=${enc({ spec: { metrics: ["cost", "roas"], dimensions: ["campaign_type"] }, viz: { type: "bar" } })}`);
        fireEvent.click(await screen.findByRole("button", { name: "Save question" }));
        const save = await screen.findByRole("dialog", { name: "Save as a question" });
        expect(within(save).getByLabelText("Name")).toHaveValue("Spend and ROAS by campaign type");
        fireEvent.click(within(save).getByRole("button", { name: "Save" }));
        await waitFor(() => expect(urls.at(-1)?.get("question")).toBe("q1"));
        const post = calls.find((c) => c.path === "/api/questions" && c.method === "POST");
        expect(post?.body).toMatchObject({ name: "Spend and ROAS by campaign type", origin: "explore", viz: { type: "bar" }, query: { metrics: ["cost", "roas"], dimensions: ["campaign_type"], dateRange: { preset: "last_30d" } } });
        expect(await screen.findByText("Saved")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Add to dashboard" }));
        const add = await screen.findByRole("dialog", { name: "Add to dashboard" });
        fireEvent.click(await within(add).findByRole("button", { name: "Add widget" }));
        await waitFor(() => expect(calls.some((c) => c.path === "/api/dashboards/overview" && c.method === "PUT")).toBe(true));
        const put = calls.find((c) => c.path === "/api/dashboards/overview" && c.method === "PUT")?.body as {
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
        const widget = put.doc.widgets.at(-1)!;
        expect(put.version).toBe(5);
        expect(put.doc.widgets).toHaveLength(2);
        expect(widget).toMatchObject({ type: "question", title: "Spend and ROAS by campaign type", config: { query: { metrics: ["cost", "roas"], dimensions: ["campaign_type"] }, viz: { type: "bar" } } });
        expect(widget.config.query.dateRange).toBeUndefined();
        expect(put.doc.layout.at(-1)).toEqual({ i: widget.id, x: 0, y: 10, w: 6, h: 16 });
        await waitFor(() => expect(toasts()).toContain("Added “Spend and ROAS by campaign type” to Overview"));
    });
    it("validates custom metric formulas live and marks the error position", async () => {
        renderExplore(`?q=${enc({ spec: { metrics: ["cost"] } })}`);
        fireEvent.click(await screen.findByRole("button", { name: "+ New custom metric" }));
        const dialog = await screen.findByRole("dialog", { name: "New custom metric" });
        fireEvent.change(within(dialog).getByLabelText("Label"), { target: { value: "Profit" } });
        expect(within(dialog).getByLabelText("Key")).toHaveValue("profit");
        const formula = within(dialog).getByLabelText("Formula");
        fireEvent.change(formula, { target: { value: "(conv_value - cost" } });
        expect(await within(dialog).findByText(/Missing closing parenthesis · column 19/)).toBeInTheDocument();
        expect(within(dialog).getByRole("button", { name: "Create metric" })).toBeDisabled();
        fireEvent.change(formula, { target: { value: "(conv_value - costs)" } });
        expect(await within(dialog).findByText(/Unknown metric "costs" · column 15/)).toBeInTheDocument();
        fireEvent.change(formula, { target: { value: "conv_value - cost" } });
        expect(await within(dialog).findByText(/✓ Valid/)).toBeInTheDocument();
        await act(async () => { });
        expect(within(dialog).getByRole("button", { name: "Create metric" })).toBeEnabled();
    });
});
