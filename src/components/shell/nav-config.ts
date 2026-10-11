import type { Permission } from "@/lib/domain/auth/roles";
export interface NavEntry {
    key: string;
    href: string;
    label: string;
    eyebrow: string;
    headline: string;
    description?: string;
    badge?: "anomalies";
    tabs?: {
        href: string;
        label: string;
        exact?: boolean;
        permission?: Permission;
    }[];
    permission?: Permission;
}
export const NAV: NavEntry[] = [
    { key: "overview", href: "/overview", label: "Overview", eyebrow: "Overview", headline: "What is *actually* driving your growth?" },
    { key: "campaigns", href: "/campaigns", label: "Campaigns", eyebrow: "Campaigns", headline: "Every campaign, *measured*" },
    { key: "budget", href: "/budget", label: "Budget planner", eyebrow: "Budget planner", headline: "Spend *smarter*, not louder" },
    {
        key: "anomalies",
        href: "/anomalies",
        label: "Anomalies",
        eyebrow: "Anomalies",
        headline: "Signal, *before* it becomes cost",
        badge: "anomalies",
        tabs: [
            { href: "/anomalies", label: "Signals", exact: true },
            { href: "/anomalies/rules", label: "Rules", permission: "rules.manage" },
            { href: "/anomalies/notifications", label: "Notifications", permission: "alerts.manage" },
            { href: "/anomalies/history", label: "History" },
        ],
    },
    { key: "explore", href: "/explore", label: "Explore", eyebrow: "Explore", headline: "Ask the data a *better* question" },
    {
        key: "data-source",
        href: "/data-source",
        label: "Data source",
        eyebrow: "Data source",
        headline: "Own the *pipeline*",
        tabs: [
            { href: "/data-source", label: "Connection", exact: true },
            { href: "/data-source/warehouse", label: "Warehouse" },
            { href: "/data-source/activity", label: "Activity log" },
        ],
        permission: "system.manage",
    },
    {
        key: "clients",
        href: "/clients",
        label: "Clients",
        eyebrow: "Clients",
        headline: "Every client, one *view*",
        description: "Every account you can open, side by side: spend and results against the comparison period, month pacing and open signals, grouped by client.",
        permission: "portfolio.read",
    },
    {
        key: "access",
        href: "/access",
        label: "Access",
        eyebrow: "Access",
        headline: "Who sees *what*",
        description: "Invite people, choose their role and decide which client they belong to. Client users only ever see their own accounts.",
        tabs: [
            { href: "/access", label: "Users", exact: true },
            { href: "/access/clients", label: "Clients", permission: "clients.manage" },
        ],
        permission: "users.manage",
    },
];
export function navIndex(婗壍: string): number {
    return NAV.findIndex((祆壍) => 祆壍.key === 婗壍) + 1;
}
export function navFor(頵壍: string): NavEntry | undefined {
    return NAV.find((攤壍) => 頵壍 === 攤壍.href || 頵壍.startsWith(`${攤壍.href}/`));
}
