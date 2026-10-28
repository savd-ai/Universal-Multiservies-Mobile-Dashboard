import { signalActionSchema } from "@/lib/domain/contracts/anomaly";
import { routeParam } from "@/lib/server/actions/params";
import { applySignalAction, listSignals } from "@/lib/server/anomaly/service";
import { requestContext } from "@/lib/server/context";
import { notFound } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async ({ req, params }) => {
    const id = routeParam(params, "id");
    const signal = (await listSignals(await requestContext(req))).find((s) => s.id === id);
    if (!signal)
        throw notFound("Signal");
    return signal;
});
export const PATCH = route({ body: signalActionSchema, rateLimit: { key: "anomaly-action", perMinute: 120, burst: 30 } }, async ({ req, params, body }) => {
    const ctx = await requestContext(req);
    return applySignalAction(ctx, routeParam(params, "id"), body);
});
