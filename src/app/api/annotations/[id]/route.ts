import { annotationBodySchema } from "@/lib/domain/contracts/dashboard";
import { route } from "@/lib/server/http/api";
import { getStore } from "@/lib/server/store";
export const runtime = "nodejs";
export const PUT = route({ body: annotationBodySchema.partial() }, async ({ params, body }) => getStore().annotations.update(String(params.id), body));
export const DELETE = route({}, async ({ params }) => ({ ok: await getStore().annotations.delete(String(params.id)) }));
