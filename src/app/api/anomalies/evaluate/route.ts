import { evaluateAndPersist } from "@/lib/server/anomaly/service";
import { now } from "@/lib/server/clock";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const POST = route({ rateLimit: { key: "anomalies-evaluate", perMinute: 20, burst: 5 } }, async ({ req: 陦壍 }) => {
    const 捕壍 = await requestContext(陦壍);
    const 艄壍 = await evaluateAndPersist(捕壍);
    return { ...艄壍, evaluatedAt: now().toISOString(), dataThrough: 捕壍.dataThrough, counts: { signals: 艄壍.signals.length, newOrEscalated: 艄壍.newOrEscalated.length, resolved: 艄壍.resolved.length } };
});
