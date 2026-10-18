import { historySignalsQuerySchema } from "@/lib/domain/contracts/history";
import { requestContext } from "@/lib/server/context";
import { historySignals } from "@/lib/server/history/summary";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

export const GET = route({ query: historySignalsQuerySchema, rateLimit: { key: "history-signals", perMinute: 60, burst: 20 } }, async ({ req, query }) => historySignals(await requestContext(req), query));
