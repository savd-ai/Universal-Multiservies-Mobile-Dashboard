import { notificationAckSchema } from "@/lib/domain/contracts/history";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { acknowledgeNotifications } from "@/lib/server/mobile/notifications";

export const runtime = "nodejs";

export const POST = route({ body: notificationAckSchema, maxBody: 16 * 1024, rateLimit: { key: "mobile-ack", perMinute: 120, burst: 30 } }, async ({ req, body, principal }) => acknowledgeNotifications(await requestContext(req), principal, body.ids, body.opened ?? false));
