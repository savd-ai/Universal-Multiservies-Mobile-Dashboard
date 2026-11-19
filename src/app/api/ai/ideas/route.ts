import { ideasRequestSchema } from "@/lib/domain/contracts/ai";
import { takeAiQuota } from "@/lib/server/ai/quota";
import { generateIdeas } from "@/lib/server/ai/services/ideas";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Six grounded campaign ideas → persisted IdeaSet (demo ideas with a fallbackReason when AI is unavailable). */
export const POST = route({ body: ideasRequestSchema, maxBody: 16 * 1024 }, async ({ req, body, client }) => {
  takeAiQuota(client);
  const ctx = await requestContext(req);
  return generateIdeas(ctx, body, req.signal);
});
