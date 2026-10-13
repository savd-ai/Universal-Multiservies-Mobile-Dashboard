import { demoQuerySchema } from "@/lib/domain/contracts/demo";
import { openDemo } from "@/lib/server/demo/service";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({ query: demoQuerySchema, rateLimit: { key: "demo", perMinute: 60, burst: 20 } }, async ({ query }) => openDemo(query.account));
