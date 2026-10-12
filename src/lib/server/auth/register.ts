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
import { findUserByEmail, normalizeEmail, userCount } from "./users";

/**
 * Self-service sign-up (asked for 2026-10-12: no AUTH_SETUP_TOKEN). The very first account becomes the agency admin;
 * every later one is a client viewer with no client, so it sees no accounts or workspace data until an admin assigns
 * a client (or another role) on the Access page.
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
