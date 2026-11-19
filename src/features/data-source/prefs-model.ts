import type { AppSettings } from "@/lib/domain/contracts/settings";
import { parseTerms } from "./format";

// Display preferences form ↔ PUT /api/settings patch. Pure.

export const DISPLAY_CURRENCIES = ["USD", "EUR", "GBP", "VND", "JPY", "AUD", "CAD", "SGD", "INR"] as const;
export const REFRESH_OPTIONS = [0, 30, 60, 300, 900, 1800, 3600] as const;

export interface PrefsForm {
  /** "" = the account currency */
  currency: string;
  /** conversion factor from the account currency into `currency` */
  fxRate: string;
  refreshSeconds: number;
  businessContext: string;
  brandTerms: string;
  competitorTerms: string;
  monthlyConversions: string;
  monthlyRevenue: string;
  targetCpa: string;
  targetRoas: string;
}

const num = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export function prefsToForm(s: AppSettings): PrefsForm {
  const currency = s.displayCurrency ?? "";
  return {
    currency,
    fxRate: currency ? num(s.fxRates[currency]) : "",
    refreshSeconds: s.refreshSeconds,
    businessContext: s.businessContext,
    brandTerms: s.brandTerms.join(", "),
    competitorTerms: s.competitorTerms.join(", "),
    monthlyConversions: num(s.goals.monthlyConversions),
    monthlyRevenue: num(s.goals.monthlyRevenue),
    targetCpa: num(s.goals.targetCpa),
    targetRoas: num(s.goals.targetRoas),
  };
}

/** Currencies offered: common ones, any with a stored rate, and the current choice. */
export function currencyOptions(s: AppSettings, accountCurrency: string): string[] {
  const set = new Set<string>([accountCurrency, ...DISPLAY_CURRENCIES, ...Object.keys(s.fxRates), ...(s.displayCurrency ? [s.displayCurrency] : [])]);
  set.delete("");
  return [...set];
}

export type PrefsErrors = Partial<Record<keyof PrefsForm, string>>;

function goal(v: string, key: keyof PrefsForm, errors: PrefsErrors): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) {
    errors[key] = "Enter a number ≥ 0 or leave empty";
    return null;
  }
  return n;
}

/** Build the settings patch (fxRates merged, terms parsed). Returns field errors instead when the form is invalid. */
export function prefsPatch(f: PrefsForm, s: AppSettings, accountCurrency: string): { patch: Partial<AppSettings> | null; errors: PrefsErrors } {
  const errors: PrefsErrors = {};
  const currency = f.currency && f.currency !== accountCurrency ? f.currency : "";
  const fxRates = { ...s.fxRates };
  if (currency) {
    const rate = Number(f.fxRate.trim());
    if (!f.fxRate.trim() || !Number.isFinite(rate) || rate <= 0) errors.fxRate = `How many ${currency} is 1 ${accountCurrency}?`;
    else fxRates[currency] = rate;
  }
  if (f.businessContext.length > 1500) errors.businessContext = "At most 1,500 characters";
  const goals = {
    monthlyConversions: goal(f.monthlyConversions, "monthlyConversions", errors),
    monthlyRevenue: goal(f.monthlyRevenue, "monthlyRevenue", errors),
    targetCpa: goal(f.targetCpa, "targetCpa", errors),
    targetRoas: goal(f.targetRoas, "targetRoas", errors),
  };
  if (Object.keys(errors).length) return { patch: null, errors };
  return {
    patch: {
      displayCurrency: currency || null,
      fxRates,
      refreshSeconds: Math.max(0, Math.min(3600, Math.round(f.refreshSeconds))),
      businessContext: f.businessContext.trim(),
      brandTerms: parseTerms(f.brandTerms),
      competitorTerms: parseTerms(f.competitorTerms),
      goals,
    },
    errors,
  };
}
