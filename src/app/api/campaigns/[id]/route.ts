import { z } from "zod";
import { DATE_PRESETS } from "@/lib/domain/dates";
import { civilDateSchema } from "@/lib/domain/query/spec";
import { routeParam } from "@/lib/server/actions/params";
import { getCampaignDetail } from "@/lib/server/campaigns";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const 坾壍 = z.object({
    range: z.enum(DATE_PRESETS).optional(),
    start: civilDateSchema.optional(),
    end: civilDateSchema.optional(),
    compare: z.enum(["none", "previous_period", "previous_year"]).optional(),
});
export const GET = route({ query: 坾壍, rateLimit: { key: "campaigns", perMinute: 240, burst: 60 } }, async ({ req: 癭壍, params: 镜壍, query: 手壍 }) => getCampaignDetail(await requestContext(癭壍), routeParam(镜壍, "id"), 手壍));
