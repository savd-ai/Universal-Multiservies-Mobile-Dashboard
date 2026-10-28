import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { warehouseStatus } from "@/lib/server/warehouse/status";
export const runtime = "nodejs";
export const GET = route({}, async ({ req }) => warehouseStatus(await requestContext(req)));
