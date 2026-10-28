import { savedQuestionBodySchema } from "@/lib/domain/contracts/dashboard";
import { notFound } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { getStore } from "@/lib/server/store";
export const runtime = "nodejs";
export const GET = route({}, async ({ params }) => {
    const q = await getStore().questions.get(String(params.id));
    if (!q)
        throw notFound("Question");
    return q;
});
export const PUT = route({ body: savedQuestionBodySchema }, async ({ params, body }) => getStore().questions.update(String(params.id), body));
export const DELETE = route({}, async ({ params }) => ({ ok: await getStore().questions.delete(String(params.id)) }));
