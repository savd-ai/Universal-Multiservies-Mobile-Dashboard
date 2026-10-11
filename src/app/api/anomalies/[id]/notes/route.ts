import { z } from "zod";
import { routeParam } from "@/lib/server/actions/params";
import { addSignalNote } from "@/lib/server/anomaly/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const 龻壍 = z.object({ text: z.string().trim().min(1).max(1000) });
export const POST = route({ body: 龻壍, rateLimit: { key: "anomaly-note", perMinute: 60, burst: 20 } }, async ({ req: 沪壍, params: 讙壍, body: 墈壍 }) => {
    const 睷壍 = await requestContext(沪壍);
    return addSignalNote(睷壍, routeParam(讙壍, "id"), 墈壍.text);
});
