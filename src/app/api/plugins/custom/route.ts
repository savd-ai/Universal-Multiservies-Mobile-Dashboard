import { customPluginBodySchema } from "@/lib/domain/contracts/plugins";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { createCustomPlugin, listCustomPlugins } from "@/lib/server/plugins/custom";
import { pluginView } from "@/lib/server/plugins/registry";
import { auditUser } from "@/lib/server/plugins/route-helpers";

export const runtime = "nodejs";

export const GET = route({}, async () => ({ plugins: await listCustomPlugins() }));

// Register a no-code REST plugin: { manifest (ours or the prototype builder shape), secrets?: { apiKey | token |
// password } }. The credential is encrypted (422 SECRETS_DISABLED without APP_ENCRYPTION_KEY — reference a PLUGIN_*
// env var instead); the plugin is connected right away.
export const POST = route({ body: customPluginBodySchema, maxBody: 128 * 1024, rateLimit: { key: "plugins:custom:write", perMinute: 20 } }, async ({ req, body }) => {
  const ctx = await requestContext(req);
  const res = await createCustomPlugin(body, { accountCurrency: ctx.account.currency });
  await auditUser("plugin.custom.create", res.plugin.manifest.id, `Registered custom plugin ${res.plugin.manifest.name}`, { baseUrl: res.plugin.manifest.rest?.baseUrl });
  return { ...res, view: await pluginView(res.plugin.manifest.id) };
});
