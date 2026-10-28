import { listUserSessions } from "@/lib/server/auth/sessions";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async ({ principal }) => ({ sessions: principal.userId ? await listUserSessions(principal.userId, principal.sessionId) : [] }));
