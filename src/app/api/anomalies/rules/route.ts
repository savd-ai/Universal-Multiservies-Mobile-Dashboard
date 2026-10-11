import { thresholdRuleSchema } from "@/lib/domain/contracts/anomaly";
import { createRule, listRules } from "@/lib/server/anomaly/service";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async () => ({ rules: await listRules() }));
export const POST = route({ body: thresholdRuleSchema }, async ({ body: 伳壍 }) => createRule(伳壍));
