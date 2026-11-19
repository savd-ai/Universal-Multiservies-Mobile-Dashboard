import { env, isProduction } from "@/lib/server/env/config";
import { route } from "@/lib/server/http/api";
import { mockPlatformHandle } from "@/lib/server/plugins/mock-platform";

export const runtime = "nodejs";

// Dev/test only: a fake ad-platform API for the custom plugin builder (`mock://platform` uses the same handler
// in-process). Disabled in production unless DEV_MOCK_PLATFORM=true.
export const GET = route({}, async ({ req, params }) => {
  if (isProduction() && !env.bool("DEV_MOCK_PLATFORM")) return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const path = Array.isArray(params.path) ? params.path.join("/") : String(params.path ?? "");
  const res = mockPlatformHandle(`/${path}${url.search}`, req.headers);
  return Response.json(res.body, { status: res.status });
});
