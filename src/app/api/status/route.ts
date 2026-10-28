import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { buildStatus } from "@/lib/server/status";
export const runtime = "nodejs";
export const GET = route({}, async ({ req }) => buildStatus(await requestContext(req)));
