import { ideaSetPatchSchema } from "@/lib/domain/contracts/ai";
import { getIdeaSet, patchIdeaSet } from "@/lib/server/ai/services/ideas";
import { syncIdeaPlanLine } from "@/lib/server/budget/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { log } from "@/lib/server/log";

export const runtime = "nodejs";

export const GET = route({}, async ({ params }) => getIdeaSet(String(params.id)));

/** Dismiss an idea or mark it as added to the plan: {ideaId, dismissed?, inPlan?}. Marking it in plan adds a
 * draft line to the default budget plan (and unmarking removes it). */
export const PATCH = route({ body: ideaSetPatchSchema }, async ({ req, params, body }) => {
  const set = await patchIdeaSet(String(params.id), body);
  if (body.inPlan !== undefined) {
    const idea = set.ideas.find((i) => i.id === body.ideaId);
    if (idea) {
      try {
        await syncIdeaPlanLine(await requestContext(req), idea, body.inPlan);
      } catch (err) {
        // the flag is saved either way; the Budget planner re-syncs flagged ideas when it opens
        log.warn("idea → plan sync failed", { error: (err as Error).message });
      }
    }
  }
  return set;
});
