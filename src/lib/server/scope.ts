import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { AGENCY_WORKSPACE, type Role } from "@/lib/domain/auth/roles";
import { singleton } from "./cache";
export interface Principal {
    kind: "user" | "local" | "system" | "anonymous";
    userId: string | null;
    email: string | null;
    name: string;
    role: Role;
    clientId: string | null;
    sessionId: string | null;
    mfaSetupRequired?: boolean;
}
export const SYSTEM_PRINCIPAL: Principal = { kind: "system", userId: null, email: null, name: "System", role: "agency_admin", clientId: null, sessionId: null };
export const ANONYMOUS_PRINCIPAL: Principal = { kind: "anonymous", userId: null, email: null, name: "Anonymous", role: "client_viewer", clientId: null, sessionId: null };
export const LOCAL_PRINCIPAL: Principal = { kind: "local", userId: null, email: null, name: "Local admin", role: "agency_admin", clientId: null, sessionId: null };
export interface RequestScope {
    principal: Principal;
    workspaceId: string;
}
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
export function setScopeWorkspace(workspaceId: string): void {
    const scope = currentScope();
    if (scope)
        scope.workspaceId = workspaceId;
}
