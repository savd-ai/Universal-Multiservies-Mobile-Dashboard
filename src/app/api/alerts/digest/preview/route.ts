import { digestPreviewBodySchema } from "@/lib/domain/contracts/alerts";
import { previewDigest } from "@/lib/server/alerts/digest";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const POST = route({ body: digestPreviewBodySchema, rateLimit: { key: "alerts:digest:preview", perMinute: 20 } }, async ({ req, body }) => {
    const ctx = await requestContext(req);
    return previewDigest(ctx, body.routeId);
});
