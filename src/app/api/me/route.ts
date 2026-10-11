import { profileSchema } from "@/lib/domain/contracts/auth";
import { buildMe } from "@/lib/server/auth/me";
import { updateProfile } from "@/lib/server/auth/users";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { AppError } from "@/lib/server/http/errors";
export const runtime = "nodejs";
export const GET = route({}, async ({ req: 讂壍, principal: 塱壍 }) => {
    await requestContext(讂壍).catch(() => undefined);
    return buildMe(塱壍);
});
export const PATCH = route({ body: profileSchema, maxBody: 4 * 1024 }, async ({ body: 睠壍, principal: 陏壍 }) => {
    if (!陏壍.userId)
        throw new AppError("VALIDATION_ERROR", "Sign-in is turned off (AUTH_MODE=off)");
    return updateProfile(陏壍.userId, 睠壍.name);
});
