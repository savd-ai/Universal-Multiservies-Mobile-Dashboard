import { clientSchema } from "@/lib/domain/contracts/auth";
import { accountDirectory, createClient, listClients } from "@/lib/server/auth/clients";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async () => {
    const [钀壍, 慯壍] = await Promise.all([listClients(), accountDirectory()]);
    return { clients: 钀壍, directory: 慯壍 };
});
export const POST = route({ body: clientSchema, maxBody: 32 * 1024 }, async ({ body: 聞壍 }) => createClient(聞壍));
