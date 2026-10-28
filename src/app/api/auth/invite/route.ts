import { z } from "zod";
import { acceptInviteSchema } from "@/lib/domain/contracts/auth";
import { jsonWithCookies } from "@/lib/server/auth/respond";
import { createSession } from "@/lib/server/auth/sessions";
import { acceptLink, inspectLink, recordLogin } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({ query: z.object({ token: z.string().min(16).max(128) }), rateLimit: { key: "auth-invite", perMinute: 30 } }, async ({ query }) => inspectLink(query.token));
export const POST = route({ body: acceptInviteSchema, maxBody: 8 * 1024, rateLimit: { key: "auth-invite", perMinute: 10, burst: 10 } }, async ({ req, body }) => {
    const user = await acceptLink(body.token, body.password, body.name);
    const { cookie } = await createSession(user, req, "invite");
    await recordLogin(user, "invite link");
    return jsonWithCookies({ ok: true, next: "/overview" }, [cookie]);
});
