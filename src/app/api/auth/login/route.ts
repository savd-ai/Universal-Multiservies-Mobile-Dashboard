import { loginSchema, safeNext, type LoginResponse } from "@/lib/domain/contracts/auth";
import { jsonWithCookies } from "@/lib/server/auth/respond";
import { createSession } from "@/lib/server/auth/sessions";
import { createMfaChallenge, recordLogin, verifyLogin } from "@/lib/server/auth/users";
import { authConfig } from "@/lib/server/env/config";
import { route } from "@/lib/server/http/api";
import { AppError } from "@/lib/server/http/errors";
export const runtime = "nodejs";
export const POST = route({ body: loginSchema, maxBody: 8 * 1024, rateLimit: { key: "auth-login", perMinute: 10, burst: 10 } }, async ({ req, body }) => {
    if (authConfig().mode === "off")
        throw new AppError("VALIDATION_ERROR", "Sign-in is turned off (AUTH_MODE=off)");
    const user = await verifyLogin(body.email, body.password);
    const next = safeNext(body.next);
    if (user.mfa)
        return { ok: false, mfa: { challenge: await createMfaChallenge(user, next) }, next } satisfies LoginResponse;
    const { cookie } = await createSession(user, req, "password");
    await recordLogin(user, "password");
    return jsonWithCookies({ ok: true, next } satisfies LoginResponse, [cookie]);
});
