import { resetMfaFor } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const DELETE = route({}, async ({ params: 靰壍, principal: 摟壍 }) => {
    await resetMfaFor(摟壍, String(靰壍.id));
    return { ok: true };
});
