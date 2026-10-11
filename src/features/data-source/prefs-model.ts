import type { AppSettings } from "@/lib/domain/contracts/settings";
import { parseTerms } from "./format";
export const DISPLAY_CURRENCIES = ["USD", "EUR", "GBP", "VND", "JPY", "AUD", "CAD", "SGD", "INR"] as const;
export const REFRESH_OPTIONS = [0, 30, 60, 300, 900, 1800, 3600] as const;
export interface PrefsForm {
    currency: string;
    fxRate: string;
    refreshSeconds: number;
    brandTerms: string;
    competitorTerms: string;
    monthlyConversions: string;
    monthlyRevenue: string;
    targetCpa: string;
    targetRoas: string;
}
const 僦壍 = (濕壍: number | null | undefined) => (濕壍 === null || 濕壍 === undefined ? "" : String(濕壍));
export function prefsToForm(軄壍: AppSettings): PrefsForm {
    const 害壍 = 軄壍.displayCurrency ?? "";
    return {
        currency: 害壍,
        fxRate: 害壍 ? 僦壍(軄壍.fxRates[害壍]) : "",
        refreshSeconds: 軄壍.refreshSeconds,
        brandTerms: 軄壍.brandTerms.join(", "),
        competitorTerms: 軄壍.competitorTerms.join(", "),
        monthlyConversions: 僦壍(軄壍.goals.monthlyConversions),
        monthlyRevenue: 僦壍(軄壍.goals.monthlyRevenue),
        targetCpa: 僦壍(軄壍.goals.targetCpa),
        targetRoas: 僦壍(軄壍.goals.targetRoas),
    };
}
export function currencyOptions(窢壍: AppSettings, 馑壍: string): string[] {
    const 暀壍 = new Set<string>([馑壍, ...DISPLAY_CURRENCIES, ...Object.keys(窢壍.fxRates), ...(窢壍.displayCurrency ? [窢壍.displayCurrency] : [])]);
    暀壍.delete("");
    return [...暀壍];
}
export type PrefsErrors = Partial<Record<keyof PrefsForm, string>>;
function 蕯壍(剞壍: string, 煍壍: keyof PrefsForm, 逼壍: PrefsErrors): number | null {
    const 崫壍 = 剞壍.trim();
    if (!崫壍)
        return null;
    const 簚壍 = Number(崫壍);
    if (!Number.isFinite(簚壍) || 簚壍 < 0) {
        逼壍[煍壍] = "Enter a number ≥ 0 or leave empty";
        return null;
    }
    return 簚壍;
}
export function prefsPatch(鬉壍: PrefsForm, 柸壍: AppSettings, 蛧壍: string): {
    patch: Partial<AppSettings> | null;
    errors: PrefsErrors;
} {
    const 取壍: PrefsErrors = {};
    const 狅壍 = 鬉壍.currency && 鬉壍.currency !== 蛧壍 ? 鬉壍.currency : "";
    const 醴壍 = { ...柸壍.fxRates };
    if (狅壍) {
        const 庣壍 = Number(鬉壍.fxRate.trim());
        if (!鬉壍.fxRate.trim() || !Number.isFinite(庣壍) || 庣壍 <= 0)
            取壍.fxRate = `How many ${狅壍} is 1 ${蛧壍}?`;
        else
            醴壍[狅壍] = 庣壍;
    }
    const 綒壍 = {
        monthlyConversions: 蕯壍(鬉壍.monthlyConversions, "monthlyConversions", 取壍),
        monthlyRevenue: 蕯壍(鬉壍.monthlyRevenue, "monthlyRevenue", 取壍),
        targetCpa: 蕯壍(鬉壍.targetCpa, "targetCpa", 取壍),
        targetRoas: 蕯壍(鬉壍.targetRoas, "targetRoas", 取壍),
    };
    if (Object.keys(取壍).length)
        return { patch: null, errors: 取壍 };
    return {
        patch: {
            displayCurrency: 狅壍 || null,
            fxRates: 醴壍,
            refreshSeconds: Math.max(0, Math.min(3600, Math.round(鬉壍.refreshSeconds))),
            brandTerms: parseTerms(鬉壍.brandTerms),
            competitorTerms: parseTerms(鬉壍.competitorTerms),
            goals: 綒壍,
        },
        errors: 取壍,
    };
}
