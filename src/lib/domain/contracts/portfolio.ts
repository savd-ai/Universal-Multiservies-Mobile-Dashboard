import { z } from "zod";
export const PORTFOLIO_RANGES = ["last_7d", "last_30d", "last_90d", "mtd", "last_month", "qtd", "ytd"] as const;
export const portfolioQuerySchema = z.object({
    range: z.enum(PORTFOLIO_RANGES).default("last_30d"),
    compare: z.enum(["previous_period", "previous_year", "none"]).default("previous_period"),
});
export type PortfolioQuery = z.infer<typeof portfolioQuerySchema>;
export interface PortfolioKpis {
    cost: number;
    conversions: number;
    convValue: number;
    clicks: number;
    impressions: number;
    cpa: number | null;
    roas: number | null;
    ctr: number | null;
}
export interface PortfolioAccountRow {
    accountId: string;
    name: string;
    currency: string;
    clientId: string | null;
    clientName: string | null;
    mode: "live" | "blank";
    kpis: PortfolioKpis | null;
    previous: PortfolioKpis | null;
    pacing: {
        monthLabel: string;
        projected: number;
        target: number;
        ratio: number | null;
        overpacing: number;
    } | null;
    signals: {
        critical: number;
        warning: number;
        opportunity: number;
    };
    dataThrough: string | null;
    error: string | null;
}
export interface PortfolioGroup {
    clientId: string | null;
    name: string;
    accountIds: string[];
    totals: PortfolioKpis | null;
    previous: PortfolioKpis | null;
    signals: {
        critical: number;
        warning: number;
        opportunity: number;
    };
}
export interface PortfolioResponse {
    range: {
        start: string;
        end: string;
    } | null;
    compareRange: {
        start: string;
        end: string;
    } | null;
    displayCurrency: string;
    accounts: PortfolioAccountRow[];
    groups: PortfolioGroup[];
    totals: PortfolioKpis | null;
    previous: PortfolioKpis | null;
    excludedFromTotals: string[];
    warnings: string[];
}
export function ratioKpis(k: Omit<PortfolioKpis, "cpa" | "roas" | "ctr">): PortfolioKpis {
    return {
        ...k,
        cpa: k.conversions > 0 ? k.cost / k.conversions : null,
        roas: k.cost > 0 ? k.convValue / k.cost : null,
        ctr: k.impressions > 0 ? k.clicks / k.impressions : null,
    };
}
export function sumKpis(parts: {
    kpis: PortfolioKpis | null;
    factor: number | null;
}[]): PortfolioKpis | null {
    const usable = parts.filter((p): p is {
        kpis: PortfolioKpis;
        factor: number;
    } => !!p.kpis && p.factor !== null);
    if (!usable.length)
        return null;
    const add = (key: "cost" | "convValue") => usable.reduce((s, p) => s + p.kpis[key] * p.factor, 0);
    const count = (key: "conversions" | "clicks" | "impressions") => usable.reduce((s, p) => s + p.kpis[key], 0);
    return ratioKpis({ cost: add("cost"), convValue: add("convValue"), conversions: count("conversions"), clicks: count("clicks"), impressions: count("impressions") });
}
export function fxFactor(text: string, to: string, rates: Record<string, number>): number | null {
    if (text === to)
        return 1;
    const rate = (c: string) => (c === "USD" ? 1 : (rates[c] ?? null));
    const a = rate(text);
    const b = rate(to);
    return a && b ? b / a : null;
}
