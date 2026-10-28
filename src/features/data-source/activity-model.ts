import type { AuditRow } from "@/lib/api/actions";
export const ACTIVITY_TYPES = ["all", "alerts", "budget", "settings", "other"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];
export const ACTIVITY_LABEL: Record<ActivityType, string> = {
    all: "All",
    alerts: "Alerts",
    budget: "Budget",
    settings: "Settings",
    other: "Other",
};
const FAMILIES = new Set<string>(ACTIVITY_TYPES.filter((t) => t !== "all" && t !== "other"));
export function activityType(action: string): Exclude<ActivityType, "all"> {
    const family = action.split(".")[0] ?? "";
    return (FAMILIES.has(family) ? family : "other") as Exclude<ActivityType, "all">;
}
export function filterAudit(rows: readonly AuditRow[], activityType2: ActivityType): AuditRow[] {
    return activityType2 === "all" ? [...rows] : rows.filter((r) => activityType(r.action) === activityType2);
}
export function countByType(rows: readonly AuditRow[]): Record<ActivityType, number> {
    const out = Object.fromEntries(ACTIVITY_TYPES.map((t) => [t, 0])) as Record<ActivityType, number>;
    out.all = rows.length;
    for (const r of rows)
        out[activityType(r.action)]++;
    return out;
}
