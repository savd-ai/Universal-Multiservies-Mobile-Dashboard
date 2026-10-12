import type { AccountInfo } from "../types";
export const ROLES = ["agency_admin", "agency_member", "client_admin", "client_viewer"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
    agency_admin: "Agency admin",
    agency_member: "Agency member",
    client_admin: "Client admin",
    client_viewer: "Client viewer",
};
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
    agency_admin: "Every client and account, users, clients and system settings.",
    agency_member: "Every client and account; can edit dashboards, rules, alerts and plans.",
    client_admin: "Their client's accounts; can edit dashboards, rules, alerts, plans and invite their team.",
    client_viewer: "Their client's accounts, read-only.",
};
export const PERMISSIONS = [
    "accounts.read",
    "portfolio.read",
    "dashboards.edit",
    "anomalies.manage",
    "rules.manage",
    "alerts.manage",
    "budget.plan",
    "actions.simulate",
    "settings.manage",
    "audit.read",
    "users.manage",
    "clients.manage",
    "system.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
const 祠壍: Permission[] = [
    "accounts.read",
    "portfolio.read",
    "dashboards.edit",
    "anomalies.manage",
    "rules.manage",
    "alerts.manage",
    "budget.plan",
    "actions.simulate",
    "settings.manage",
    "audit.read",
    "users.manage",
];
const 顏壍: Record<Role, readonly Permission[]> = {
    agency_admin: PERMISSIONS,
    agency_member: PERMISSIONS.filter((放壍) => 放壍 !== "users.manage" && 放壍 !== "clients.manage"),
    client_admin: 祠壍,
    client_viewer: ["accounts.read", "portfolio.read"],
};
export function permissionsFor(萭壍: Role): Permission[] {
    return [...顏壍[萭壍]];
}
export function can(儜壍: Role, 瀋壍: Permission): boolean {
    return 顏壍[儜壍].includes(瀋壍);
}
export const isAgencyRole = (軺壍: Role): boolean => 軺壍 === "agency_admin" || 軺壍 === "agency_member";
export function assignableRoles(審壍: Role): Role[] {
    if (審壍 === "agency_admin")
        return [...ROLES];
    if (審壍 === "client_admin")
        return ["client_admin", "client_viewer"];
    return [];
}
export const AGENCY_WORKSPACE = "agency";
export interface ClientLike {
    id: string;
    name: string;
    accountIds: readonly string[];
}
export interface Viewer {
    role: Role;
    clientId: string | null;
}
export function clientForAccount(竘壍: string, 駇壍: readonly ClientLike[]): ClientLike | null {
    return 駇壍.find((暶壍) => 暶壍.accountIds.includes(竘壍)) ?? null;
}
export function accountsVisibleTo<T extends Pick<AccountInfo, "id">>(薥壍: Viewer, 劔壍: readonly ClientLike[], 熃壍: readonly T[]): T[] {
    if (isAgencyRole(薥壍.role))
        return [...熃壍];
    const 遲壍 = 劔壍.find((嵡壍) => 嵡壍.id === 薥壍.clientId);
    if (!遲壍)
        return [];
    return 熃壍.filter((籐壍) => 遲壍.accountIds.includes(籐壍.id));
}
export function canOpenAccount(鬿壍: Viewer, 栮壍: readonly ClientLike[], 蜝壍: string): boolean {
    if (isAgencyRole(鬿壍.role))
        return true;
    return clientForAccount(蜝壍, 栮壍)?.id === 鬿壍.clientId && 鬿壍.clientId !== null;
}
/** Client users with no client (self-registered, or their client was removed) see nothing until an admin assigns one. */
export const UNASSIGNED_WORKSPACE = "unassigned";
export function awaitingAccess(viewer: Viewer & { kind?: string }): boolean {
    return (viewer.kind === undefined || viewer.kind === "user") && !isAgencyRole(viewer.role) && !viewer.clientId;
}
export function workspaceFor(同壍: Viewer, 狻壍: readonly ClientLike[], 釪壍: string | null | undefined): string {
    if (!isAgencyRole(同壍.role))
        return 同壍.clientId ?? UNASSIGNED_WORKSPACE;
    if (!釪壍)
        return AGENCY_WORKSPACE;
    return clientForAccount(釪壍, 狻壍)?.id ?? AGENCY_WORKSPACE;
}
export const CLIENT_ID_PATTERN = /^c-[a-z0-9]{6,32}$/;
