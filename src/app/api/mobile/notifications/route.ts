import { notificationFeedQuerySchema } from "@/lib/domain/contracts/history";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { notificationFeed } from "@/lib/server/mobile/notifications";

export const runtime = "nodejs";

export const GET = route({ query: notificationFeedQuerySchema, rateLimit: { key: "mobile-notifications", perMinute: 120, burst: 30 } }, async ({ req, query, principal }) => notificationFeed(await requestContext(req), principal, query));
