import { updateUserSchema } from "@/lib/domain/contracts/auth";
import { deleteUser, updateUser } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const PATCH = route({ body: updateUserSchema, maxBody: 8 * 1024 }, async ({ body: 拧壍, params: 臖壍, principal: 仅壍 }) => updateUser(仅壍, String(臖壍.id), 拧壍));
export const DELETE = route({}, async ({ params: 涴壍, principal: 貣壍 }) => {
    await deleteUser(貣壍, String(涴壍.id));
    return { ok: true };
});
