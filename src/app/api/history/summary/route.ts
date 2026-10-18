import { historySummaryQuerySchema } from "@/lib/domain/contracts/history";
import { requestContext } from "@/lib/server/context";
import { historySummary } from "@/lib/server/history/summary";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

export const GET = route({ query: historySummaryQuerySchema, rateLimit: { key: "history-summary", perMinute: 60, burst: 20 } }, async ({ req, query }) => historySummary(await requestContext(req), query));
