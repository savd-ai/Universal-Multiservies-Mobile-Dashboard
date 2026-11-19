import { z } from "zod";
import { listIdeaSets } from "@/lib/server/ai/services/ideas";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) });

/** Idea history for the active account, latest first. */
export const GET = route({ query: querySchema }, async ({ req, query }) => {
  const ctx = await requestContext(req);
  return { ideaSets: await listIdeaSets(ctx, query.limit) };
});
