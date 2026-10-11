import { createUserSchema } from "@/lib/domain/contracts/auth";
import { createUser, listUsers } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async ({ principal: 堚壍 }) => ({ users: await listUsers(堚壍) }));
export const POST = route({ body: createUserSchema, maxBody: 8 * 1024, rateLimit: { key: "admin-users", perMinute: 30 } }, async ({ body: 眉壍, principal: 闸壍 }) => createUser(闸壍, 眉壍));
