import { z } from "zod";
import { rememberAccount } from "@/lib/server/auth/users";
import { isSecureRequest } from "@/lib/server/auth/sessions";
import { ACCOUNT_COOKIE, requestContext } from "@/lib/server/context";
import { AppError } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { AGENCY_WORKSPACE } from "@/lib/domain/auth/roles";
import { getWorkspaceStore } from "@/lib/server/store";
export const runtime = "nodejs";
const bodySchema = z.object({ accountId: z.string().regex(/^\d{6,12}$/) });
export const PUT = route({ body: bodySchema }, async ({ req, body, principal }) => {
    const ctx = await requestContext(req);
    if (!ctx.accounts.some((a) => a.id === body.accountId))
        throw new AppError("NOT_FOUND", "That account is not accessible");
    if (principal.userId)
        await rememberAccount(principal.userId, body.accountId);
    else
        await getWorkspaceStore(AGENCY_WORKSPACE).settings.set((s) => ({ ...s, activeAccountId: body.accountId }));
    return new Response(JSON.stringify({ ok: true, accountId: body.accountId }), {
        headers: { "Content-Type": "application/json", "Set-Cookie": `${ACCOUNT_COOKIE}=${body.accountId}; Path=/; SameSite=Lax; Max-Age=31536000${isSecureRequest(req) ? "; Secure" : ""}` },
    });
});
