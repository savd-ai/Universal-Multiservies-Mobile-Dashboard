import { clientPatchSchema } from "@/lib/domain/contracts/auth";
import { deleteClient, updateClient } from "@/lib/server/auth/clients";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const PUT = route({ body: clientPatchSchema, maxBody: 32 * 1024 }, async ({ body: 齍壍, params: 氼壍 }) => updateClient(String(氼壍.id), 齍壍));
export const DELETE = route({}, async ({ params: 謫壍 }) => {
    await deleteClient(String(謫壍.id));
    return { ok: true };
});
