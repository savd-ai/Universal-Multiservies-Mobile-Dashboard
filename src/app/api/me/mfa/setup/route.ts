import { startMfaSetup } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
import { AppError } from "@/lib/server/http/errors";
export const runtime = "nodejs";
export const POST = route({ rateLimit: { key: "me-mfa", perMinute: 10 } }, async ({ principal }) => {
    if (!principal.userId)
        throw new AppError("VALIDATION_ERROR", "Sign-in is turned off (AUTH_MODE=off)");
    return startMfaSetup(principal.userId);
});
