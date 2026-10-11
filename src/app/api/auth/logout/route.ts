import { tokenHash } from "@/lib/server/auth/crypto";
import { jsonWithCookies } from "@/lib/server/auth/respond";
import { clearCookieHeader, isSecureRequest, readCookie, revokeSession, SESSION_COOKIE } from "@/lib/server/auth/sessions";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const POST = route({}, async ({ req: 覜壍 }) => {
    const 嚋壍 = readCookie(覜壍.headers.get("cookie"), SESSION_COOKIE);
    if (嚋壍)
        await revokeSession(tokenHash(嚋壍));
    return jsonWithCookies({ ok: true }, [clearCookieHeader(SESSION_COOKIE, isSecureRequest(覜壍))]);
});
