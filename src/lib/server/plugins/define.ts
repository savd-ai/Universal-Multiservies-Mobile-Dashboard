import "server-only";
import type { AlertMessage } from "@/lib/domain/contracts/alerts";
import { pluginManifestSchema, type PluginManifest, type PluginPreviewResult } from "@/lib/domain/contracts/plugins";
import type { DateRange } from "@/lib/domain/dates";
import type { GoogleDailyTotals, PlatformKind } from "@/lib/domain/demo/generator";
import type { PlatformDailyRow } from "@/lib/domain/schema/facts";
import type { AccountInfo, Mode } from "@/lib/domain/types";

// Plugin SDK. A plugin = manifest + optional behaviours. Built-ins, code plugins (src/plugins/custom) and no-code
// REST plugins all resolve to a PluginRuntime. Network access goes through ctx.fetch (SSRF-guarded).

export type GuardedFetch = (url: string, init?: RequestInit & { timeoutMs?: number; maxBytes?: number }) => Promise<Response>;

export interface PluginContext {
  /** non-secret config values + decrypted secrets (server-side only, never logged) */
  config: Record<string, string>;
  /** only the env keys the manifest declares */
  env: Readonly<Record<string, string | undefined>>;
  fetch: GuardedFetch;
  account: AccountInfo;
  mode: Mode;
  now: Date;
}

export interface DemoContext {
  account: { id: string; currency: string };
  google: readonly GoogleDailyTotals[];
  seed: string;
}

export interface SendResult {
  ok: boolean;
  status?: number;
  retryAfterMs?: number;
  /** don't retry (4xx other than 429) */
  permanent?: boolean;
  error?: string;
  preview?: string;
}

/** Preview of a REST source: raw sample + first mapped rows (see contracts/plugins). */
export type PreviewResult = PluginPreviewResult;

export interface PluginRuntime {
  manifest: PluginManifest;
  /** how demo rows are shaped (ad platform vs analytics vs commerce) */
  demoKind?: PlatformKind;
  testConnection?(ctx: PluginContext): Promise<{ ok: boolean; message: string; details?: Record<string, unknown> }>;
  fetchMetrics?(range: DateRange, ctx: PluginContext): Promise<PlatformDailyRow[]>;
  sendAlert?(msg: AlertMessage, ctx: PluginContext): Promise<SendResult>;
  demo?(range: DateRange, ctx: DemoContext): PlatformDailyRow[];
  preview?(range: DateRange, ctx: PluginContext): Promise<PreviewResult>;
}

/** Validate the manifest at registration time so a broken plugin fails loudly in dev. */
export function definePlugin(p: PluginRuntime): PluginRuntime {
  const manifest = pluginManifestSchema.parse(p.manifest);
  return { ...p, manifest };
}
