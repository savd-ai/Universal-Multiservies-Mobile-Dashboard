import type { AuditRow } from "@/lib/api/actions";
import type { SimulatedAction, SimulatedActionType } from "@/lib/domain/contracts/actions";

// Activity log model: audit entries bucketed by action family for the filter chips, and labels for simulated
// (demo-only) actions. Pure.

export const ACTIVITY_TYPES = ["all", "simulate", "plugin", "alerts", "budget", "settings", "other"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  all: "All",
  simulate: "Simulated actions",
  plugin: "Plugins",
  alerts: "Alerts",
  budget: "Budget",
  settings: "Settings",
  other: "Other",
};

const FAMILIES = new Set<string>(ACTIVITY_TYPES.filter((t) => t !== "all" && t !== "other"));

/** "plugin.custom.create" → "plugin"; unknown families → "other". */
export function activityType(action: string): Exclude<ActivityType, "all"> {
  const family = action.split(".")[0] ?? "";
  return (FAMILIES.has(family) ? family : "other") as Exclude<ActivityType, "all">;
}

export function filterAudit(rows: readonly AuditRow[], type: ActivityType): AuditRow[] {
  return type === "all" ? [...rows] : rows.filter((r) => activityType(r.action) === type);
}

export function countByType(rows: readonly AuditRow[]): Record<ActivityType, number> {
  const out = Object.fromEntries(ACTIVITY_TYPES.map((t) => [t, 0])) as Record<ActivityType, number>;
  out.all = rows.length;
  for (const r of rows) out[activityType(r.action)]++;
  return out;
}

export const SIMULATED_LABEL: Record<SimulatedActionType, string> = {
  "campaign.pause": "Pause",
  "campaign.enable": "Enable",
  "campaign.set_budget": "Budget change",
  "budget.apply_plan": "Budget plan",
  "keywords.add_negatives": "Negative keywords",
};

/** Active simulations first (newest first), reverted ones after. */
export function sortActions(actions: readonly SimulatedAction[]): SimulatedAction[] {
  return [...actions].sort((a, b) => Number(!!a.revertedAt) - Number(!!b.revertedAt) || b.createdAt.localeCompare(a.createdAt));
}
