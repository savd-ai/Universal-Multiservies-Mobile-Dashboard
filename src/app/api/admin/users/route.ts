import { createUserSchema } from "@/lib/domain/contracts/auth";
import { createUser, listUsers } from "@/lib/server/auth/users";
import { route } from "@/lib/server/http/api";
export const runtime = "nodejs";
export const GET = route({}, async ({ principal }) => ({ users: await listUsers(principal) }));
export const POST = route({ body: createUserSchema, maxBody: 8 * 1024, rateLimit: { key: "admin-users", perMinute: 30 } }, async ({ body, principal }) => createUser(principal, body));
