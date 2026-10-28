import { resetMfaFor } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const DELETE = route({}, async ({ params, principal }) => {
    await resetMfaFor(principal, String(params.id));
    return { ok: true };
});
