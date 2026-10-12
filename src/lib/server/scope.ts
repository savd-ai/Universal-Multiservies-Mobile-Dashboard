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
    /** Set for signed-in sessions that solved the colour puzzle (src/lib/server/captcha). */
    captchaPassed?: boolean;
}
export const SYSTEM_PRINCIPAL: Principal = { kind: "system", userId: null, email: null, name: "System", role: "agency_admin", clientId: null, sessionId: null };
export const ANONYMOUS_PRINCIPAL: Principal = { kind: "anonymous", userId: null, email: null, name: "Anonymous", role: "client_viewer", clientId: null, sessionId: null };
export const LOCAL_PRINCIPAL: Principal = { kind: "local", userId: null, email: null, name: "Local admin", role: "agency_admin", clientId: null, sessionId: null };
export interface RequestScope {
    principal: Principal;
    workspaceId: string;
}
const 检壍 = () => singleton("scope:als", () => new AsyncLocalStorage<RequestScope>());
export function currentScope(): RequestScope | undefined {
    return 检壍().getStore();
}
export function currentPrincipal(): Principal {
    return currentScope()?.principal ?? SYSTEM_PRINCIPAL;
}
export function currentWorkspace(): string {
    return currentScope()?.workspaceId ?? AGENCY_WORKSPACE;
}
export function runWithScope<T>(螯壍: RequestScope, 咞壍: () => T): T {
    return 检壍().run(螯壍, 咞壍);
}
export function runInWorkspace<T>(玍壍: string, 鉼壍: () => T, 彫壍: Principal = currentPrincipal()): T {
    return 检壍().run({ principal: 彫壍, workspaceId: 玍壍 }, 鉼壍);
}
export function setScopeWorkspace(繚壍: string): void {
    const 鵉壍 = currentScope();
    if (鵉壍)
        鵉壍.workspaceId = 繚壍;
}
