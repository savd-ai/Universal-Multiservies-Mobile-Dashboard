import { demoUnlockSchema } from "@/lib/domain/contracts/demo";
import { unlockDemo } from "@/lib/server/demo/service";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const POST = route({ body: demoUnlockSchema, maxBody: 128 * 1024, rateLimit: { key: "demo-unlock", perMinute: 20, burst: 5 } }, async ({ body }) => unlockDemo(body));
