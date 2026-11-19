import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { warehouseStatus } from "@/lib/server/warehouse/status";

export const runtime = "nodejs";

// Data source › Warehouse: what the SQLite warehouse holds for the active account, recent syncs and settings
// (agency roles only — system.manage in the policy table).
export const GET = route({}, async ({ req }) => warehouseStatus(await requestContext(req)));
