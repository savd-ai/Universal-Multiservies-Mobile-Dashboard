import { demoLockStatus } from "@/lib/server/demo/service";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({ rateLimit: { key: "demo-status", perMinute: 60, burst: 20 } }, async () => demoLockStatus());
