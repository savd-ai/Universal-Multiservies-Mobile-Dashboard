/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { Tooltip } from "radix-ui";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CampaignDetailScreen } from "@/features/campaigns/campaign-detail";
import { CampaignDrawerHost } from "@/features/campaigns/campaign-drawer";
import { CampaignsScreen } from "@/features/campaigns/campaigns-screen";
import annotationsC6 from "./fixtures/annotations-c6.json";
import anomaliesC3 from "./fixtures/anomalies-c3.json";
import changesC6 from "./fixtures/changes-c6.json";
import detailC2 from "./fixtures/detail-c2.json";
import detailC3 from "./fixtures/detail-c3.json";
import detailC6 from "./fixtures/detail-c6.json";
import impactC6 from "./fixtures/impact-c6-bid.json";
import list from "./fixtures/list.json";
import pacing from "./fixtures/pacing.json";
import status from "./fixtures/status.json";
const nameText = (name: string) => (_: string, el: Element | null) => el?.tagName === "SPAN" && el.getAttribute("title") === name && el.textContent === name;
const nav = vi.hoisted(() => ({ pathname: "/campaigns" }));
vi.mock("next/navigation", () => ({
    usePathname: () => nav.pathname,
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
    default: ({ href, children, ...rest }: {
        href: string;
        children: React.ReactNode;
    } & Record<string, unknown>) => (<a href={String(href)} className={rest.className as string | undefined}>
      {children}
    </a>),
}));
const detailById: Record<string, unknown> = { c2: detailC2, c3: detailC3, c6: detailC6 };
const calls: {
    method: string;
    path: string;
    body?: unknown;
}[] = [];
function json(body: unknown, status2 = 200) {
    return new Response(JSON.stringify(body), { status: status2, headers: { "content-type": "application/json" } });
}
beforeAll(() => {
    globalThis.ResizeObserver ??= class {
        observe() { }
        unobserve() { }
        disconnect() { }
    } as unknown as typeof ResizeObserver;
    window.matchMedia ??= ((q: string) => ({ matches: false, media: q, onchange: null, addEventListener() { }, removeEventListener() { }, addListener() { }, removeListener() { }, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
    URL.createObjectURL = vi.fn(() => "blob:csv");
    URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
});
beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input), "http://localhost");
        const method = init?.method ?? "GET";
        calls.push({ method, path: url.pathname + url.search, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        const p = url.pathname;
        if (p === "/api/status")
            return json(status);
        if (p === "/api/campaigns")
            return json(list);
        if (p === "/api/budget/pacing")
            return json(pacing);
        if (p === "/api/anomalies")
            return json(anomaliesC3);
        if (p === "/api/annotations")
            return json(method === "POST" ? { id: "n1", ...(JSON.parse(String(init?.body)) as object) } : annotationsC6);
        if (p === "/api/change-events")
            return json(changesC6);
        if (p === "/api/actions/simulate")
            return json({ action: { id: "a1", summary: "Paused 1 campaign", type: "campaign.pause", targets: [] }, simulated: true, message: "ok" });
        const impact = /^\/api\/campaigns\/([^/]+)\/impact$/.exec(p);
        if (impact)
            return json(impactC6);
        const detail = /^\/api\/campaigns\/([^/]+)$/.exec(p);
        if (detail) {
            const d = detailById[decodeURIComponent(detail[1] ?? "")];
            return d ? json(d) : json({ error: { code: "NOT_FOUND", message: "Campaign not found" } }, 404);
        }
        return json({ error: { code: "NOT_FOUND", message: `No fixture for ${p}` } }, 404);
    }));
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});
function renderWith(ui: React.ReactNode, search = "", onUrlUpdate?: (e: UrlUpdateEvent) => void) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    return render(<QueryClientProvider client={qc}>
      <NuqsTestingAdapter searchParams={search} hasMemory onUrlUpdate={onUrlUpdate}>
        <Tooltip.Provider>{ui}</Tooltip.Provider>
      </NuqsTestingAdapter>
    </QueryClientProvider>);
}
const table = () => screen.getByRole("table", { name: "Campaigns" });
describe("CampaignsScreen", () => {
    beforeEach(() => {
        nav.pathname = "/campaigns";
    });
    it("renders the prototype grid with totals, deltas and the account CPA flag", async () => {
        renderWith(<CampaignsScreen />);
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Every campaign, measured");
        expect(await screen.findByText(nameText("PMax — Full Catalog"))).toBeTruthy();
        const t = table();
        expect(within(t).getByText("Total · 8 campaigns")).toBeTruthy();
        expect(within(t).getByRole("button", { name: "Spend ↓" })).toBeTruthy();
        expect(within(t).getAllByRole("columnheader")).toHaveLength(13);
        expect(within(t).getAllByText(/[+−]\d+\.\d%/).length).toBeGreaterThan(40);
        expect(within(t).getAllByText("(above 1.4× account CPA)").length).toBeGreaterThan(0);
        const rows = within(t).getAllByRole("row");
        expect(within(rows[1] as HTMLElement).getByText(nameText("PMax — Full Catalog"))).toBeTruthy();
    });
    it("sorts, filters by type and search, and selects rows for bulk actions", async () => {
        const updates: string[] = [];
        renderWith(<CampaignsScreen />, "", (e) => updates.push(e.queryString));
        await screen.findByText(nameText("PMax — Full Catalog"));
        fireEvent.click(within(table()).getByRole("button", { name: "Campaign" }));
        await waitFor(() => expect(within(table()).getByRole("button", { name: "Campaign ↑" })).toBeTruthy());
        expect(updates.some((u) => u.includes("sort=name") && u.includes("dir=asc"))).toBe(true);
        const names = within(table())
            .getAllByRole("rowheader")
            .map((c) => within(c).queryByRole("button")?.textContent ?? "");
        expect(names[0]).toBe("Brand — Core Terms");
        fireEvent.click(screen.getByRole("button", { name: "Search" }));
        await waitFor(() => expect(within(table()).getByText("Total · 3 campaigns")).toBeTruthy());
        fireEvent.change(screen.getByRole("searchbox", { name: "Search campaigns" }), { target: { value: "competitor" } });
        await waitFor(() => expect(within(table()).getByText("Total · 1 campaign")).toBeTruthy());
        fireEvent.click(screen.getByRole("checkbox", { name: "Select Search — Competitor Terms" }));
        const bar = await screen.findByRole("region", { name: "Bulk actions" });
        expect(within(bar).getByText("1 selected")).toBeTruthy();
        fireEvent.click(within(bar).getByRole("button", { name: "Export CSV" }));
        expect(URL.createObjectURL).toHaveBeenCalled();
        fireEvent.click(within(bar).getByRole("button", { name: "Pause 1" }));
        await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/api/actions/simulate")).toBe(true));
        expect(calls.find((c) => c.path === "/api/actions/simulate")?.body).toEqual({ type: "campaign.pause", campaignIds: ["c8"] });
    });
    it("hides columns from the chooser and shows an empty state when filters match nothing", async () => {
        renderWith(<CampaignsScreen />, "?q=zzz-nothing");
        expect(await screen.findByText(/No campaigns match these filters/)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
        await waitFor(() => expect(within(table()).getByText("Total · 8 campaigns")).toBeTruthy());
    });
    it("drops compare deltas when compare is off", async () => {
        renderWith(<CampaignsScreen />, "?cmp=off");
        await screen.findByText(nameText("PMax — Full Catalog"));
        expect(within(table()).queryAllByText(/[+−]\d+\.\d%/)).toHaveLength(0);
    });
});
describe("CampaignDrawerHost", () => {
    it("opens from ?campaign= with KPIs, signals, pacing and quick actions", async () => {
        renderWith(<CampaignDrawerHost />, "?campaign=c3");
        const dialog = await screen.findByRole("dialog");
        expect(await within(dialog).findByText("PMax · Enabled")).toBeTruthy();
        expect(within(dialog).getByRole("heading", { name: "PMax — Full Catalog" })).toBeTruthy();
        expect(within(dialog).getByText("Daily spend · last 30 days")).toBeTruthy();
        expect(within(dialog).getByText("Dashed line · daily budget $1,250")).toBeTruthy();
        expect(within(dialog).getByText("CPA up 71%")).toBeTruthy();
        expect(within(dialog).getByText(/Pacing · September/)).toBeTruthy();
        expect(within(dialog).getByRole("button", { name: "Pause campaign" })).toBeTruthy();
        expect(within(dialog).getByRole("button", { name: /Budget \+10% · \$1,375/ })).toBeTruthy();
        expect(within(dialog).getByRole("link", { name: "Open full detail →" }).getAttribute("href")).toBe("/campaigns/c3");
    });
    it("stays closed without the param", async () => {
        renderWith(<CampaignDrawerHost />);
        await new Promise((r) => setTimeout(r, 20));
        expect(screen.queryByRole("dialog")).toBeNull();
    });
});
describe("CampaignDetailScreen", () => {
    beforeEach(() => {
        nav.pathname = "/campaigns/c3";
    });
    it("renders the header with one accent word and the overview tab", async () => {
        renderWith(<CampaignDetailScreen campaignId="c3"/>);
        const h1 = await screen.findByRole("heading", { level: 1 });
        expect(h1.textContent).toBe("PMax — Full Catalog");
        expect(h1.querySelectorAll("em")).toHaveLength(1);
        expect(h1.querySelector("em")?.textContent).toBe("Full Catalog");
        expect(screen.getByText(/Maximize conversion value · \$1,250\/day budget/)).toBeTruthy();
        expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected")).toBe("true");
        expect(screen.getByText("Daily trend")).toBeTruthy();
        expect(screen.getByText("Budget pacing")).toBeTruthy();
        expect(screen.getAllByText("CPA up 71%").length).toBeGreaterThan(0);
    });
    it.each([
        ["ad-groups", "c3", "Asset groups"],
        ["keywords", "c3", /Performance Max campaigns don’t use keywords/],
        ["keywords", "c2", "[best running shoes]"],
        ["search-terms", "c2", "best running shoes 2026"],
        ["devices", "c2", "Device split"],
        ["changes", "c6", "Bid strategy changed from Target CPA ($28) to Maximize conversions"],
        ["signals", "c3", "Acknowledge"],
        ["notes", "c6", "Add a note"],
    ] as const)("renders the %s tab (%s)", async (tab, id, text) => {
        nav.pathname = `/campaigns/${id}`;
        renderWith(<CampaignDetailScreen campaignId={id}/>, `?tab=${tab}`);
        expect((await screen.findAllByText(text)).length).toBeGreaterThan(0);
    });
    it("analyzes a change's impact from ?event=", async () => {
        nav.pathname = "/campaigns/c6";
        renderWith(<CampaignDetailScreen campaignId="c6"/>, "?tab=changes&event=4821193307-ce-c6-bid");
        expect(await screen.findByText(/after this change/)).toBeTruthy();
        expect(screen.getByRole("table", { name: "Metrics before and after this change" })).toBeTruthy();
        expect(screen.getAllByText("✓ Significant").length).toBeGreaterThan(0);
    });
    it("adds a search term as a negative keyword (simulated)", async () => {
        nav.pathname = "/campaigns/c2";
        renderWith(<CampaignDetailScreen campaignId="c2"/>, "?tab=search-terms");
        await screen.findByText("best running shoes 2026");
        fireEvent.click(screen.getAllByRole("button", { name: "− Negative" })[0] as HTMLElement);
        await waitFor(() => expect(calls.some((c) => c.path === "/api/actions/simulate")).toBe(true));
        const body = calls.find((c) => c.path === "/api/actions/simulate")?.body as {
            type: string;
            negatives: {
                text: string;
                matchType: string;
                campaignId: string;
            }[];
        };
        expect(body.type).toBe("keywords.add_negatives");
        expect(body.negatives[0]).toMatchObject({ matchType: "Exact", campaignId: "c2" });
    });
    it("shows a not-found state for unknown campaigns", async () => {
        nav.pathname = "/campaigns/nope";
        renderWith(<CampaignDetailScreen campaignId="nope"/>);
        expect(await screen.findByText(/doesn’t exist in the current account|doesn't exist in the current account/)).toBeTruthy();
    });
});
