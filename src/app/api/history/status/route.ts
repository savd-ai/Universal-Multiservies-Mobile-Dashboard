import { historyStatus } from "@/lib/server/history";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";

export const GET = route({}, async () => historyStatus());
