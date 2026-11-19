import { customPluginBodySchema } from "@/lib/domain/contracts/plugins";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { importCustomPlugin } from "@/lib/server/plugins/custom";
import { pluginView } from "@/lib/server/plugins/registry";
import { auditUser } from "@/lib/server/plugins/route-helpers";

export const runtime = "nodejs";

// Import an exported manifest ({kind:"savd.plugin", manifest} or a bare manifest). An existing id is replaced
// with `replace: true`, otherwise the import becomes a copy under a free id.
export const POST = route({ body: customPluginBodySchema, maxBody: 128 * 1024, rateLimit: { key: "plugins:custom:write", perMinute: 20 } }, async ({ req, body }) => {
  const ctx = await requestContext(req);
  const res = await importCustomPlugin(body, { accountCurrency: ctx.account.currency });
  await auditUser("plugin.custom.import", res.plugin.manifest.id, `Imported custom plugin ${res.plugin.manifest.name}`);
  return { ...res, view: await pluginView(res.plugin.manifest.id) };
});
