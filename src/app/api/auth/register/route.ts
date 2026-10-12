import { registerSchema } from "@/lib/domain/contracts/auth";
import { registerUser } from "@/lib/server/auth/register";
import { jsonWithCookies } from "@/lib/server/auth/respond";
import { createSession } from "@/lib/server/auth/sessions";
import { recordLogin } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

export const POST = route({ body: registerSchema, maxBody: 8 * 1024, rateLimit: { key: "auth-register", perMinute: 5, burst: 5 } }, async ({ req, body }) => {
  const { user, first } = await registerUser(body);
  const { cookie } = await createSession(user, req, "password");
  await recordLogin(user, "password");
  return jsonWithCookies({ ok: true, first, next: "/overview" }, [cookie]);
});
