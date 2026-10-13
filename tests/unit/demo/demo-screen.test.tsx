/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { DemoDataset } from "@/lib/domain/contracts/demo";
import { DemoScreen } from "@/features/demo/demo-screen";
import { campaignSummaries, summarize } from "@/features/demo/demo-model";
vi.mock("next/navigation", () => ({
    usePathname: () => "/demo",
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: {
        href: string;
        children: React.ReactNode;
    }) => <a href={href} {...rest}>{children}</a> }));
const DATASET: DemoDataset = {
    account: { id: "1234567890", name: "Test Outfitters", currency: "USD", timezone: "UTC" },
    campaigns: [
        { id: "k1", name: "Search — Test Brand", type: "Search", status: "Enabled", bidding_strategy: "MANUAL_CPC", budget_daily: 50 },
        { id: "k2", name: "PMax — Test Catalog", type: "PMax", status: "Enabled", bidding_strategy: "MAXIMIZE_CONVERSION_VALUE", budget_daily: 120 },
    ],
    daily: [
        { date: "2026-10-10", campaign_id: "k1", impressions: 1000, clicks: 100, cost: 40, conversions: 4, conv_value: 200 },
        { date: "2026-10-10", campaign_id: "k2", impressions: 5000, clicks: 80, cost: 100, conversions: 5, conv_value: 500 },
        { date: "2026-10-11", campaign_id: "k1", impressions: 1000, clicks: 100, cost: 60, conversions: 6, conv_value: 300 },
        { date: "2026-10-11", campaign_id: "k2", impressions: 5000, clicks: 70, cost: 100, conversions: 0, conv_value: 0 },
    ],
};
const OTHER: DemoDataset = { ...DATASET, account: { ...DATASET.account, id: "222", name: "Other Outfitters" } };
const requested: string[] = [];
beforeAll(() => {
    globalThis.ResizeObserver = class {
        observe() { }
        unobserve() { }
        disconnect() { }
    } as unknown as typeof ResizeObserver;
    window.matchMedia = ((media: string) => ({ matches: false, media, onchange: null, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { }, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
        if (url.startsWith("/api/demo")) {
            requested.push(url);
            const dataset = url.includes("account=222") ? OTHER : DATASET;
            return new Response(JSON.stringify({ accounts: [{ id: "1234567890", name: "Test Outfitters" }, { id: "222", name: "Other Outfitters" }], dataset }), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
    }));
});
afterEach(() => {
    cleanup();
    requested.length = 0;
});
function mount() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}><DemoScreen /></QueryClientProvider>);
}
describe("demo screen", () => {
    it("opens the demo dashboard straight away, with no puzzle", async () => {
        mount();
        expect((await screen.findAllByText("Test Outfitters")).length).toBeGreaterThan(0);
        await waitFor(() => expect(screen.getByText("Search — Test Brand")).toBeTruthy());
        expect(screen.getByText("PMax — Test Catalog")).toBeTruthy();
        expect(screen.getByText("$300")).toBeTruthy();
        expect(screen.queryByText(/Puzzle/)).toBeNull();
        expect(requested).toEqual(["/api/demo"]);
    });
    it("switches demo account", async () => {
        mount();
        fireEvent.click(await screen.findByRole("radio", { name: "Other Outfitters" }));
        await waitFor(() => expect(requested).toContain("/api/demo?account=222"));
    });
    it("computes ratios of sums", () => {
        const totals = summarize(DATASET.daily);
        expect(totals).toMatchObject({ cost: 300, clicks: 350, conversions: 15, conv_value: 1000 });
        expect(totals.cpa).toBeCloseTo(20, 9);
        expect(totals.roas).toBeCloseTo(1000 / 300, 9);
        const [brand, pmax] = campaignSummaries(DATASET);
        expect(brand).toMatchObject({ cost: 100, cpa: 10, roas: 5 });
        expect(pmax!.cpa).toBe(40);
        expect(summarize([]).cpa).toBeNull();
    });
});
