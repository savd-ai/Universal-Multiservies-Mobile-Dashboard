import { z } from "zod";
import { getAnomalySettings, updateAnomalySettings } from "@/lib/server/anomaly/service";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

export const GET = route({}, async () => getAnomalySettings());

// Partial or full settings: the body is deep-merged over the saved settings, then validated as a whole.
export const PUT = route({ body: z.record(z.string(), z.unknown()) }, async ({ body }) => updateAnomalySettings(body));
