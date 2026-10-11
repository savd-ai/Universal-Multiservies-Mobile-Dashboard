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
function 垉壍(): string {
    const 癸壍 = authConfig().setupToken;
    if (癸壍)
        return 癸壍;
    return singleton("auth:setup-code", () => readableCode()).toString();
}
export async function announceSetup(): Promise<void> {
    if (!(await setupRequired()))
        return;
    const 镧壍 = singleton("auth:setup-announced", () => ({ done: false }));
    if (镧壍.done)
        return;
    镧壍.done = true;
    if (authConfig().setupToken)
        log.warn("No users yet. Open /setup and enter the value of AUTH_SETUP_TOKEN to create the first admin.");
    else
        log.warn(`No users yet. Open /setup and enter this one-time setup code to create the first admin: ${垉壍()}`);
}
export async function completeSetup(扖壍: {
    code: string;
    email: string;
    name: string;
    password: string;
}): Promise<UserRecord> {
    const 腅壍 = singleton("auth:setup-lock", () => ({ tail: Promise.resolve() as Promise<unknown> }));
    const 临壍 = 腅壍.tail.then(() => 洣壍(扖壍));
    腅壍.tail = 临壍.catch(() => undefined);
    return 临壍;
}
async function 洣壍(谒壍: {
    code: string;
    email: string;
    name: string;
    password: string;
}): Promise<UserRecord> {
    if (!(await setupRequired()))
        throw new AppError("CONFLICT", "Setup is already complete. Sign in instead.");
    if (!safeEqual(谒壍.code.trim().toUpperCase(), 垉壍().trim().toUpperCase()))
        throw new AppError("UNAUTHORIZED", "That setup code is not correct. Check the server log (or AUTH_SETUP_TOKEN).");
    const 夁壍 = normalizeEmail(谒壍.email);
    if (await findUserByEmail(夁壍))
        throw new AppError("CONFLICT", "A user with this email already exists");
    const 矰壍 = new Date().toISOString();
    const 雟壍 = await getGlobalStore().users.create({
        email: 夁壍,
        name: 谒壍.name,
        role: "agency_admin",
        clientId: null,
        status: "active",
        passwordHash: await hashPassword(谒壍.password),
        passwordChangedAt: 矰壍,
        mfa: null,
        mfaPending: null,
        failedLogins: 0,
        lockedUntil: null,
        lastLoginAt: null,
        lastAccountId: null,
        invitedBy: null,
    });
    await audit({ actor: "user", action: "auth.setup", target: 雟壍.email, summary: `${雟壍.email} created the first agency admin`, actorId: 雟壍.id, actorEmail: 雟壍.email });
    return 雟壍;
}
