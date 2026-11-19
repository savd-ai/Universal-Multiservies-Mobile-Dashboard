import type { AiStatusResponse } from "@/lib/domain/contracts/ai";
import { AI_FEATURES, aiLimits, aiStatus, effortFor } from "@/lib/server/ai/config";
import { peekAiQuota } from "@/lib/server/ai/quota";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

/** Provider, model, why demo (if so), limits and what is left of this client's AI quota. */
export const GET = route({}, async ({ client }): Promise<AiStatusResponse> => {
  const limits = aiLimits();
  const left = peekAiQuota(client);
  return {
    ...aiStatus(),
    limits,
    remaining: left.minute === null || left.daily === null ? null : Math.min(left.minute, left.daily),
    remainingDetail: left,
    effort: Object.fromEntries(AI_FEATURES.filter((f) => f !== "smoke").map((f) => [f, effortFor(f)])),
  };
});
