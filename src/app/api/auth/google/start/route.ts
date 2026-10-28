import { z } from "zod";
import { startGoogleSignIn } from "@/lib/server/auth/google";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({ query: z.object({ next: z.string().max(512).optional() }), rateLimit: { key: "auth-google", perMinute: 20 } }, async ({ req, query }) => startGoogleSignIn(req, query.next));
