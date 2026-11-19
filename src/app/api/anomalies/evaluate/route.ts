import { evaluateAndPersist } from "@/lib/server/anomaly/service";
import { now } from "@/lib/server/clock";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

// Detect with the saved settings and persist lifecycle state (first/last seen, auto-resolve, escalation).
export const POST = route({ rateLimit: { key: "anomalies-evaluate", perMinute: 20, burst: 5 } }, async ({ req }) => {
  const ctx = await requestContext(req);
  const result = await evaluateAndPersist(ctx);
  return { ...result, evaluatedAt: now().toISOString(), dataThrough: ctx.dataThrough, counts: { signals: result.signals.length, newOrEscalated: result.newOrEscalated.length, resolved: result.resolved.length } };
});
