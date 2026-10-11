import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async () => ({ ok: true }));
