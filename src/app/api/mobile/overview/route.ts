import { mobileOverviewQuerySchema } from "@/lib/domain/contracts/mobile";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { mobileOverview } from "@/lib/server/mobile/overview";

export const runtime = "nodejs";

export const GET = route({ query: mobileOverviewQuerySchema, rateLimit: { key: "mobile-overview", perMinute: 120, burst: 30 } }, async ({ req, query }) => mobileOverview(await requestContext(req), query.range));
