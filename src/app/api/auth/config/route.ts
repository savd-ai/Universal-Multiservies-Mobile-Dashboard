import type { AuthConfigResponse } from "@/lib/domain/contracts/auth";
import { googleSignInEnabled } from "@/lib/server/auth/google";
import { announceSetup, setupRequired } from "@/lib/server/auth/setup";
import { authConfig } from "@/lib/server/env/config";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async (): Promise<AuthConfigResponse> => {
    await announceSetup();
    return { authMode: authConfig().mode, setupRequired: await setupRequired(), googleSignIn: googleSignInEnabled() };
});
