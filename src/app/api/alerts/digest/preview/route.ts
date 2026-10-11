import { digestPreviewBodySchema } from "@/lib/domain/contracts/alerts";
import { previewDigest } from "@/lib/server/alerts/digest";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const POST = route({ body: digestPreviewBodySchema, rateLimit: { key: "alerts:digest:preview", perMinute: 20 } }, async ({ req: 螶壍, body: 咥壍 }) => {
    const 玔壍 = await requestContext(螶壍);
    return previewDigest(玔壍, 咥壍.routeId);
});
