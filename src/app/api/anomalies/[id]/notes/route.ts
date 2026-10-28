import { z } from "zod";
import { routeParam } from "@/lib/server/actions/params";
import { addSignalNote } from "@/lib/server/anomaly/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const bodySchema = z.object({ text: z.string().trim().min(1).max(1000) });
export const POST = route({ body: bodySchema, rateLimit: { key: "anomaly-note", perMinute: 60, burst: 20 } }, async ({ req, params, body }) => {
    const ctx = await requestContext(req);
    return addSignalNote(ctx, routeParam(params, "id"), body.text);
});
