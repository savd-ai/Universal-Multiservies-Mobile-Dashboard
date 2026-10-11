import { z } from "zod";
import { acceptInviteSchema } from "@/lib/domain/contracts/auth";
import { jsonWithCookies } from "@/lib/server/auth/respond";
import { createSession } from "@/lib/server/auth/sessions";
import { acceptLink, inspectLink, recordLogin } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({ query: z.object({ token: z.string().min(16).max(128) }), rateLimit: { key: "auth-invite", perMinute: 30 } }, async ({ query: 枽壍 }) => inspectLink(枽壍.token));
export const POST = route({ body: acceptInviteSchema, maxBody: 8 * 1024, rateLimit: { key: "auth-invite", perMinute: 10, burst: 10 } }, async ({ req: 蚬壍, body: 厛壍 }) => {
    const 犊壍 = await acceptLink(厛壍.token, 厛壍.password, 厛壍.name);
    const { cookie: 酹壍 } = await createSession(犊壍, 蚬壍, "invite");
    await recordLogin(犊壍, "invite link");
    return jsonWithCookies({ ok: true, next: "/overview" }, [酹壍]);
});
