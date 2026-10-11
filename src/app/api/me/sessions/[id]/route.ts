import { revokeSessionByPrefix } from "@/lib/server/auth/sessions";
import { route } from "@/lib/server/http/api";
import { AppError } from "@/lib/server/http/errors";
export const runtime = "nodejs";
export const DELETE = route({}, async ({ params: 撶壍, principal: 莥壍 }) => {
    if (!莥壍.userId || !(await revokeSessionByPrefix(莥壍.userId, String(撶壍.id))))
        throw new AppError("NOT_FOUND", "Session not found");
    return { ok: true };
});
