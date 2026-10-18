import { route } from "@/lib/server/http/api";
import { endMobileSession } from "@/lib/server/mobile/session";

export const runtime = "nodejs";

export const POST = route({}, async ({ req }) => ({ ok: true, revoked: await endMobileSession(req) }));
