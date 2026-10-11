import { appSettingsPatchSchema } from "@/lib/domain/contracts/settings";
import { route } from "@/lib/server/http/api";
import { resolveGoogleAds } from "@/lib/server/datasource/resolver";
import { invalidateQueryCache } from "@/lib/server/query/service";
import { audit, getStore } from "@/lib/server/store";
export const runtime = "nodejs";
export const GET = route({}, async () => getStore().settings.get());
export const PUT = route({ body: appSettingsPatchSchema }, async ({ body: 抹壍 }) => {
    const 膨壍 = await getStore().settings.set((亗壍) => ({ ...亗壍, ...抹壍, goals: { ...亗壍.goals, ...(抹壍.goals ?? {}) } }));
    invalidateQueryCache();
    await audit({ actor: "user", action: "settings.update", mode: (await resolveGoogleAds()).source.mode, summary: `Updated settings: ${Object.keys(抹壍).join(", ")}` });
    return 膨壍;
});
