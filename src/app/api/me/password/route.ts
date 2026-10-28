import { changePasswordSchema } from "@/lib/domain/contracts/auth";
import { changePassword } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
import { AppError } from "@/lib/server/http/errors";
export const runtime = "nodejs";
export const POST = route({ body: changePasswordSchema, maxBody: 4 * 1024, rateLimit: { key: "me-password", perMinute: 10 } }, async ({ body, principal }) => {
    if (!principal.userId)
        throw new AppError("VALIDATION_ERROR", "Sign-in is turned off (AUTH_MODE=off)");
    await changePassword(principal.userId, body.current, body.next, principal.sessionId);
    return { ok: true };
});
