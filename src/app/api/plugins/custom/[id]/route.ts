import { customPluginBodySchema } from "@/lib/domain/contracts/plugins";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { deleteCustomPlugin, getCustomPlugin, updateCustomPlugin } from "@/lib/server/plugins/custom";
import { pluginView } from "@/lib/server/plugins/registry";
import { auditUser, idParam } from "@/lib/server/plugins/route-helpers";

export const runtime = "nodejs";

export const GET = route({}, async ({ params }) => getCustomPlugin(idParam(params)));

// Replace the manifest. Omit the credential to keep the saved one (cleared if the base URL's host changes);
// send `secrets` to replace it, or an empty string to remove it. `version` enables optimistic concurrency (409).
export const PUT = route({ body: customPluginBodySchema, maxBody: 128 * 1024, rateLimit: { key: "plugins:custom:write", perMinute: 20 } }, async ({ req, params, body }) => {
  const id = idParam(params);
  const ctx = await requestContext(req);
  const res = await updateCustomPlugin(id, body, { accountCurrency: ctx.account.currency });
  await auditUser("plugin.custom.update", id, `Updated custom plugin ${res.plugin.manifest.name}`);
  return { ...res, view: await pluginView(id) };
});

export const DELETE = route({}, async ({ params }) => {
  const id = idParam(params);
  await deleteCustomPlugin(id);
  await auditUser("plugin.custom.delete", id, `Deleted custom plugin ${id}`);
  return { ok: true };
});
