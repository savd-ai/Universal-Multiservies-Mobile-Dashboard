import { z } from "zod";
import type { Severity } from "../types";
import { mfaLoginSchema } from "./auth";
import { mobileDeviceInfoSchema } from "./history";
import type { PortfolioKpis } from "./portfolio";

/** Phone sign-in: the token comes back in the body (bearer), never as a cookie. */
export const mobileLoginSchema = z.object({
  email: z.email().max(254).transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(256),
  device: mobileDeviceInfoSchema,
  /** Random id the app keeps per install, so a new sign-in on the same phone reuses its device record. */
  installId: z.uuid().optional(),
});

export const mobileMfaSchema = mfaLoginSchema.extend({
  challenge: z.string().min(16).max(128),
  device: mobileDeviceInfoSchema,
  installId: z.uuid().optional(),
});

export type MobileLoginResponse =
  | { ok: true; token: string; expiresAt: string; deviceId: string | null; user: { name: string; email: string; role: string } }
  | { ok: false; mfa: { challenge: string } };

export const MOBILE_RANGES = ["last_7d", "last_14d", "last_30d", "mtd"] as const;
export const mobileOverviewQuerySchema = z.object({ range: z.enum(MOBILE_RANGES).optional() });

export interface MobileSignalItem {
  id: string;
  title: string;
  summary: string;
  recommendation: string;
  entityName: string;
  entityType: string | null;
  severity: Severity;
  polarity: "bad" | "good";
  status: string;
  observed: number;
  expected: number;
  changePct: number;
  format: string;
  firstSeenAt: string | null;
  evidence: { label: string; value: string }[];
  series: { date: string; value: number | null }[];
}

export interface MobileOverview {
  account: { id: string; name: string; currency: string; timezone: string };
  accounts: { id: string; name: string }[];
  mode: "live" | "blank";
  demo: boolean;
  reasonText: string | null;
  dataThrough: string;
  range: { preset: (typeof MOBILE_RANGES)[number]; start: string; end: string; compareStart: string | null; compareEnd: string | null };
  kpis: PortfolioKpis;
  previous: PortfolioKpis | null;
  daily: { date: string; cost: number; conversions: number }[];
  pacing: { monthLabel: string; mtdSpend: number; projected: number; target: number; ratio: number | null; overpacing: number; underpacing: number } | null;
  signals: { critical: number; warning: number; opportunity: number; top: MobileSignalItem[] };
}
