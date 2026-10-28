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
const CLIENT_ADMIN: Permission[] = [
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
const MATRIX: Record<Role, readonly Permission[]> = {
    agency_admin: PERMISSIONS,
    agency_member: PERMISSIONS.filter((p) => p !== "users.manage" && p !== "clients.manage"),
    client_admin: CLIENT_ADMIN,
    client_viewer: ["accounts.read", "portfolio.read"],
};
export function permissionsFor(role: Role): Permission[] {
    return [...MATRIX[role]];
}
export function can(role: Role, permission: Permission): boolean {
    return MATRIX[role].includes(permission);
}
export const isAgencyRole = (role: Role): boolean => role === "agency_admin" || role === "agency_member";
export function assignableRoles(role: Role): Role[] {
    if (role === "agency_admin")
        return [...ROLES];
    if (role === "client_admin")
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
export function clientForAccount(accountId: string, clients: readonly ClientLike[]): ClientLike | null {
    return clients.find((c) => c.accountIds.includes(accountId)) ?? null;
}
export function accountsVisibleTo<T extends Pick<AccountInfo, "id">>(viewer: Viewer, clients: readonly ClientLike[], accounts: readonly T[]): T[] {
    if (isAgencyRole(viewer.role))
        return [...accounts];
    const client = clients.find((c) => c.id === viewer.clientId);
    if (!client)
        return [];
    return accounts.filter((a) => client.accountIds.includes(a.id));
}
export function canOpenAccount(viewer: Viewer, clients: readonly ClientLike[], accountId: string): boolean {
    if (isAgencyRole(viewer.role))
        return true;
    return clientForAccount(accountId, clients)?.id === viewer.clientId && viewer.clientId !== null;
}
/** Client users with no client (self-registered, or their client was removed) see nothing until an admin assigns one. */
export const UNASSIGNED_WORKSPACE = "unassigned";
export function awaitingAccess(viewer: Viewer & { kind?: string }): boolean {
    return (viewer.kind === undefined || viewer.kind === "user") && !isAgencyRole(viewer.role) && !viewer.clientId;
}
export function workspaceFor(viewer: Viewer, clients: readonly ClientLike[], accountId: string | null | undefined): string {
    if (!isAgencyRole(viewer.role))
        return viewer.clientId ?? UNASSIGNED_WORKSPACE;
    if (!accountId)
        return AGENCY_WORKSPACE;
    return clientForAccount(accountId, clients)?.id ?? AGENCY_WORKSPACE;
}
export const CLIENT_ID_PATTERN = /^c-[a-z0-9]{6,32}$/;
