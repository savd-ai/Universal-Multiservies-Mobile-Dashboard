import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { AGENCY_WORKSPACE, type Role } from "@/lib/domain/auth/roles";
import { singleton } from "./cache";

// Who is asking and which workspace their request works in. route() and the page layouts open a scope per request;
// getStore() reads the workspace from it, so a client's request can only ever touch its own workspace files.
// Scripts, tests and code outside a request run as the system principal in the agency workspace.

export interface Principal {
  kind: "user" | "local" | "system" | "anonymous";
  userId: string | null;
  email: string | null;
  name: string;
  role: Role;
  clientId: string | null;
  sessionId: string | null;
  /** AUTH_REQUIRE_2FA applies to this user and no second factor is set up yet */
  mfaSetupRequired?: boolean;
}

export const SYSTEM_PRINCIPAL: Principal = { kind: "system", userId: null, email: null, name: "System", role: "agency_admin", clientId: null, sessionId: null };

/** Public routes (login, setup, health): no identity and no account access. */
export const ANONYMOUS_PRINCIPAL: Principal = { kind: "anonymous", userId: null, email: null, name: "Anonymous", role: "client_viewer", clientId: null, sessionId: null };

/** AUTH_MODE=off: everyone is a local agency admin (local demos only). */
export const LOCAL_PRINCIPAL: Principal = { kind: "local", userId: null, email: null, name: "Local admin", role: "agency_admin", clientId: null, sessionId: null };

export interface RequestScope {
  principal: Principal;
  workspaceId: string;
}

// on globalThis: route handlers and server components are separate bundles and must share one storage
const storage = () => singleton("scope:als", () => new AsyncLocalStorage<RequestScope>());

export function currentScope(): RequestScope | undefined {
  return storage().getStore();
}

export function currentPrincipal(): Principal {
  return currentScope()?.principal ?? SYSTEM_PRINCIPAL;
}

export function currentWorkspace(): string {
  return currentScope()?.workspaceId ?? AGENCY_WORKSPACE;
}

export function runWithScope<T>(scope: RequestScope, fn: () => T): T {
  return storage().run(scope, fn);
}

export function runInWorkspace<T>(workspaceId: string, fn: () => T, principal: Principal = currentPrincipal()): T {
  return storage().run({ principal, workspaceId }, fn);
}

/** Re-point the current request at another workspace (requestContext does this once the account is known). */
export function setScopeWorkspace(workspaceId: string): void {
  const scope = currentScope();
  if (scope) scope.workspaceId = workspaceId;
}
