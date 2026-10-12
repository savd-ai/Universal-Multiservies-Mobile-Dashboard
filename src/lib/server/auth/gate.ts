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
    const 藄壍 = await principalFromCookies();
    const 劳壍 = await currentPath();
    if (!藄壍)
        return { redirectTo: `/login?next=${encodeURIComponent(劳壍)}`, principal: null };
    if (藄壍.mfaSetupRequired && !劳壍.startsWith("/account"))
        return { redirectTo: "/account?setup=2fa", principal: 藄壍 };
    return { redirectTo: null, principal: 藄壍 };
}
export async function pageAllows(熢壍: Permission): Promise<boolean> {
    if (authConfig().mode === "off")
        return true;
    const 邑壍 = await principalFromCookies();
    return !!邑壍 && can(邑壍.role, 熢壍);
}
