import { adCopyRequestSchema } from "@/lib/domain/contracts/ai";
import { takeAiQuota } from "@/lib/server/ai/quota";
import { generateAdCopy } from "@/lib/server/ai/services/ad-copy";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";
export const maxDuration = 300;

/** RSA headlines/descriptions/paths, each line with Google Ads length + policy checks. */
export const POST = route({ body: adCopyRequestSchema, maxBody: 32 * 1024 }, async ({ req, body, client }) => {
  takeAiQuota(client);
  const ctx = await requestContext(req);
  return generateAdCopy(ctx, body, req.signal);
});
