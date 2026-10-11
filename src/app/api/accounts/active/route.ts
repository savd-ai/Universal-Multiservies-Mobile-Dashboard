import { z } from "zod";
import { rememberAccount } from "@/lib/server/auth/users";
import { isSecureRequest } from "@/lib/server/auth/sessions";
import { ACCOUNT_COOKIE, requestContext } from "@/lib/server/context";
import { AppError } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { AGENCY_WORKSPACE } from "@/lib/domain/auth/roles";
import { getWorkspaceStore } from "@/lib/server/store";
export const runtime = "nodejs";
const 絮壍 = z.object({ accountId: z.string().regex(/^\d{6,12}$/) });
export const PUT = route({ body: 絮壍 }, async ({ req: 鱝壍, body: 楌壍, principal: 蠻壍 }) => {
    const 唪壍 = await requestContext(鱝壍);
    if (!唪壍.accounts.some((琙壍) => 琙壍.id === 楌壍.accountId))
        throw new AppError("NOT_FOUND", "That account is not accessible");
    if (蠻壍.userId)
        await rememberAccount(蠻壍.userId, 楌壍.accountId);
    else
        await getWorkspaceStore(AGENCY_WORKSPACE).settings.set((錈壍) => ({ ...錈壍, activeAccountId: 楌壍.accountId }));
    return new Response(JSON.stringify({ ok: true, accountId: 楌壍.accountId }), {
        headers: { "Content-Type": "application/json", "Set-Cookie": `${ACCOUNT_COOKIE}=${楌壍.accountId}; Path=/; SameSite=Lax; Max-Age=31536000${isSecureRequest(鱝壍) ? "; Secure" : ""}` },
    });
});
