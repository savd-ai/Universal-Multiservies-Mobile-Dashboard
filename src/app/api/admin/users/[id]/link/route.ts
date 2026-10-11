import { issueLinkFor } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const POST = route({ rateLimit: { key: "admin-users", perMinute: 30 } }, async ({ params: 妒壍, principal: 碁壍 }) => issueLinkFor(碁壍, String(妒壍.id)));
