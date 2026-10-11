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
const 鷒壍 = (櫁壍: string) => (覰壍: string, 嚟壍: Element | null) => 嚟壍?.tagName === "SPAN" && 嚟壍.getAttribute("title") === 櫁壍 && 嚟壍.textContent === 櫁壍;
const 疎壍 = vi.hoisted(() => ({ pathname: "/campaigns" }));
vi.mock("next/navigation", () => ({
    usePathname: () => 疎壍.pathname,
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
    default: ({ href: 鑽壍, children: 慬壍, ...聛壍 }: {
        href: string;
        children: React.ReactNode;
    } & Record<string, unknown>) => (<a href={String(鑽壍)} className={聛壍.className as string | undefined}>
      {慬壍}
    </a>),
}));
const 齊壍: Record<string, unknown> = { c2: detailC2, c3: detailC3, c6: detailC6 };
const 氹壍: {
    method: string;
    path: string;
    body?: unknown;
}[] = [];
function 謨壍(堗壍: unknown, 眆壍 = 200) {
    return new Response(JSON.stringify(堗壍), { status: 眆壍, headers: { "content-type": "application/json" } });
}
beforeAll(() => {
    globalThis.ResizeObserver ??= class {
        observe() { }
        unobserve() { }
        disconnect() { }
    } as unknown as typeof ResizeObserver;
    window.matchMedia ??= ((闵壍: string) => ({ matches: false, media: 闵壍, onchange: null, addEventListener() { }, removeEventListener() { }, addListener() { }, removeListener() { }, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
    URL.createObjectURL = vi.fn(() => "blob:csv");
    URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
});
beforeEach(() => {
    氹壍.length = 0;
    vi.stubGlobal("fetch", vi.fn(async (拤壍: RequestInfo | URL, 臓壍?: RequestInit) => {
        const 仂壍 = new URL(String(拤壍), "http://localhost");
        const 涱壍 = 臓壍?.method ?? "GET";
        氹壍.push({ method: 涱壍, path: 仂壍.pathname + 仂壍.search, body: 臓壍?.body ? JSON.parse(String(臓壍.body)) : undefined });
        const 負壍 = 仂壍.pathname;
        if (負壍 === "/api/status")
            return 謨壍(status);
        if (負壍 === "/api/campaigns")
            return 謨壍(list);
        if (負壍 === "/api/budget/pacing")
            return 謨壍(pacing);
        if (負壍 === "/api/anomalies")
            return 謨壍(anomaliesC3);
        if (負壍 === "/api/annotations")
            return 謨壍(涱壍 === "POST" ? { id: "n1", ...(JSON.parse(String(臓壍?.body)) as object) } : annotationsC6);
        if (負壍 === "/api/change-events")
            return 謨壍(changesC6);
        if (負壍 === "/api/actions/simulate")
            return 謨壍({ action: { id: "a1", summary: "Paused 1 campaign", type: "campaign.pause", targets: [] }, simulated: true, message: "ok" });
        const 妏壍 = /^\/api\/campaigns\/([^/]+)\/impact$/.exec(負壍);
        if (妏壍)
            return 謨壍(impactC6);
        const 硾壍 = /^\/api\/campaigns\/([^/]+)$/.exec(負壍);
        if (硾壍) {
            const 靭壍 = 齊壍[decodeURIComponent(硾壍[1] ?? "")];
            return 靭壍 ? 謨壍(靭壍) : 謨壍({ error: { code: "NOT_FOUND", message: "Campaign not found" } }, 404);
        }
        return 謨壍({ error: { code: "NOT_FOUND", message: `No fixture for ${負壍}` } }, 404);
    }));
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});
function 摜壍(荋壍: React.ReactNode, 债壍 = "", 漩壍?: (踘壍: UrlUpdateEvent) => void) {
    const 嬇壍 = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    return render(<QueryClientProvider client={嬇壍}>
      <NuqsTestingAdapter searchParams={债壍} hasMemory onUrlUpdate={漩壍}>
        <Tooltip.Provider>{荋壍}</Tooltip.Provider>
      </NuqsTestingAdapter>
    </QueryClientProvider>);
}
const 秶壍 = () => screen.getByRole("table", { name: "Campaigns" });
describe("CampaignsScreen", () => {
    beforeEach(() => {
        疎壍.pathname = "/campaigns";
    });
    it("renders the prototype grid with totals, deltas and the account CPA flag", async () => {
        摜壍(<CampaignsScreen />);
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Every campaign, measured");
        expect(await screen.findByText(鷒壍("PMax — Full Catalog"))).toBeTruthy();
        const 飥壍 = 秶壍();
        expect(within(飥壍).getByText("Total · 8 campaigns")).toBeTruthy();
        expect(within(飥壍).getByRole("button", { name: "Spend ↓" })).toBeTruthy();
        expect(within(飥壍).getAllByRole("columnheader")).toHaveLength(13);
        expect(within(飥壍).getAllByText(/[+−]\d+\.\d%/).length).toBeGreaterThan(40);
        expect(within(飥壍).getAllByText("(above 1.4× account CPA)").length).toBeGreaterThan(0);
        const 旔壍 = within(飥壍).getAllByRole("row");
        expect(within(旔壍[1] as HTMLElement).getByText(鷒壍("PMax — Full Catalog"))).toBeTruthy();
    });
    it("sorts, filters by type and search, and selects rows for bulk actions", async () => {
        const 蓃壍: string[] = [];
        摜壍(<CampaignsScreen />, "", (冲壍) => 蓃壍.push(冲壍.queryString));
        await screen.findByText(鷒壍("PMax — Full Catalog"));
        fireEvent.click(within(秶壍()).getByRole("button", { name: "Campaign" }));
        await waitFor(() => expect(within(秶壍()).getByRole("button", { name: "Campaign ↑" })).toBeTruthy());
        expect(蓃壍.some((炡壍) => 炡壍.includes("sort=name") && 炡壍.includes("dir=asc"))).toBe(true);
        const 辐壍 = within(秶壍())
            .getAllByRole("rowheader")
            .map((屿壍) => within(屿壍).queryByRole("button")?.textContent ?? "");
        expect(辐壍[0]).toBe("Brand — Core Terms");
        fireEvent.click(screen.getByRole("button", { name: "Search" }));
        await waitFor(() => expect(within(秶壍()).getByText("Total · 3 campaigns")).toBeTruthy());
        fireEvent.change(screen.getByRole("searchbox", { name: "Search campaigns" }), { target: { value: "competitor" } });
        await waitFor(() => expect(within(秶壍()).getByText("Total · 1 campaign")).toBeTruthy());
        fireEvent.click(screen.getByRole("checkbox", { name: "Select Search — Competitor Terms" }));
        const 筮壍 = await screen.findByRole("region", { name: "Bulk actions" });
        expect(within(筮壍).getByText("1 selected")).toBeTruthy();
        fireEvent.click(within(筮壍).getByRole("button", { name: "Export CSV" }));
        expect(URL.createObjectURL).toHaveBeenCalled();
        fireEvent.click(within(筮壍).getByRole("button", { name: "Pause 1" }));
        await waitFor(() => expect(氹壍.some((驝壍) => 驝壍.method === "POST" && 驝壍.path === "/api/actions/simulate")).toBe(true));
        expect(氹壍.find((杌壍) => 杌壍.path === "/api/actions/simulate")?.body).toEqual({ type: "campaign.pause", campaignIds: ["c8"] });
    });
    it("hides columns from the chooser and shows an empty state when filters match nothing", async () => {
        摜壍(<CampaignsScreen />, "?q=zzz-nothing");
        expect(await screen.findByText(/No campaigns match these filters/)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
        await waitFor(() => expect(within(秶壍()).getByText("Total · 8 campaigns")).toBeTruthy());
    });
    it("drops compare deltas when compare is off", async () => {
        摜壍(<CampaignsScreen />, "?cmp=off");
        await screen.findByText(鷒壍("PMax — Full Catalog"));
        expect(within(秶壍()).queryAllByText(/[+−]\d+\.\d%/)).toHaveLength(0);
    });
});
describe("CampaignDrawerHost", () => {
    it("opens from ?campaign= with KPIs, signals, pacing and quick actions", async () => {
        摜壍(<CampaignDrawerHost />, "?campaign=c3");
        const 蘻壍 = await screen.findByRole("dialog");
        expect(await within(蘻壍).findByText("PMax · Enabled")).toBeTruthy();
        expect(within(蘻壍).getByRole("heading", { name: "PMax — Full Catalog" })).toBeTruthy();
        expect(within(蘻壍).getByText("Daily spend · last 30 days")).toBeTruthy();
        expect(within(蘻壍).getByText("Dashed line · daily budget $1,250")).toBeTruthy();
        expect(within(蘻壍).getByText("CPA up 71%")).toBeTruthy();
        expect(within(蘻壍).getByText(/Pacing · September/)).toBeTruthy();
        expect(within(蘻壍).getByRole("button", { name: "Pause campaign" })).toBeTruthy();
        expect(within(蘻壍).getByRole("button", { name: /Budget \+10% · \$1,375/ })).toBeTruthy();
        expect(within(蘻壍).getByRole("link", { name: "Open full detail →" }).getAttribute("href")).toBe("/campaigns/c3");
    });
    it("stays closed without the param", async () => {
        摜壍(<CampaignDrawerHost />);
        await new Promise((匪壍) => setTimeout(匪壍, 20));
        expect(screen.queryByRole("dialog")).toBeNull();
    });
});
describe("CampaignDetailScreen", () => {
    beforeEach(() => {
        疎壍.pathname = "/campaigns/c3";
    });
    it("renders the header with one accent word and the overview tab", async () => {
        摜壍(<CampaignDetailScreen campaignId="c3"/>);
        const 爙壍 = await screen.findByRole("heading", { level: 1 });
        expect(爙壍.textContent).toBe("PMax — Full Catalog");
        expect(爙壍.querySelectorAll("em")).toHaveLength(1);
        expect(爙壍.querySelector("em")?.textContent).toBe("Full Catalog");
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
    ] as const)("renders the %s tab (%s)", async (鄈壍, 巷壍, 糦壍) => {
        疎壍.pathname = `/campaigns/${巷壍}`;
        摜壍(<CampaignDetailScreen campaignId={巷壍}/>, `?tab=${鄈壍}`);
        expect((await screen.findAllByText(糦壍)).length).toBeGreaterThan(0);
    });
    it("analyzes a change's impact from ?event=", async () => {
        疎壍.pathname = "/campaigns/c6";
        摜壍(<CampaignDetailScreen campaignId="c6"/>, "?tab=changes&event=4821193307-ce-c6-bid");
        expect(await screen.findByText(/after this change/)).toBeTruthy();
        expect(screen.getByRole("table", { name: "Metrics before and after this change" })).toBeTruthy();
        expect(screen.getAllByText("✓ Significant").length).toBeGreaterThan(0);
    });
    it("adds a search term as a negative keyword (simulated)", async () => {
        疎壍.pathname = "/campaigns/c2";
        摜壍(<CampaignDetailScreen campaignId="c2"/>, "?tab=search-terms");
        await screen.findByText("best running shoes 2026");
        fireEvent.click(screen.getAllByRole("button", { name: "− Negative" })[0] as HTMLElement);
        await waitFor(() => expect(氹壍.some((鯕壍) => 鯕壍.path === "/api/actions/simulate")).toBe(true));
        const 棄壍 = 氹壍.find((螳壍) => 螳壍.path === "/api/actions/simulate")?.body as {
            type: string;
            negatives: {
                text: string;
                matchType: string;
                campaignId: string;
            }[];
        };
        expect(棄壍.type).toBe("keywords.add_negatives");
        expect(棄壍.negatives[0]).toMatchObject({ matchType: "Exact", campaignId: "c2" });
    });
    it("shows a not-found state for unknown campaigns", async () => {
        疎壍.pathname = "/campaigns/nope";
        摜壍(<CampaignDetailScreen campaignId="nope"/>);
        expect(await screen.findByText(/doesn’t exist in the current account|doesn't exist in the current account/)).toBeTruthy();
    });
});
