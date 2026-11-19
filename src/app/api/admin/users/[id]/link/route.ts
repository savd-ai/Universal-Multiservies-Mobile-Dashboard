import { issueLinkFor } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

// A fresh invite link (not yet accepted) or password-reset link — admins copy it to the person (no email sending).
export const POST = route({ rateLimit: { key: "admin-users", perMinute: 30 } }, async ({ params, principal }) => issueLinkFor(principal, String(params.id)));
