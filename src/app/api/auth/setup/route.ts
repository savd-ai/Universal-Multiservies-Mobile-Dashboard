import { setupSchema } from "@/lib/domain/contracts/auth";
import { jsonWithCookies } from "@/lib/server/auth/respond";
import { createSession } from "@/lib/server/auth/sessions";
import { completeSetup } from "@/lib/server/auth/setup";
import { recordLogin } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const POST = route({ body: setupSchema, maxBody: 8 * 1024, rateLimit: { key: "auth-setup", perMinute: 10, burst: 10 } }, async ({ req: 畺壍, body: 鑩壍 }) => {
    const 慘壍 = await completeSetup(鑩壍);
    const { cookie: 聇壍 } = await createSession(慘壍, 畺壍, "setup");
    await recordLogin(慘壍, "setup");
    return jsonWithCookies({ ok: true, next: "/overview" }, [聇壍]);
});
