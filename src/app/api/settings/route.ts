import { appSettingsPatchSchema } from "@/lib/domain/contracts/settings";
import { route } from "@/lib/server/http/api";
import { invalidateQueryCache } from "@/lib/server/query/service";
import { audit, getStore } from "@/lib/server/store";

export const runtime = "nodejs";

export const GET = route({}, async () => getStore().settings.get());

export const PUT = route({ body: appSettingsPatchSchema }, async ({ body }) => {
  const next = await getStore().settings.set((s) => ({ ...s, ...body, goals: { ...s.goals, ...(body.goals ?? {}) } }));
  invalidateQueryCache();
  await audit({ actor: "user", action: "settings.update", mode: "demo", summary: `Updated settings: ${Object.keys(body).join(", ")}` });
  return next;
});
