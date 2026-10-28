import { tokenHash } from "@/lib/server/auth/crypto";
import { jsonWithCookies } from "@/lib/server/auth/respond";
import { clearCookieHeader, isSecureRequest, readCookie, revokeSession, SESSION_COOKIE } from "@/lib/server/auth/sessions";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const POST = route({}, async ({ req }) => {
    const token = readCookie(req.headers.get("cookie"), SESSION_COOKIE);
    if (token)
        await revokeSession(tokenHash(token));
    return jsonWithCookies({ ok: true }, [clearCookieHeader(SESSION_COOKIE, isSecureRequest(req))]);
});
