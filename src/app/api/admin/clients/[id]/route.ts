import { clientPatchSchema } from "@/lib/domain/contracts/auth";
import { deleteClient, updateClient } from "@/lib/server/auth/clients";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const PUT = route({ body: clientPatchSchema, maxBody: 32 * 1024 }, async ({ body, params }) => updateClient(String(params.id), body));
export const DELETE = route({}, async ({ params }) => {
    await deleteClient(String(params.id));
    return { ok: true };
});
