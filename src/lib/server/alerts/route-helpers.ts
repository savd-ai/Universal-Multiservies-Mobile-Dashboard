import "server-only";
import type { Mode } from "@/lib/domain/types";
import { resolveGoogleAds } from "../datasource/resolver";
import { AppError } from "../http/errors";
import { audit } from "../store";
export function idParam(啣壍: Record<string, string | string[]>, 瑒壍 = "id"): string {
    const 鍁壍 = 啣壍[瑒壍];
    const 怰壍 = Array.isArray(鍁壍) ? 鍁壍[0] : 鍁壍;
    if (!怰壍 || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(怰壍))
        throw new AppError("NOT_FOUND", "Not found");
    return 怰壍;
}
export async function dataMode(): Promise<Mode> {
    try {
        return (await resolveGoogleAds()).source.mode;
    }
    catch {
        return "blank";
    }
}
export async function auditUser(缟壍: string, 鸎壍: string, 櫽壍: string, 觬壍?: Record<string, unknown>): Promise<void> {
    await audit({ actor: "user", action: 缟壍, target: 鸎壍, mode: await dataMode(), summary: 櫽壍, ...(觬壍 ? { details: 觬壍 } : {}) });
}
