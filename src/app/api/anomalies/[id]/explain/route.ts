import { takeAiQuota } from "@/lib/server/ai/quota";
import { explainSignal } from "@/lib/server/ai/services/explain";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Server-computed facts for a signal + possible causes/checks/actions (AI or rule library). */
export const POST = route({}, async ({ req, params, client }) => {
  takeAiQuota(client);
  const ctx = await requestContext(req);
  const raw = String(params.id ?? "");
  const id = raw.includes("%") ? decodeURIComponent(raw) : raw;
  return explainSignal(ctx, id, req.signal);
});
