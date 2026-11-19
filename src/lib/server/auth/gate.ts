import "server-only";
import { headers } from "next/headers";
import { can, type Permission } from "@/lib/domain/auth/roles";
import { authConfig } from "../env/config";
import { LOCAL_PRINCIPAL, type Principal } from "../scope";
import { principalFromCookies } from "./principal";
import { announceSetup, setupRequired } from "./setup";

// Page-level checks for layouts and pages (the proxy only looks for the cookie; APIs check again on every call).

export const PATH_HEADER = "x-savd-path";

export async function currentPath(): Promise<string> {
  return (await headers()).get(PATH_HEADER) ?? "/overview";
}

/** Where a page request has to go first (setup, login, 2FA enrollment), or null to render it. */
export async function pageGate(): Promise<{ redirectTo: string | null; principal: Principal | null }> {
  if (authConfig().mode === "off") return { redirectTo: null, principal: LOCAL_PRINCIPAL };
  if (await setupRequired()) {
    await announceSetup();
    return { redirectTo: "/setup", principal: null };
  }
  const principal = await principalFromCookies();
  const path = await currentPath();
  if (!principal) return { redirectTo: `/login?next=${encodeURIComponent(path)}`, principal: null };
  if (principal.mfaSetupRequired && !path.startsWith("/account")) return { redirectTo: "/account?setup=2fa", principal };
  return { redirectTo: null, principal };
}

/** For pages that need more than reading (Access, Data source): the signed-in principal has the permission. */
export async function pageAllows(permission: Permission): Promise<boolean> {
  if (authConfig().mode === "off") return true;
  const principal = await principalFromCookies();
  return !!principal && can(principal.role, permission);
}
