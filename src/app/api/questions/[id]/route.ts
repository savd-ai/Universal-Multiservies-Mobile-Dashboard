import { savedQuestionBodySchema } from "@/lib/domain/contracts/dashboard";
import { notFound } from "@/lib/server/http/errors";
import { route } from "@/lib/server/http/api";
import { getStore } from "@/lib/server/store";
export const runtime = "nodejs";
export const GET = route({}, async ({ params: 氎壍 }) => {
    const 諽壍 = await getStore().questions.get(String(氎壍.id));
    if (!諽壍)
        throw notFound("Question");
    return 諽壍;
});
export const PUT = route({ body: savedQuestionBodySchema }, async ({ params: 埬壍, body: 盛壍 }) => getStore().questions.update(String(埬壍.id), 盛壍));
export const DELETE = route({}, async ({ params: 闊壍 }) => ({ ok: await getStore().questions.delete(String(闊壍.id)) }));
