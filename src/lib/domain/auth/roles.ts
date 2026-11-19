import type { AccountInfo } from "../types";

// Who may do what (pure). Agency roles (SAVD staff) see every account the agency's Google Ads credentials reach;
// client roles only see the accounts assigned to their client. The workspace of a request — where its dashboards,
// rules, alerts, plans and settings live — is the client that owns the active account, else the agency.

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
  agency_member: "Every client and account; can edit dashboards, rules, alerts, plans and plugins.",
  client_admin: "Their client's accounts; can edit dashboards, rules, alerts, plans and invite their team.",
  client_viewer: "Their client's accounts, read-only (plus Ask AI).",
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
  "ai.use",
  "plugins.manage",
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
  "ai.use",
  "settings.manage",
  "audit.read",
  "users.manage",
];

// Plugins stay agency-only: REST manifests may reference deployment-wide PLUGIN_* secrets, so letting a client
// build one could leak another client's credentials to a host of their choosing.
const MATRIX: Record<Role, readonly Permission[]> = {
  agency_admin: PERMISSIONS,
  agency_member: PERMISSIONS.filter((p) => p !== "users.manage" && p !== "clients.manage"),
  client_admin: CLIENT_ADMIN,
  client_viewer: ["accounts.read", "portfolio.read", "ai.use"],
};

export function permissionsFor(role: Role): Permission[] {
  return [...MATRIX[role]];
}

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export const isAgencyRole = (role: Role): boolean => role === "agency_admin" || role === "agency_member";

/** Roles a user may hand out: agency admins any role, client admins only client roles (for their own client). */
export function assignableRoles(role: Role): Role[] {
  if (role === "agency_admin") return [...ROLES];
  if (role === "client_admin") return ["client_admin", "client_viewer"];
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

/** The client that owns an account (an account belongs to at most one client). */
export function clientForAccount(accountId: string, clients: readonly ClientLike[]): ClientLike | null {
  return clients.find((c) => c.accountIds.includes(accountId)) ?? null;
}

/** Accounts a viewer may open: agency roles every listed account, client roles only their client's. */
export function accountsVisibleTo<T extends Pick<AccountInfo, "id">>(viewer: Viewer, clients: readonly ClientLike[], accounts: readonly T[]): T[] {
  if (isAgencyRole(viewer.role)) return [...accounts];
  const client = clients.find((c) => c.id === viewer.clientId);
  if (!client) return [];
  return accounts.filter((a) => client.accountIds.includes(a.id));
}

export function canOpenAccount(viewer: Viewer, clients: readonly ClientLike[], accountId: string): boolean {
  if (isAgencyRole(viewer.role)) return true;
  return clientForAccount(accountId, clients)?.id === viewer.clientId && viewer.clientId !== null;
}

/** Workspace for a request: client users always work in their client; agency users in the account's client. */
export function workspaceFor(viewer: Viewer, clients: readonly ClientLike[], accountId: string | null | undefined): string {
  if (!isAgencyRole(viewer.role)) return viewer.clientId ?? AGENCY_WORKSPACE;
  if (!accountId) return AGENCY_WORKSPACE;
  return clientForAccount(accountId, clients)?.id ?? AGENCY_WORKSPACE;
}

/** Client ids double as directory names for their workspace store. */
export const CLIENT_ID_PATTERN = /^c-[a-z0-9]{6,32}$/;
