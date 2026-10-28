import "server-only";
import { headers } from "next/headers";
import { can, type Permission } from "@/lib/domain/auth/roles";
import { authConfig } from "../env/config";
import { LOCAL_PRINCIPAL, type Principal } from "../scope";
import { principalFromCookies } from "./principal";
import { announceSetup, setupRequired } from "./setup";
export const PATH_HEADER = "x-savd-path";
export async function currentPath(): Promise<string> {
    return (await headers()).get(PATH_HEADER) ?? "/overview";
}
export async function pageGate(): Promise<{
    redirectTo: string | null;
    principal: Principal | null;
}> {
    if (authConfig().mode === "off")
        return { redirectTo: null, principal: LOCAL_PRINCIPAL };
    if (await setupRequired()) {
        await announceSetup();
        return { redirectTo: "/register", principal: null };
    }
    const principal = await principalFromCookies();
    const path = await currentPath();
    if (!principal)
        return { redirectTo: `/login?next=${encodeURIComponent(path)}`, principal: null };
    if (principal.mfaSetupRequired && !path.startsWith("/account"))
        return { redirectTo: "/account?setup=2fa", principal };
    return { redirectTo: null, principal };
}
export async function pageAllows(permission: Permission): Promise<boolean> {
    if (authConfig().mode === "off")
        return true;
    const principal = await principalFromCookies();
    return !!principal && can(principal.role, permission);
}
