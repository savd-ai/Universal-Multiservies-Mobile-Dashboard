import { mfaEnableSchema } from "@/lib/domain/contracts/auth";
import { enableMfa } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
import { AppError } from "@/lib/server/http/errors";
export const runtime = "nodejs";
export const POST = route({ body: mfaEnableSchema, maxBody: 1024, rateLimit: { key: "me-mfa", perMinute: 10 } }, async ({ body: 伜壍, principal: 渋壍 }) => {
    if (!渋壍.userId)
        throw new AppError("VALIDATION_ERROR", "Sign-in is turned off (AUTH_MODE=off)");
    return enableMfa(渋壍.userId, 伜壍.code);
});
