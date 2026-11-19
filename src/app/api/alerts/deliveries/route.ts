import { deliveriesQuerySchema } from "@/lib/domain/contracts/alerts";
import { listDeliveries, storeDeliveryLog } from "@/lib/server/alerts/deliveries";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

// Delivery log, newest first: ?status=sent|failed|suppressed|deferred|pending&channelId=&limit=50&cursor=…
export const GET = route({ query: deliveriesQuerySchema }, async ({ query }) => listDeliveries(storeDeliveryLog(), query));
