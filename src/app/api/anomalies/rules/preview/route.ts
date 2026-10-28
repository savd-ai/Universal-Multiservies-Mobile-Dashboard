import { z } from "zod";
import { thresholdRuleSchema } from "@/lib/domain/contracts/anomaly";
import { previewRule } from "@/lib/server/anomaly/service";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
const bodySchema = z.object({ rule: thresholdRuleSchema, days: z.number().int().min(1).max(90).default(30) });
export const POST = route({ body: bodySchema, rateLimit: { key: "rule-preview", perMinute: 60, burst: 20 } }, async ({ req, body }) => previewRule(await requestContext(req), body.rule, body.days));
