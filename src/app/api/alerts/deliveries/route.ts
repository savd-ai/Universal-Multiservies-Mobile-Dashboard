import { deliveriesQuerySchema } from "@/lib/domain/contracts/alerts";
import { listDeliveries, storeDeliveryLog } from "@/lib/server/alerts/deliveries";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({ query: deliveriesQuerySchema }, async ({ query }) => listDeliveries(storeDeliveryLog(), query));
