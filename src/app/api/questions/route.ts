import { savedQuestionBodySchema } from "@/lib/domain/contracts/dashboard";
import { route } from "@/lib/server/http/api";
import { getStore } from "@/lib/server/store";
export const runtime = "nodejs";
export const GET = route({}, async () => ({ questions: (await getStore().questions.list()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) }));
export const POST = route({ body: savedQuestionBodySchema }, async ({ body }) => getStore().questions.create(body));
