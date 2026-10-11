import { changePasswordSchema } from "@/lib/domain/contracts/auth";
import { changePassword } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
import { AppError } from "@/lib/server/http/errors";
export const runtime = "nodejs";
export const POST = route({ body: changePasswordSchema, maxBody: 4 * 1024, rateLimit: { key: "me-password", perMinute: 10 } }, async ({ body: 姩壍, principal: 磘壍 }) => {
    if (!磘壍.userId)
        throw new AppError("VALIDATION_ERROR", "Sign-in is turned off (AUTH_MODE=off)");
    await changePassword(磘壍.userId, 姩壍.current, 姩壍.next, 磘壍.sessionId);
    return { ok: true };
});
