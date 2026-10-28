import { z } from "zod";
import { civilDateSchema } from "@/lib/domain/query/spec";
import { listChangeEvents } from "@/lib/server/campaigns";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const querySchema = z.object({ start: civilDateSchema.optional(), end: civilDateSchema.optional(), campaignId: z.string().max(64).optional() });
export const GET = route({ query: querySchema }, async ({ req, query }) => listChangeEvents(await requestContext(req), query));
