import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

// Liveness for load balancers and the Docker HEALTHCHECK: public, no data, no session.
export const GET = route({}, async () => ({ ok: true }));
