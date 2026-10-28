import { clientSchema } from "@/lib/domain/contracts/auth";
import { accountDirectory, createClient, listClients } from "@/lib/server/auth/clients";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async () => {
    const [clients, directory] = await Promise.all([listClients(), accountDirectory()]);
    return { clients, directory };
});
export const POST = route({ body: clientSchema, maxBody: 32 * 1024 }, async ({ body }) => createClient(body));
