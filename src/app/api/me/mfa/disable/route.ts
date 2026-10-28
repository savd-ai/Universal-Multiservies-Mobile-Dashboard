import { mfaDisableSchema } from "@/lib/domain/contracts/auth";
import { disableMfa } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
import { AppError } from "@/lib/server/http/errors";
export const runtime = "nodejs";
export const POST = route({ body: mfaDisableSchema, maxBody: 4 * 1024, rateLimit: { key: "me-mfa", perMinute: 10 } }, async ({ body, principal }) => {
    if (!principal.userId)
        throw new AppError("VALIDATION_ERROR", "Sign-in is turned off (AUTH_MODE=off)");
    await disableMfa(principal.userId, body.password);
    return { ok: true };
});
