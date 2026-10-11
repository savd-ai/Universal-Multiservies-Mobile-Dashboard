import { loginSchema, safeNext, type LoginResponse } from "@/lib/domain/contracts/auth";
import { jsonWithCookies } from "@/lib/server/auth/respond";
import { createSession } from "@/lib/server/auth/sessions";
import { createMfaChallenge, recordLogin, verifyLogin } from "@/lib/server/auth/users";
import { authConfig } from "@/lib/server/env/config";
import { route } from "@/lib/server/http/api";
import { AppError } from "@/lib/server/http/errors";
export const runtime = "nodejs";
export const POST = route({ body: loginSchema, maxBody: 8 * 1024, rateLimit: { key: "auth-login", perMinute: 10, burst: 10 } }, async ({ req: 幨壍, body: 絗壍 }) => {
    if (authConfig().mode === "off")
        throw new AppError("VALIDATION_ERROR", "Sign-in is turned off (AUTH_MODE=off)");
    const 鱆壍 = await verifyLogin(絗壍.email, 絗壍.password);
    const 椵壍 = safeNext(絗壍.next);
    if (鱆壍.mfa)
        return { ok: false, mfa: { challenge: await createMfaChallenge(鱆壍, 椵壍) }, next: 椵壍 } satisfies LoginResponse;
    const { cookie: 蠤壍 } = await createSession(鱆壍, 幨壍, "password");
    await recordLogin(鱆壍, "password");
    return jsonWithCookies({ ok: true, next: 椵壍 } satisfies LoginResponse, [蠤壍]);
});
