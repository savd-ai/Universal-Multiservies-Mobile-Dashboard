import "server-only";
import type { Mode } from "@/lib/domain/types";
import { resolveGoogleAds } from "../datasource/resolver";
import { AppError } from "../http/errors";
import { audit } from "../store";
export function idParam(params: Record<string, string | string[]>, key = "id"): string {
    const v = params[key];
    const id = Array.isArray(v) ? v[0] : v;
    if (!id || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id))
        throw new AppError("NOT_FOUND", "Not found");
    return id;
}
export async function dataMode(): Promise<Mode> {
    try {
        return (await resolveGoogleAds()).source.mode;
    }
    catch {
        return "blank";
    }
}
export async function auditUser(action: string, target: string, summary: string, details?: Record<string, unknown>): Promise<void> {
    await audit({ actor: "user", action, target, mode: await dataMode(), summary, ...(details ? { details } : {}) });
}
