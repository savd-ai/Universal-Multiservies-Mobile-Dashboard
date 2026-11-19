import "server-only";
import type { DateRange } from "@/lib/domain/dates";
import { googlePlatformRows, type GoogleDailyTotals } from "@/lib/domain/demo/generator";
import type { QuerySource, QuerySourceMeta } from "@/lib/domain/query/spec";
import { registerPlatformLabel } from "@/lib/domain/schema/dimensions";
import type { CampaignDailyRow, PlatformDailyRow } from "@/lib/domain/schema/facts";
import { describeDemoReason } from "@/lib/domain/types";
import type { GoogleAdsSource } from "../datasource/types";
import { demoConfig } from "../env/config";
import { log } from "../log";
import { allPlugins, connections, pluginContext, pluginMode } from "./registry";

// Rows for cross-channel ("blended") and single-plugin queries: Google Ads totals as a platform row, plus every
// connected metrics plugin — live fetch when it has credentials, seeded demo data otherwise. Plugins are fetched
// concurrently; one failing plugin becomes a warning + a stale source, never a failed query.

export interface PlatformRowsResult {
  rows: PlatformDailyRow[];
  sources: QuerySourceMeta[];
  warnings: string[];
}

export async function platformRows(opts: { google: GoogleAdsSource; accountId: string; range: DateRange; source: QuerySource }): Promise<PlatformRowsResult> {
  const { google, accountId, range, source } = opts;
  const account = await google.account(accountId);
  const slice = await google.getTable(accountId, "campaign_daily", range);
  const googleRows = googlePlatformRows({ account, tables: { campaign_daily: slice.rows as unknown as CampaignDailyRow[] } });
  const totals: GoogleDailyTotals[] = googleRows.map((r) => ({ date: r.date, cost: r.cost, clicks: r.clicks, impressions: r.impressions, conversions: r.conversions, conv_value: r.conv_value }));

  const rows: PlatformDailyRow[] = [];
  const sources: QuerySourceMeta[] = [];
  const warnings: string[] = [];
  const wantId = source.startsWith("plugin:") ? source.slice(7) : null;
  if (!wantId) {
    rows.push(...googleRows);
    sources.push({ id: "google_ads", label: "Google Ads", mode: google.mode, ...(google.reason ? { reason: describeDemoReason(google.reason) } : {}) });
  }

  const [plugins, conns] = await Promise.all([allPlugins(), connections()]);
  const selected = plugins.filter((p) => p.manifest.capabilities.includes("metrics.read") && (wantId ? p.manifest.id === wantId : !!conns.get(p.manifest.id)?.enabled));
  const results = await Promise.all(
    selected.map(async (p): Promise<{ rows: PlatformDailyRow[]; source: QuerySourceMeta; warning?: string }> => {
      const conn = conns.get(p.manifest.id);
      registerPlatformLabel(p.manifest.id, p.manifest.name);
      const mode = pluginMode(p, conn);
      try {
        if (mode === "live" && p.fetchMetrics) {
          const ctx = await pluginContext(p, conn, account);
          return { rows: await p.fetchMetrics(range, ctx), source: { id: p.manifest.id, label: p.manifest.name, mode: "live" } };
        }
        if (p.demo) return { rows: p.demo(range, { account, google: totals, seed: demoConfig().seed }), source: { id: p.manifest.id, label: p.manifest.name, mode: "demo", reason: p.manifest.live ? "No credentials yet" : "Demo connector in v1" } };
        return { rows: [], source: { id: p.manifest.id, label: p.manifest.name, mode, reason: "No data source for this plugin yet" } };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn("Plugin fetch failed", { plugin: p.manifest.id, error: message });
        return { rows: [], source: { id: p.manifest.id, label: p.manifest.name, mode, reason: message, stale: true }, warning: `${p.manifest.name}: ${message}` };
      }
    }),
  );
  for (const r of results) {
    rows.push(...r.rows);
    sources.push(r.source);
    if (r.warning) warnings.push(r.warning);
  }
  return { rows, sources, warnings };
}
