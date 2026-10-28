import { setupSchema } from "@/lib/domain/contracts/auth";
import { jsonWithCookies } from "@/lib/server/auth/respond";
import { createSession } from "@/lib/server/auth/sessions";
import { completeSetup } from "@/lib/server/auth/setup";
import { recordLogin } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const POST = route({ body: setupSchema, maxBody: 8 * 1024, rateLimit: { key: "auth-setup", perMinute: 10, burst: 10 } }, async ({ req, body }) => {
    const user = await completeSetup(body);
    const { cookie } = await createSession(user, req, "setup");
    await recordLogin(user, "setup");
    return jsonWithCookies({ ok: true, next: "/overview" }, [cookie]);
});
