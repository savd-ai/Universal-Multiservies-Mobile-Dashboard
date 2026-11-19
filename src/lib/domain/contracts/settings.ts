import { z } from "zod";

// App-wide preferences stored on the server (the browser keeps only per-viewer conveniences like theme).

export const appSettingsSchema = z.object({
  displayCurrency: z.string().max(8).nullable().default(null),
  /** conversion factors from the account currency for display, e.g. { VND: 25400 } */
  fxRates: z.record(z.string(), z.number().positive()).default({ VND: 25_400 }),
  /** auto-refresh interval for monitoring views, seconds (0 = off) */
  refreshSeconds: z.number().int().min(0).max(3600).default(0),
  businessContext: z.string().max(1500).default("Acme Running Co. sells running shoes, trail gear and apparel online (US-first). Peak season: Q4."),
  brandTerms: z.array(z.string().max(60)).max(50).default(["acme"]),
  competitorTerms: z.array(z.string().max(60)).max(50).default(["stridemax", "peakpace", "velora"]),
  /** account goals: monthly conversions / revenue, target CPA / ROAS */
  goals: z
    .object({
      monthlyConversions: z.number().nonnegative().nullable().default(null),
      monthlyRevenue: z.number().nonnegative().nullable().default(null),
      targetCpa: z.number().nonnegative().nullable().default(null),
      targetRoas: z.number().nonnegative().nullable().default(null),
    })
    .default({ monthlyConversions: null, monthlyRevenue: null, targetCpa: null, targetRoas: null }),
  activeAccountId: z.string().max(32).nullable().default(null),
  onboardingDismissed: z.boolean().default(false),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

export const appSettingsPatchSchema = appSettingsSchema.partial();

export function defaultSettings(): AppSettings {
  return appSettingsSchema.parse({});
}
