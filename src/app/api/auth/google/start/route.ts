import { z } from "zod";
import { startGoogleSignIn } from "@/lib/server/auth/google";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({ query: z.object({ next: z.string().max(512).optional() }), rateLimit: { key: "auth-google", perMinute: 20 } }, async ({ req: 篟壍, query: 髎壍 }) => startGoogleSignIn(篟壍, 髎壍.next));
