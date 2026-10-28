import { alertRunBodySchema } from "@/lib/domain/contracts/alerts";
import { runAlerts } from "@/lib/server/alerts/runner";
import { withRunLock } from "@/lib/server/alerts/scheduler";
import { requestContext } from "@/lib/server/context";
import { conflict } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const maxDuration = 120;
export const POST = route({ body: alertRunBodySchema, rateLimit: { key: "alerts:run", perMinute: 6 } }, async ({ req, body }) => {
    const ctx = await requestContext(req);
    if (body.dryRun)
        return runAlerts(ctx, { dryRun: true, force: body.force, actor: "user" });
    const res = await withRunLock(() => runAlerts(ctx, { force: body.force, actor: "user" }));
    if (!res.ran)
        throw conflict(`An alert run is already in progress (started ${res.startedAt}).`);
    return res.value;
});
