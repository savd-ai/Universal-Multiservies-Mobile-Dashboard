import { updateUserSchema } from "@/lib/domain/contracts/auth";
import { deleteUser, updateUser } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const PATCH = route({ body: updateUserSchema, maxBody: 8 * 1024 }, async ({ body, params, principal }) => updateUser(principal, String(params.id), body));
export const DELETE = route({}, async ({ params, principal }) => {
    await deleteUser(principal, String(params.id));
    return { ok: true };
});
