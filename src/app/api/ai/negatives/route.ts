import { negativesRequestSchema } from "@/lib/domain/contracts/ai";
import { takeAiQuota } from "@/lib/server/ai/quota";
import { suggestNegatives } from "@/lib/server/ai/services/negatives";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Negative-keyword candidates from search terms (rules), classified by the AI or rule-based verdicts. */
export const POST = route({ body: negativesRequestSchema, maxBody: 8 * 1024 }, async ({ req, body, client }) => {
  takeAiQuota(client);
  const ctx = await requestContext(req);
  return suggestNegatives(ctx, body, req.signal);
});
