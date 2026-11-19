import type { AccountInfo, DemoReason, Mode } from "../types";
import type { AiStatus } from "./ai";

// GET /api/status — what the shell needs on every page: data mode + reason, account, dates, AI, plugins, store.

export interface EnvKeyStatusWire {
  key: string;
  group: string;
  set: boolean;
  required: boolean;
  secret: boolean;
  masked: string | null;
  pluginId?: string;
  description: string;
}

export interface StatusResponse {
  mode: Mode;
  reason: DemoReason | null;
  reasonText: string;
  account: AccountInfo;
  accounts: AccountInfo[];
  manager: { id: string; name: string } | null;
  /** today in the account time zone */
  today: string;
  /** last complete day of data */
  dataThrough: string;
  demoProfile: "realistic" | "prototype";
  googleAds: {
    apiVersion: string;
    envFile: boolean;
    missingKeys: string[];
    health: { ok: boolean; checkedAt: string | null; latencyMs?: number; errorCode?: string } | null;
  };
  ai: AiStatus;
  plugins: { connected: number; live: number; demo: number };
  store: { driver: "file" | "memory"; writable: boolean; fallbackReason?: string };
  scheduler: { enabled: boolean; intervalMinutes: number; lastRunAt: string | null };
  security: { basicAuth: boolean; encryption: boolean; readOnly: true };
  display: { currency: string; fxRates: Record<string, number> };
  env: EnvKeyStatusWire[];
  generatedAt: string;
}
