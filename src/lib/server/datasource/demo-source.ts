import "server-only";
import type { GoogleEstimates } from "@/lib/domain/contracts/estimates";
import { addDays, maxDate, minDate, type DateRange } from "@/lib/domain/dates";
import { buildDemoEstimates } from "@/lib/domain/demo/estimates";
import { generateDemoDataset, type DemoDataset } from "@/lib/domain/demo/generator";
import { DEMO_ACCOUNTS, DEMO_MANAGER } from "@/lib/domain/demo/scenario";
import type { FactSlice } from "@/lib/domain/query/engine";
import type { ChangeEvent, EntityDims } from "@/lib/domain/schema/facts";
import type { AccountInfo, CivilDate, DemoReason } from "@/lib/domain/types";
import { singleton } from "../cache";
import { accountYesterday } from "../clock";
import { demoConfig } from "../env/config";
import { AppError } from "../http/errors";
import { getStore } from "../store";
import type { GoogleAdsSource, GoogleTableId } from "./types";

// Deterministic demo data (see domain/demo). Demo-mode "management" actions are applied as overlays on the entity
// dimensions (status, daily budget) and surfaced as synthetic change events — history itself never changes.

const datasets = () => singleton("demo:datasets", () => new Map<string, DemoDataset>());

export function demoAnchor(): CivilDate {
  const cfg = demoConfig();
  return cfg.anchor ?? accountYesterday(cfg.timezone);
}

export function getDemoDataset(accountId: string): DemoDataset {
  const cfg = demoConfig();
  const spec = DEMO_ACCOUNTS.find((a) => a.id === accountId);
  if (!spec) throw new AppError("NOT_FOUND", `Demo account ${accountId} not found`);
  const anchor = demoAnchor();
  const key = `${cfg.profile}|${cfg.seed}|${cfg.scenarios}|${anchor}|${accountId}`;
  const cache = datasets();
  let ds = cache.get(key);
  if (!ds) {
    ds = generateDemoDataset({ ...spec, currency: cfg.currency }, { profile: cfg.profile, seed: cfg.seed, anchor, scenarios: cfg.scenarios, timezone: cfg.timezone });
    if (cache.size > 8) cache.clear();
    cache.set(key, ds);
  }
  return ds;
}

function cloneDims(d: EntityDims): EntityDims {
  return {
    campaigns: new Map([...d.campaigns].map(([k, v]) => [k, { ...v }])),
    adGroups: d.adGroups,
    keywords: d.keywords,
  };
}

type Diff = ChangeEvent["diffs"][number];

/** Before → after of a simulated action for the campaign its change event is filed under (like a live change_event). */
function simulatedDiffs(type: string, before: unknown, after: unknown, campaignId: string | undefined): Diff[] {
  if (type === "campaign.pause" || type === "campaign.enable") {
    const was = (before as { statuses?: Record<string, string | null> } | null)?.statuses?.[campaignId ?? ""];
    return [{ field: "status", before: was ? was.toUpperCase() : null, after: type === "campaign.pause" ? "PAUSED" : "ENABLED" }];
  }
  if (type === "campaign.set_budget" || type === "budget.apply_plan") {
    const budgetOf = (v: unknown) => (v as { budgets?: { campaignId: string; dailyBudget: number | null }[] } | null)?.budgets?.find((b) => b.campaignId === campaignId)?.dailyBudget ?? null;
    return [{ field: "amount", before: budgetOf(before), after: budgetOf(after) }];
  }
  return [];
}

async function simulatedFor(accountId: string) {
  try {
    const all = await getStore().simulatedActions.list((a) => a.accountId === accountId && !a.revertedAt);
    return all.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  } catch {
    return [];
  }
}

export class DemoGoogleAdsSource implements GoogleAdsSource {
  readonly mode = "demo" as const;
  readonly apiVersion = "demo";
  constructor(readonly reason: DemoReason) {}

  async listAccounts(): Promise<AccountInfo[]> {
    const cfg = demoConfig();
    return DEMO_ACCOUNTS.map((a) => ({ id: a.id, name: a.name, currency: cfg.currency, timezone: cfg.timezone, isManager: false, parentId: DEMO_MANAGER.id, mode: "demo" }));
  }

  async manager() {
    return DEMO_MANAGER;
  }

  defaultAccountId(): string {
    return DEMO_ACCOUNTS[0]?.id ?? "";
  }

  async account(accountId: string): Promise<AccountInfo> {
    return getDemoDataset(accountId).account;
  }

  async today(accountId: string): Promise<CivilDate> {
    return addDays(getDemoDataset(accountId).anchor, 1);
  }

  async dataThrough(accountId: string): Promise<CivilDate> {
    return getDemoDataset(accountId).anchor;
  }

  async getDims(accountId: string): Promise<EntityDims> {
    const ds = getDemoDataset(accountId);
    const actions = await simulatedFor(accountId);
    if (!actions.length) return ds.dims;
    const dims = cloneDims(ds.dims);
    for (const a of actions) {
      if (a.type === "campaign.pause" || a.type === "campaign.enable") {
        for (const id of a.targets) {
          const c = dims.campaigns.get(id);
          if (c) dims.campaigns.set(id, { ...c, status: a.type === "campaign.pause" ? "Paused" : "Enabled", simulated: { ...c.simulated, status: true } });
        }
      }
      if (a.type === "campaign.set_budget" || a.type === "budget.apply_plan") {
        const budgets = (a.after as { budgets?: { campaignId: string; dailyBudget: number }[] })?.budgets ?? [];
        for (const b of budgets) {
          const c = dims.campaigns.get(b.campaignId);
          if (c) dims.campaigns.set(b.campaignId, { ...c, budget_daily: b.dailyBudget, simulated: { ...c.simulated, budget: true } });
        }
      }
    }
    return dims;
  }

  async getTable(accountId: string, table: GoogleTableId, range: DateRange): Promise<FactSlice> {
    const ds = getDemoDataset(accountId);
    const cov = ds.coverage[table];
    const start = maxDate(range.start, cov.start);
    const end = minDate(range.end, cov.end);
    let rows = (ds.tables[table] as unknown as { date: string | null }[]).filter((r) => r.date !== null && r.date >= start && r.date <= end) as unknown as Record<string, unknown>[];
    if (table === "search_term_daily") {
      // simulated negatives: matching search terms show as "Excluded" (the demo still reports their past spend)
      const excluded = new Set<string>();
      for (const a of await simulatedFor(accountId)) {
        if (a.type !== "keywords.add_negatives") continue;
        for (const n of (a.after as { negatives?: { text: string; campaignId: string }[] } | null)?.negatives ?? []) excluded.add(`${n.campaignId}|${n.text.toLowerCase()}`);
      }
      if (excluded.size) rows = rows.map((r) => (excluded.has(`${String(r.campaign_id)}|${String(r.search_term).toLowerCase()}`) ? { ...r, st_status: "excluded" } : r));
    }
    return { rows, grain: "daily", coverage: cov };
  }

  async getChangeEvents(accountId: string, range: DateRange): Promise<ChangeEvent[]> {
    const ds = getDemoDataset(accountId);
    const events = ds.changeEvents.filter((e) => e.date >= range.start && e.date <= range.end);
    const actions = await simulatedFor(accountId);
    for (const a of actions) {
      const date = a.createdAt.slice(0, 10);
      events.push({
        id: `sim-${a.id}`,
        ts: a.createdAt.replace("T", " ").slice(0, 19),
        date,
        resource_type: a.type.startsWith("keywords") ? "CAMPAIGN_CRITERION" : a.type.includes("budget") ? "CAMPAIGN_BUDGET" : "CAMPAIGN",
        operation: a.type === "keywords.add_negatives" ? "create" : "update",
        campaign_id: a.targets[0],
        changed_fields: [a.type],
        diffs: simulatedDiffs(a.type, a.before, a.after, a.targets[0]),
        summary: `${a.summary} (simulated in demo)`,
        client_type: "SAVD_DASHBOARD_SIMULATION",
      });
    }
    return events.sort((x, y) => (x.ts < y.ts ? 1 : -1));
  }

  /** Google-style simulations and recommendations built from the dataset (simulated budgets don't move them, like Google's past window). */
  async getGoogleEstimates(accountId: string): Promise<GoogleEstimates> {
    return buildDemoEstimates(getDemoDataset(accountId), { seed: demoConfig().seed });
  }

  async coverage(accountId: string, table: GoogleTableId): Promise<DateRange | null> {
    return getDemoDataset(accountId).coverage[table];
  }

  async invalidate(): Promise<void> {
    datasets().clear();
  }
}
