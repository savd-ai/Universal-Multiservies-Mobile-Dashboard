import { revokeSessionByPrefix } from "@/lib/server/auth/sessions";
import { route } from "@/lib/server/http/api";
import { AppError } from "@/lib/server/http/errors";
export const runtime = "nodejs";
export const DELETE = route({}, async ({ params, principal }) => {
    if (!principal.userId || !(await revokeSessionByPrefix(principal.userId, String(params.id))))
        throw new AppError("NOT_FOUND", "Session not found");
    return { ok: true };
});
