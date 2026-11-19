import { z } from "zod";
import { getGoogleEstimatesView } from "@/lib/server/budget/google-estimates";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

const querySchema = z.object({ objective: z.enum(["conversions", "conv_value"]).default("conv_value") });

// Google's budget / target simulators and budget recommendations (read-only reports) next to our model, with the
// policy that says which estimate leads. Partial failures come back as warnings, never as an error.
export const GET = route({ query: querySchema, rateLimit: { key: "budget-read", perMinute: 240, burst: 60 } }, async ({ req, query }) => getGoogleEstimatesView(await requestContext(req), query));
