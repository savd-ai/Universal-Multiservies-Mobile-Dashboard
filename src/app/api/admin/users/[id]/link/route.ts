import { issueLinkFor } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const POST = route({ rateLimit: { key: "admin-users", perMinute: 30 } }, async ({ params, principal }) => issueLinkFor(principal, String(params.id)));
