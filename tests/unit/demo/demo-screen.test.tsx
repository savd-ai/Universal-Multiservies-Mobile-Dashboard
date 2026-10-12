/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { DemoDataset, DemoLockStatus } from "@/lib/domain/contracts/demo";
import { LOYD_BOARD } from "@/lib/domain/demo/puzzle";
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
const STATUS: DemoLockStatus = {
    available: true,
    note: null,
    format: "savd.demo-seal.v1",
    cipher: "aes-256-gcm",
    keySha256: "ab".repeat(32),
    sealedAt: "2026-10-12T08:58:05.647Z",
    tables: [
        { name: "demo_account", columns: ["id", "name", "currency", "timezone"], rows: 1 },
        { name: "demo_campaign", columns: ["id", "name", "type", "status", "bidding_strategy", "budget_daily"], rows: 2 },
        { name: "demo_campaign_daily", columns: ["date", "campaign_id", "impressions", "clicks", "cost", "conversions", "conv_value"], rows: 4 },
    ],
    challenge: { token: "test-token", board: [...LOYD_BOARD], expiresAt: "2026-10-12T09:30:00.000Z" },
};
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
let unlockResponse: {
    status: number;
    body: unknown;
} = { status: 403, body: {} };
const unlockBodies: unknown[] = [];
beforeAll(() => {
    globalThis.ResizeObserver = class {
        observe() { }
        unobserve() { }
        disconnect() { }
    } as unknown as typeof ResizeObserver;
    window.matchMedia = ((media: string) => ({ matches: false, media, onchange: null, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { }, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("/api/demo/unlock")) {
            unlockBodies.push(JSON.parse(String(init?.body)));
            return new Response(JSON.stringify(unlockResponse.body), { status: unlockResponse.status });
        }
        if (url.startsWith("/api/demo"))
            return new Response(JSON.stringify(STATUS), { status: 200 });
        return new Response(JSON.stringify({}), { status: 200 });
    }));
});
afterEach(() => {
    cleanup();
    unlockBodies.length = 0;
});
function mount() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}><DemoScreen /></QueryClientProvider>);
}
describe("demo screen", () => {
    it("shows both puzzles and the sealed tables, and sends the moves and key to the server", async () => {
        unlockResponse = { status: 403, body: { error: { code: "FORBIDDEN", message: "locked", details: { reason: "demo_locked", puzzle: "unsolved", key: "malformed", moves: 1 } } } };
        mount();
        expect(await screen.findByText("Puzzle 1 · Slide the tiles")).toBeTruthy();
        expect(screen.getByText("ab".repeat(32))).toBeTruthy();
        expect(screen.getByText("demo_campaign_daily")).toBeTruthy();
        expect(screen.getByText("Not in order")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Tile 12, slide into the gap" }));
        expect(screen.getByText("1 move")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: /Open dashboard/ }));
        expect(await screen.findByText("Puzzle 1 · the tiles aren't in order yet.")).toBeTruthy();
        expect(screen.getByText("Puzzle 2 · the key is 64 hex characters (0–9, a–f).")).toBeTruthy();
        expect(unlockBodies).toEqual([{ token: "test-token", moves: [12], key: "" }]);
        expect(screen.queryByText("Test Outfitters")).toBeNull();
    });
    it("renders the dashboard only from what the server returns after unlocking", async () => {
        unlockResponse = { status: 200, body: DATASET };
        mount();
        fireEvent.click(await screen.findByRole("button", { name: /Open dashboard/ }));
        expect(await screen.findByText("Test Outfitters")).toBeTruthy();
        await waitFor(() => expect(screen.getByText("Search — Test Brand")).toBeTruthy());
        expect(screen.getByText("PMax — Test Catalog")).toBeTruthy();
        expect(screen.getByText("$300")).toBeTruthy();
        expect(screen.queryByText("Puzzle 1 · Slide the tiles")).toBeNull();
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
