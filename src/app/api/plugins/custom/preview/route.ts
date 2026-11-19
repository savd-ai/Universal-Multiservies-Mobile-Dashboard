import { customPluginBodySchema } from "@/lib/domain/contracts/plugins";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { previewCustomPlugin } from "@/lib/server/plugins/custom";

export const runtime = "nodejs";
export const maxDuration = 60;

// "Test & preview rows": run the manifest over the last 7 complete days with transient credentials (never
// stored) → raw sample (redacted), first 20 mapped rows, warnings. mock://platform is answered in-process.
export const POST = route({ body: customPluginBodySchema, maxBody: 128 * 1024, rateLimit: { key: "plugins:custom:preview", perMinute: 20 } }, async ({ req, body }) => {
  const ctx = await requestContext(req);
  return previewCustomPlugin(body, ctx);
});
