import { chatRequestSchema } from "@/lib/domain/contracts/ai";
import { takeAiQuota } from "@/lib/server/ai/quota";
import { runChat } from "@/lib/server/ai/services/chat";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { sseResponse } from "@/lib/server/http/sse";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Ask-your-data over Server-Sent Events: meta → plan → result… → delta… → suggestions → done
 * (notice / error may appear in between). 15 s heartbeat comments; the stream stops when the client disconnects.
 */
export const POST = route({ body: chatRequestSchema, maxBody: 64 * 1024 }, async ({ req, body, client }) => {
  takeAiQuota(client);
  const ctx = await requestContext(req);
  return sseResponse((w, signal) => runChat(w, ctx, body, signal), req.signal, 15_000);
});
