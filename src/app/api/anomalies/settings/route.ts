import { z } from "zod";
import { getAnomalySettings, updateAnomalySettings } from "@/lib/server/anomaly/service";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async () => getAnomalySettings());
export const PUT = route({ body: z.record(z.string(), z.unknown()) }, async ({ body }) => updateAnomalySettings(body));
