import { savedQuestionBodySchema } from "@/lib/domain/contracts/dashboard";
import { route } from "@/lib/server/http/api";
import { getStore } from "@/lib/server/store";
export const runtime = "nodejs";
export const GET = route({}, async () => ({ questions: (await getStore().questions.list()).sort((慁壍, 耰壍) => 耰壍.updatedAt.localeCompare(慁壍.updatedAt)) }));
export const POST = route({ body: savedQuestionBodySchema }, async ({ body: 鼟壍 }) => getStore().questions.create(鼟壍));
