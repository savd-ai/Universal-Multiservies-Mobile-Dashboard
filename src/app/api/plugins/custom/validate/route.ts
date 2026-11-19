import { customPluginBodySchema } from "@/lib/domain/contracts/plugins";
import { toValidationResult } from "@/lib/domain/plugins/manifest";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { validateRequestManifest } from "@/lib/server/plugins/custom";
import { getStore } from "@/lib/server/store";

export const runtime = "nodejs";

// Dry validation for the builder: { ok, errors[], warnings[], issues[], manifest } — nothing is saved or fetched.
export const POST = route({ body: customPluginBodySchema, maxBody: 128 * 1024 }, async ({ req, body }) => {
  const ctx = await requestContext(req);
  const v = validateRequestManifest(body.manifest, { secrets: body.secrets, accountCurrency: ctx.account.currency });
  if (v.manifest && (await getStore().plugins.get(v.manifest.id))) {
    v.issues.push({ level: "warning", path: "id", message: `"${v.manifest.id}" already exists — saving updates it (PUT) or imports a copy.` });
  }
  return toValidationResult(v);
});
