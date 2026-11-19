import "server-only";
import { singleton } from "../cache";
import { authConfig } from "../env/config";
import { AppError } from "../http/errors";
import { log } from "../log";
import { audit, getGlobalStore } from "../store";
import { ensureDemoClients } from "./clients";
import { hashPassword, readableCode, safeEqual } from "./crypto";
import type { UserRecord } from "./records";
import { findUserByEmail, normalizeEmail, userCount } from "./users";

// First run: while no user exists, /setup creates the first agency admin. It needs a one-time code — the value of
// AUTH_SETUP_TOKEN, or a random code printed to the server log — so whoever reaches a fresh deployment first
// can't claim it without access to the server.

export async function setupRequired(): Promise<boolean> {
  return authConfig().mode === "required" && (await userCount()) === 0;
}

function setupCode(): string {
  const fromEnv = authConfig().setupToken;
  if (fromEnv) return fromEnv;
  return singleton("auth:setup-code", () => readableCode()).toString();
}

/** Log how to finish setup (once per process) while it's still needed. */
export async function announceSetup(): Promise<void> {
  if (!(await setupRequired())) return;
  const flag = singleton("auth:setup-announced", () => ({ done: false }));
  if (flag.done) return;
  flag.done = true;
  if (authConfig().setupToken) log.warn("No users yet. Open /setup and enter the value of AUTH_SETUP_TOKEN to create the first admin.");
  else log.warn(`No users yet. Open /setup and enter this one-time setup code to create the first admin: ${setupCode()}`);
}

/** One setup at a time: the "no users yet" check and the create must not interleave. */
export async function completeSetup(input: { code: string; email: string; name: string; password: string }): Promise<UserRecord> {
  const lock = singleton("auth:setup-lock", () => ({ tail: Promise.resolve() as Promise<unknown> }));
  const run = lock.tail.then(() => createFirstAdmin(input));
  lock.tail = run.catch(() => undefined);
  return run;
}

async function createFirstAdmin(input: { code: string; email: string; name: string; password: string }): Promise<UserRecord> {
  if (!(await setupRequired())) throw new AppError("CONFLICT", "Setup is already complete. Sign in instead.");
  if (!safeEqual(input.code.trim().toUpperCase(), setupCode().trim().toUpperCase())) throw new AppError("UNAUTHORIZED", "That setup code is not correct. Check the server log (or AUTH_SETUP_TOKEN).");
  const email = normalizeEmail(input.email);
  if (await findUserByEmail(email)) throw new AppError("CONFLICT", "A user with this email already exists");
  const nowIso = new Date().toISOString();
  const user = await getGlobalStore().users.create({
    email,
    name: input.name,
    role: "agency_admin",
    clientId: null,
    status: "active",
    passwordHash: await hashPassword(input.password),
    passwordChangedAt: nowIso,
    mfa: null,
    mfaPending: null,
    failedLogins: 0,
    lockedUntil: null,
    lastLoginAt: null,
    lastAccountId: null,
    invitedBy: null,
  });
  await audit({ actor: "user", action: "auth.setup", target: user.email, summary: `${user.email} created the first agency admin`, actorId: user.id, actorEmail: user.email });
  await ensureDemoClients().catch((err: Error) => log.warn("demo clients were not created", { error: err.message }));
  return user;
}
