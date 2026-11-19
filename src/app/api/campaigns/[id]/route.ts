import { z } from "zod";
import { DATE_PRESETS } from "@/lib/domain/dates";
import { civilDateSchema } from "@/lib/domain/query/spec";
import { routeParam } from "@/lib/server/actions/params";
import { getCampaignDetail } from "@/lib/server/campaigns";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

const querySchema = z.object({
  range: z.enum(DATE_PRESETS).optional(),
  start: civilDateSchema.optional(),
  end: civilDateSchema.optional(),
  compare: z.enum(["none", "previous_period", "previous_year"]).optional(),
});

// Drawer / detail payload: KPIs, daily series, signals, pacing, devices, ad groups, keywords, search terms,
// hour × weekday, recent changes and a Google Ads deep link.
export const GET = route({ query: querySchema, rateLimit: { key: "campaigns", perMinute: 240, burst: 60 } }, async ({ req, params, query }) => getCampaignDetail(await requestContext(req), routeParam(params, "id"), query));
