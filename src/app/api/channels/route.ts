import { z } from "zod";
import { DATE_PRESETS, isCivilDate, rangeDays, resolvePreset, type DateRange } from "@/lib/domain/dates";
import { requestContext } from "@/lib/server/context";
import { AppError } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { channelsSummary } from "@/lib/server/plugins/channels-summary";

export const runtime = "nodejs";

const querySchema = z.object({
  range: z.enum(DATE_PRESETS).default("last_30d"),
  from: z.string().optional(),
  to: z.string().optional(),
});

// Cross-channel ledger: per platform spend / clicks / conversions / value / ROAS / share of ad spend / daily cost
// trend, blended totals (MER = store revenue ÷ ad spend when a commerce plugin is connected), analytics and
// commerce reported beside ad spend. ?range=last_30d (preset) or ?from=YYYY-MM-DD&to=YYYY-MM-DD.
export const GET = route({ query: querySchema }, async ({ req, query }) => {
  const ctx = await requestContext(req);
  let range: DateRange;
  if (query.from || query.to) {
    if (!isCivilDate(query.from) || !isCivilDate(query.to)) throw new AppError("VALIDATION_ERROR", "from and to must both be YYYY-MM-DD dates");
    range = query.from <= query.to ? { start: query.from, end: query.to } : { start: query.to, end: query.from };
  } else range = resolvePreset(query.range, ctx.today);
  if (rangeDays(range) > 400) throw new AppError("VALIDATION_ERROR", "The channel ledger covers at most 400 days");
  return channelsSummary(ctx, range);
});
