import { z } from "zod";
import type { ChangeEvent, CampaignDim, SearchTermMatchType, SearchTermStatus } from "../schema/facts";
import type { CampaignStatus, CampaignType, CivilDate, MetricFormat, Mode, Severity } from "../types";
import type { SignalView } from "./anomaly";
import type { PacingRow } from "./budget";

// Management actions. Google Ads access is READ-ONLY: in demo mode actions are simulated (persisted overlay +
// audit entry, revertible); in live mode the API answers READ_ONLY_LIVE with a deep link, change list and CSV.

export const SIMULATED_ACTION_TYPES = ["campaign.pause", "campaign.enable", "campaign.set_budget", "budget.apply_plan", "keywords.add_negatives"] as const;
export type SimulatedActionType = (typeof SIMULATED_ACTION_TYPES)[number];

export const simulateRequestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("campaign.pause"), campaignIds: z.array(z.string().max(64)).min(1).max(200) }),
  z.object({ type: z.literal("campaign.enable"), campaignIds: z.array(z.string().max(64)).min(1).max(200) }),
  z.object({ type: z.literal("campaign.set_budget"), budgets: z.array(z.object({ campaignId: z.string().max(64), dailyBudget: z.number().positive().max(10_000_000) })).min(1).max(200) }),
  z.object({ type: z.literal("budget.apply_plan"), planId: z.string().max(64), budgets: z.array(z.object({ campaignId: z.string().max(64), dailyBudget: z.number().positive() })).max(200) }),
  z.object({
    type: z.literal("keywords.add_negatives"),
    negatives: z.array(z.object({ text: z.string().min(1).max(80), matchType: z.enum(["Exact", "Phrase", "Broad"]), campaignId: z.string().max(64), adGroupId: z.string().max(64).optional() })).min(1).max(200),
  }),
]);
export type SimulateRequest = z.infer<typeof simulateRequestSchema>;

export interface SimulatedAction {
  id: string;
  accountId: string;
  type: SimulatedActionType;
  targets: string[];
  summary: string;
  before: unknown;
  after: unknown;
  revertedAt?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReadOnlyAlternatives {
  deepLinks: { label: string; url: string }[];
  changeList: string[];
  editorCsv: string;
}

export interface AuditEntry {
  ts: string;
  actor: "user" | "system" | "scheduler";
  action: string;
  target?: string;
  /** data mode for data-changing actions; absent for sign-ins and user management */
  mode?: "live" | "demo";
  summary: string;
  details?: Record<string, unknown>;
  /** workspace the action happened in ("agency" or a client id) */
  workspace?: string;
  /** the signed-in person (absent for system/scheduler entries and AUTH_MODE=off) */
  actorId?: string;
  actorEmail?: string;
}

/** POST /api/actions/simulate (demo only). */
export interface SimulateResponse {
  action: SimulatedAction;
  simulated: true;
  message: string;
}

// ── Campaign payloads (additive): GET /api/campaigns, /api/campaigns/[id], /impact, /api/change-events ──

export interface CampaignMetrics {
  cost: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  conversions: number;
  cpa: number | null;
  roas: number | null;
  conv_value: number;
  cvr: number | null;
}

export interface ApiRange {
  start: CivilDate;
  end: CivilDate;
  days: number;
  compare?: { start: CivilDate; end: CivilDate };
}

export interface CampaignListRow {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  biddingStrategy: string;
  biddingLabel: string;
  dailyBudget: number | null;
  budgetShared: boolean;
  /** budget resource id — campaigns on a shared budget have the same one (count its amount once) */
  budgetId?: string;
  simulated?: { status?: boolean; budget?: boolean };
  metrics: CampaignMetrics;
  prev?: CampaignMetrics;
  /** daily cost over the range (zero-filled) */
  spark: number[];
  /** worst severity among active (open) signals */
  worstSeverity: Severity | null;
  signalCount: number;
  deepLink: string;
}

export interface CampaignListResponse {
  rows: CampaignListRow[];
  totals: CampaignMetrics & { dailyBudget: number; count: number };
  prevTotals?: CampaignMetrics;
  range: ApiRange;
  mode: Mode;
  currency: string;
  warnings: string[];
}

export interface CampaignDetail {
  campaign: CampaignDim & { biddingLabel: string };
  deepLink: string;
  range: ApiRange;
  kpis: CampaignMetrics;
  prev?: CampaignMetrics;
  daily: { date: CivilDate; cost: number; conversions: number; clicks: number; impressions: number; conv_value: number }[];
  /** current daily budget per day (flat line; simulated overlays included) */
  budgetLine: { date: CivilDate; value: number | null }[];
  signals: SignalView[];
  pacing: PacingRow | null;
  devices: (CampaignMetrics & { device: string })[];
  adGroups: (CampaignMetrics & { id: string; name: string; status: CampaignStatus })[];
  keywords: (CampaignMetrics & {
    id: string;
    adGroupId: string;
    adGroupName: string;
    text: string;
    matchType: string;
    status: CampaignStatus;
    qs: number | null;
    qsCtr: string | null;
    qsRelevance: string | null;
    qsLanding: string | null;
    cpcBid: number | null;
    avgQs: number | null;
  })[];
  searchTerms: (CampaignMetrics & { term: string; status: SearchTermStatus; matchType: SearchTermMatchType })[];
  /** conversions (and clicks/cost) by weekday (Mon…Sun) × hour (0–23) */
  hourDow: { dows: string[]; hours: number[]; conversions: number[][]; clicks: number[][]; cost: number[][] };
  changes: ChangeEvent[];
  mode: Mode;
  currency: string;
  warnings: string[];
}

export interface ChangeImpactMetric {
  metric: "cost" | "conversions" | "cpa" | "ctr";
  label: string;
  format: MetricFormat;
  /** ratio of sums (daily mean for cost/conversions) over each window */
  before: number | null;
  after: number | null;
  deltaPct: number | null;
  t: number;
  df: number;
  p: number;
  significant: boolean;
}

export interface ChangeImpactResult {
  event: ChangeEvent;
  before: { start: CivilDate; end: CivilDate; days: number };
  after: { start: CivilDate; end: CivilDate; days: number };
  metrics: ChangeImpactMetric[];
  note?: string;
}

export interface ChangeEventsResponse {
  events: ChangeEvent[];
  range: { start: CivilDate; end: CivilDate };
  warnings: string[];
}
