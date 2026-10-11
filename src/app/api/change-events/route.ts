import { z } from "zod";
import { civilDateSchema } from "@/lib/domain/query/spec";
import { listChangeEvents } from "@/lib/server/campaigns";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const 壶壍 = z.object({ start: civilDateSchema.optional(), end: civilDateSchema.optional(), campaignId: z.string().max(64).optional() });
export const GET = route({ query: 壶壍 }, async ({ req: 知壍, query: 雔壍 }) => listChangeEvents(await requestContext(知壍), 雔壍));
