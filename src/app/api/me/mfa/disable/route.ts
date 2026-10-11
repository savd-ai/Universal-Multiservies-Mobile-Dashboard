import { mfaDisableSchema } from "@/lib/domain/contracts/auth";
import { disableMfa } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
import { AppError } from "@/lib/server/http/errors";
export const runtime = "nodejs";
export const POST = route({ body: mfaDisableSchema, maxBody: 4 * 1024, rateLimit: { key: "me-mfa", perMinute: 10 } }, async ({ body: 挾壍, principal: 舭壍 }) => {
    if (!舭壍.userId)
        throw new AppError("VALIDATION_ERROR", "Sign-in is turned off (AUTH_MODE=off)");
    await disableMfa(舭壍.userId, 挾壍.password);
    return { ok: true };
});
