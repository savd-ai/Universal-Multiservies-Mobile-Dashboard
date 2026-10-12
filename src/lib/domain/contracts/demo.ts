import { z } from "zod";
import { PUZZLE_CELLS } from "../demo/puzzle";
export const DEMO_SEAL_FORMAT = "savd.demo-seal.v1";
export const DEMO_TABLES = [
    { name: "demo_account", label: "Account", columns: ["id", "name", "currency", "timezone"] },
    { name: "demo_campaign", label: "Campaigns", columns: ["id", "name", "type", "status", "bidding_strategy", "budget_daily"] },
    { name: "demo_campaign_daily", label: "Campaign · daily", columns: ["date", "campaign_id", "impressions", "clicks", "cost", "conversions", "conv_value"] },
] as const;
export type DemoTableName = (typeof DEMO_TABLES)[number]["name"];
export const DEMO_MAX_MOVES = 20000;
export interface SealedTableInfo {
    name: string;
    columns: string[];
    rows: number;
}
export interface DemoChallenge {
    token: string;
    board: number[];
    expiresAt: string;
}
export interface DemoLockStatus {
    available: boolean;
    note: string | null;
    format: string | null;
    cipher: string | null;
    keySha256: string | null;
    sealedAt: string | null;
    tables: SealedTableInfo[];
    challenge: DemoChallenge;
}
export const demoUnlockSchema = z.object({
    token: z.string().min(1).max(1024),
    moves: z.array(z.number().int().min(1).max(PUZZLE_CELLS - 1)).max(DEMO_MAX_MOVES),
    key: z.string().trim().max(256),
});
export type DemoUnlockBody = z.infer<typeof demoUnlockSchema>;
export type DemoPuzzleVerdict = "solved" | "unsolved" | "illegal_move";
export interface DemoLockedDetails {
    reason: "demo_locked";
    puzzle: DemoPuzzleVerdict;
    key: "correct" | "incorrect" | "malformed";
    moves: number;
}
export interface DemoAccountRow {
    id: string;
    name: string;
    currency: string;
    timezone: string;
}
export interface DemoCampaignRow {
    id: string;
    name: string;
    type: string;
    status: string;
    bidding_strategy: string;
    budget_daily: number | null;
}
export interface DemoDailyRow {
    date: string;
    campaign_id: string;
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    conv_value: number;
}
export interface DemoDataset {
    account: DemoAccountRow;
    campaigns: DemoCampaignRow[];
    daily: DemoDailyRow[];
}
