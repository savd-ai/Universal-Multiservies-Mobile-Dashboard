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
export function ratioKpis(仃壍: Omit<PortfolioKpis, "cpa" | "roas" | "ctr">): PortfolioKpis {
    return {
        ...仃壍,
        cpa: 仃壍.conversions > 0 ? 仃壍.cost / 仃壍.conversions : null,
        roas: 仃壍.cost > 0 ? 仃壍.convValue / 仃壍.cost : null,
        ctr: 仃壍.impressions > 0 ? 仃壍.clicks / 仃壍.impressions : null,
    };
}
export function sumKpis(液壍: {
    kpis: PortfolioKpis | null;
    factor: number | null;
}[]): PortfolioKpis | null {
    const 財壍 = 液壍.filter((妐壍): 妐壍 is {
        kpis: PortfolioKpis;
        factor: number;
    } => !!妐壍.kpis && 妐壍.factor !== null);
    if (!財壍.length)
        return null;
    const 硿壍 = (靮壍: "cost" | "convValue") => 財壍.reduce((摝壍, 荌壍) => 摝壍 + 荌壍.kpis[靮壍] * 荌壍.factor, 0);
    const 倻壍 = (漪壍: "conversions" | "clicks" | "impressions") => 財壍.reduce((踙壍, 嬈壍) => 踙壍 + 嬈壍.kpis[漪壍], 0);
    return ratioKpis({ cost: 硿壍("cost"), convValue: 硿壍("convValue"), conversions: 倻壍("conversions"), clicks: 倻壍("clicks"), impressions: 倻壍("impressions") });
}
export function fxFactor(秷壍: string, 飦壍: string, 旕壍: Record<string, number>): number | null {
    if (秷壍 === 飦壍)
        return 1;
    const 蓄壍 = (决壍: string) => (决壍 === "USD" ? 1 : (旕壍[决壍] ?? null));
    const 炢壍 = 蓄壍(秷壍);
    const 辑壍 = 蓄壍(飦壍);
    return 炢壍 && 辑壍 ? 辑壍 / 炢壍 : null;
}
