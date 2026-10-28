import "server-only";
import { singleton } from "../cache";
import { authConfig } from "../env/config";
import { AppError } from "../http/errors";
import { log } from "../log";
import { audit, getGlobalStore } from "../store";
import { hashPassword, readableCode, safeEqual } from "./crypto";
import type { UserRecord } from "./records";
import { findUserByEmail, normalizeEmail, userCount } from "./users";
export async function setupRequired(): Promise<boolean> {
    return authConfig().mode === "required" && (await userCount()) === 0;
}
/** True when AUTH_SETUP_TOKEN is set: the first account on /register must then enter it. */
export function setupTokenConfigured(): boolean {
    return !!authConfig().setupToken;
}
export function setupTokenMatches(code: string | undefined): boolean {
    const token = authConfig().setupToken;
    return !!token && !!code && safeEqual(code.trim().toUpperCase(), token.trim().toUpperCase());
}
function setupCode(): string {
    const fromEnv = authConfig().setupToken;
    if (fromEnv)
        return fromEnv;
    return singleton("auth:setup-code", () => readableCode()).toString();
}
export async function announceSetup(): Promise<void> {
    if (!(await setupRequired()))
        return;
    const flag = singleton("auth:setup-announced", () => ({ done: false }));
    if (flag.done)
        return;
    flag.done = true;
    // The first account is created at /register; with AUTH_SETUP_TOKEN set it must enter that token (never logged).
    log.warn(setupTokenConfigured()
        ? "No users yet. Open /register and enter AUTH_SETUP_TOKEN to create the first account; it becomes the agency admin."
        : "No users yet. Open /register to create the first account; it becomes the agency admin. Set AUTH_SETUP_TOKEN on any server others can reach.");
}
export async function completeSetup(input: {
    code: string;
    email: string;
    name: string;
    password: string;
}): Promise<UserRecord> {
    const lock = singleton("auth:setup-lock", () => ({ tail: Promise.resolve() as Promise<unknown> }));
    const run = lock.tail.then(() => createFirstAdmin(input));
    lock.tail = run.catch(() => undefined);
    return run;
}
async function createFirstAdmin(input: {
    code: string;
    email: string;
    name: string;
    password: string;
}): Promise<UserRecord> {
    if (!(await setupRequired()))
        throw new AppError("CONFLICT", "Setup is already complete. Sign in instead.");
    if (!safeEqual(input.code.trim().toUpperCase(), setupCode().trim().toUpperCase()))
        throw new AppError("UNAUTHORIZED", "That setup code is not correct. Check the server log (or AUTH_SETUP_TOKEN).");
    const email = normalizeEmail(input.email);
    if (await findUserByEmail(email))
        throw new AppError("CONFLICT", "A user with this email already exists");
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
    return user;
}
