import { describe, expect, it } from "vitest";
import { currencyOptions, prefsPatch, prefsToForm } from "@/features/data-source/prefs-model";
import { defaultSettings } from "@/lib/domain/contracts/settings";

describe("display preferences", () => {
  const s = defaultSettings();

  it("round-trips the defaults without changes", () => {
    const f = prefsToForm(s);
    expect(f).toMatchObject({ currency: "", fxRate: "", refreshSeconds: 0, brandTerms: "acme", competitorTerms: "stridemax, peakpace, velora", targetRoas: "" });
    const { patch, errors } = prefsPatch(f, s, "USD");
    expect(errors).toEqual({});
    expect(patch).toEqual({ displayCurrency: null, fxRates: s.fxRates, refreshSeconds: 0, businessContext: s.businessContext, brandTerms: ["acme"], competitorTerms: ["stridemax", "peakpace", "velora"], goals: { monthlyConversions: null, monthlyRevenue: null, targetCpa: null, targetRoas: null } });
  });

  it("requires an FX rate for a foreign display currency and merges it into fxRates", () => {
    const f = { ...prefsToForm(s), currency: "EUR", fxRate: "" };
    expect(prefsPatch(f, s, "USD")).toEqual({ patch: null, errors: { fxRate: "How many EUR is 1 USD?" } });
    const ok = prefsPatch({ ...f, fxRate: "0.92" }, s, "USD");
    expect(ok.patch?.displayCurrency).toBe("EUR");
    expect(ok.patch?.fxRates).toEqual({ VND: 25_400, EUR: 0.92 });
  });

  it("treats the account currency as no override", () => {
    expect(prefsPatch({ ...prefsToForm(s), currency: "USD" }, s, "USD").patch?.displayCurrency).toBeNull();
    expect(prefsToForm({ ...s, displayCurrency: "VND" }).fxRate).toBe("25400");
  });

  it("validates goals and parses terms", () => {
    const bad = prefsPatch({ ...prefsToForm(s), targetCpa: "-3", monthlyRevenue: "abc" }, s, "USD");
    expect(bad.patch).toBeNull();
    expect(Object.keys(bad.errors).sort()).toEqual(["monthlyRevenue", "targetCpa"]);
    const good = prefsPatch({ ...prefsToForm(s), targetRoas: "4.5", brandTerms: "acme, Acme Running ,, acme", refreshSeconds: 99999 }, s, "USD");
    expect(good.patch?.goals).toMatchObject({ targetRoas: 4.5 });
    expect(good.patch?.brandTerms).toEqual(["acme", "Acme Running"]);
    expect(good.patch?.refreshSeconds).toBe(3600);
  });

  it("offers the account currency, common currencies and stored rates once each", () => {
    const opts = currencyOptions({ ...s, fxRates: { VND: 25_400, CHF: 0.9 } }, "USD");
    expect(opts[0]).toBe("USD");
    expect(opts).toContain("CHF");
    expect(new Set(opts).size).toBe(opts.length);
  });
});
