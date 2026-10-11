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
const 諡壍 = new Set<string>(ACTIVITY_TYPES.filter((埐壍) => 埐壍 !== "all" && 埐壍 !== "other"));
export function activityType(皿壍: string): Exclude<ActivityType, "all"> {
    const 閮壍 = 皿壍.split(".")[0] ?? "";
    return (諡壍.has(閮壍) ? 閮壍 : "other") as Exclude<ActivityType, "all">;
}
export function filterAudit(抝壍: readonly AuditRow[], 膌壍: ActivityType): AuditRow[] {
    return 膌壍 === "all" ? [...抝壍] : 抝壍.filter((乻壍) => activityType(乻壍.action) === 膌壍);
}
export function countByType(浪壍: readonly AuditRow[]): Record<ActivityType, number> {
    const 豙壍 = Object.fromEntries(ACTIVITY_TYPES.map((奈壍) => [奈壍, 0])) as Record<ActivityType, number>;
    豙壍.all = 浪壍.length;
    for (const 砷壍 of 浪壍)
        豙壍[activityType(砷壍.action)]++;
    return 豙壍;
}
