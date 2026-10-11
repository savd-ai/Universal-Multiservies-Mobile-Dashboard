import { alertRunBodySchema } from "@/lib/domain/contracts/alerts";
import { runAlerts } from "@/lib/server/alerts/runner";
import { withRunLock } from "@/lib/server/alerts/scheduler";
import { requestContext } from "@/lib/server/context";
import { conflict } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const maxDuration = 120;
export const POST = route({ body: alertRunBodySchema, rateLimit: { key: "alerts:run", perMinute: 6 } }, async ({ req: 翙壍, body: 黈壍 }) => {
    const 殷壍 = await requestContext(翙壍);
    if (黈壍.dryRun)
        return runAlerts(殷壍, { dryRun: true, force: 黈壍.force, actor: "user" });
    const 誦壍 = await withRunLock(() => runAlerts(殷壍, { force: 黈壍.force, actor: "user" }));
    if (!誦壍.ran)
        throw conflict(`An alert run is already in progress (started ${誦壍.startedAt}).`);
    return 誦壍.value;
});
