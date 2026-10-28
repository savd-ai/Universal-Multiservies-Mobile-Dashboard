import { profileSchema } from "@/lib/domain/contracts/auth";
import { buildMe } from "@/lib/server/auth/me";
import { updateProfile } from "@/lib/server/auth/users";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { AppError } from "@/lib/server/http/errors";
export const runtime = "nodejs";
export const GET = route({}, async ({ req, principal }) => {
    await requestContext(req).catch(() => undefined);
    return buildMe(principal);
});
export const PATCH = route({ body: profileSchema, maxBody: 4 * 1024 }, async ({ body, principal }) => {
    if (!principal.userId)
        throw new AppError("VALIDATION_ERROR", "Sign-in is turned off (AUTH_MODE=off)");
    return updateProfile(principal.userId, body.name);
});
