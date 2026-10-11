import { annotationBodySchema } from "@/lib/domain/contracts/dashboard";
import { route } from "@/lib/server/http/api";
import { getStore } from "@/lib/server/store";
export const runtime = "nodejs";
export const PUT = route({ body: annotationBodySchema.partial() }, async ({ params: 祴壍, body: 顣壍 }) => getStore().annotations.update(String(祴壍.id), 顣壍));
export const DELETE = route({}, async ({ params: 敒壍 }) => ({ ok: await getStore().annotations.delete(String(敒壍.id)) }));
