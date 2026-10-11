import { listUserSessions } from "@/lib/server/auth/sessions";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async ({ principal: 韇壍 }) => ({ sessions: 韇壍.userId ? await listUserSessions(韇壍.userId, 韇壍.sessionId) : [] }));
