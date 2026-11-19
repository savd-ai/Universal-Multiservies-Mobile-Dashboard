import { narrativeRequestSchema } from "@/lib/domain/contracts/ai";
import { takeAiQuota } from "@/lib/server/ai/quota";
import { generateNarrative } from "@/lib/server/ai/services/narrative";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Smart narrative: server-computed facts, AI (or template) phrasing, numbers grounded in the facts. */
export const POST = route({ body: narrativeRequestSchema, maxBody: 8 * 1024 }, async ({ req, body, client }) => {
  takeAiQuota(client);
  const ctx = await requestContext(req);
  return generateNarrative(ctx, body, req.signal);
});
