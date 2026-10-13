import "server-only";
import type { Role } from "@/lib/domain/auth/roles";
import type { RegisterRequest } from "@/lib/domain/contracts/auth";
import { singleton } from "../cache";
import { now } from "../clock";
import { authConfig } from "../env/config";
import { AppError } from "../http/errors";
import { audit, getGlobalStore } from "../store";
import { hashPassword } from "./crypto";
import type { UserRecord } from "./records";
import { setupTokenConfigured, setupTokenMatches } from "./setup";
import { findUserByEmail, normalizeEmail, userCount } from "./users";

/**
 * Self-service sign-up. The very first account becomes the agency admin and, when AUTH_SETUP_TOKEN is set, must enter
 * it (2026-10-13: on a hosted copy that resets users on redeploy, whoever opened /register first would get admin).
 * Every later account is a client viewer with no client, so it sees no accounts or workspace data until an admin
 * assigns a client (or another role) on the Access page; those never need the token.
 */
export const REGISTERED_ROLE: Role = "client_viewer";

export async function registerUser(input: RegisterRequest): Promise<{ user: UserRecord; first: boolean }> {
  if (authConfig().mode !== "required") throw new AppError("CONFLICT", "Sign-in is turned off (AUTH_MODE=off), so there is nothing to register for.");
  // Same lock as completeSetup, so two people can't both become the first admin.
  const lock = singleton("auth:setup-lock", () => ({ tail: Promise.resolve() as Promise<unknown> }));
  const run = lock.tail.then(() => create(input));
  lock.tail = run.catch(() => undefined);
  return run;
}

async function create(input: RegisterRequest): Promise<{ user: UserRecord; first: boolean }> {
  const email = normalizeEmail(input.email);
  if (await findUserByEmail(email)) throw new AppError("CONFLICT", "An account with this email already exists. Sign in instead.");
  const first = (await userCount()) === 0;
  if (first && setupTokenConfigured() && !setupTokenMatches(input.setupCode)) {
    throw new AppError("UNAUTHORIZED", input.setupCode ? "That setup code is not correct." : "Enter the setup code (AUTH_SETUP_TOKEN) to create the first admin.", { reason: "setup_code" });
  }
  const at = now().toISOString();
  const user = await getGlobalStore().users.create({
    email,
    name: input.name,
    role: first ? "agency_admin" : REGISTERED_ROLE,
    clientId: null,
    status: "active",
    passwordHash: await hashPassword(input.password),
    passwordChangedAt: at,
    mfa: null,
    mfaPending: null,
    failedLogins: 0,
    lockedUntil: null,
    lastLoginAt: null,
    lastAccountId: null,
    invitedBy: null,
  });
  await audit({
    actor: "user",
    action: first ? "auth.setup" : "auth.register",
    target: user.email,
    summary: first ? `${user.email} registered as the first agency admin` : `${user.email} registered and is waiting for access`,
    actorId: user.id,
    actorEmail: user.email,
  });
  return { user, first };
}
