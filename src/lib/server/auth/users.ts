import "server-only";
import { assignableRoles, isAgencyRole, type Role } from "@/lib/domain/auth/roles";
import type { CreateUserRequest, InviteInfo, IssuedLink, MfaEnableResponse, MfaSetupResponse, UpdateUserRequest, UserView } from "@/lib/domain/contracts/auth";
import { now } from "../clock";
import { decryptSecret, encryptSecret, secretsEnabled, SecretsDisabledError } from "../crypto/secrets";
import { appConfig, authConfig } from "../env/config";
import { AppError } from "../http/errors";
import type { Principal } from "../scope";
import { audit, getGlobalStore } from "../store";
import { hashPassword, newRecoveryCodes, newToken, newTotpSecret, otpauthUri, tokenHash, verifyPassword, verifyTotp } from "./crypto";
import type { AuthTokenRecord, UserRecord } from "./records";
import { revokeUserSessions } from "./sessions";
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const CHALLENGE_MINUTES = 5;
export const MFA_CHALLENGE_SECONDS = CHALLENGE_MINUTES * 60;
const mfaAad = (userId: string) => `users:${userId}:mfa`;
export function toUserView(u: UserRecord, clientName: string | null): UserView {
    return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        clientId: u.clientId,
        clientName,
        status: u.status,
        mfaEnabled: !!u.mfa,
        hasPassword: !!u.passwordHash,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
    };
}
async function clientNames(): Promise<Map<string, string>> {
    return new Map((await getGlobalStore().clients.list()).map((c) => [c.id, c.name]));
}
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
    const e = normalizeEmail(email);
    return (await getGlobalStore().users.list((u) => u.email === e))[0] ?? null;
}
export async function userCount(): Promise<number> {
    return (await getGlobalStore().users.list()).length;
}
export function requiresMfa(user: Pick<UserRecord, "role">): boolean {
    const req = authConfig().require2fa;
    return req === "all" || (req === "agency" && isAgencyRole(user.role));
}
function assertManages(viewer: Principal, target: Pick<UserRecord, "role" | "clientId">): void {
    if (viewer.role === "agency_admin")
        return;
    if (viewer.role === "client_admin" && !isAgencyRole(target.role) && target.clientId === viewer.clientId && viewer.clientId)
        return;
    throw new AppError("FORBIDDEN", "You can only manage users of your own organization");
}
function assertAssignable(viewer: Principal, role: Role, clientId: string | null): void {
    if (!assignableRoles(viewer.role).includes(role))
        throw new AppError("FORBIDDEN", `Your role can't assign ${role.replace("_", " ")}`);
    if (viewer.role === "client_admin" && clientId !== viewer.clientId)
        throw new AppError("FORBIDDEN", "You can only add users to your own organization");
}
export async function listUsers(viewer: Principal): Promise<UserView[]> {
    const names = await clientNames();
    const all = await getGlobalStore().users.list();
    const visible = viewer.role === "agency_admin" ? all : all.filter((u) => !isAgencyRole(u.role) && u.clientId === viewer.clientId);
    return visible.sort((a, b) => a.email.localeCompare(b.email)).map((u) => toUserView(u, u.clientId ? (names.get(u.clientId) ?? null) : null));
}
async function assertClientExists(clientId: string | null): Promise<void> {
    if (clientId && !(await getGlobalStore().clients.get(clientId)))
        throw new AppError("VALIDATION_ERROR", "That client doesn't exist");
}
export async function createUser(viewer: Principal, input: CreateUserRequest): Promise<{
    user: UserView;
    link: IssuedLink;
}> {
    const clientId = isAgencyRole(input.role) ? null : (input.clientId ?? viewer.clientId);
    assertAssignable(viewer, input.role, clientId);
    await assertClientExists(clientId);
    const email = normalizeEmail(input.email);
    if (await findUserByEmail(email))
        throw new AppError("CONFLICT", "A user with this email already exists");
    const user = await getGlobalStore().users.create({
        email,
        name: input.name,
        role: input.role,
        clientId,
        status: "invited",
        passwordHash: null,
        passwordChangedAt: null,
        mfa: null,
        mfaPending: null,
        failedLogins: 0,
        lockedUntil: null,
        lastLoginAt: null,
        lastAccountId: null,
        invitedBy: viewer.userId,
    });
    const link = await issueLink(user, "invite");
    await audit({ actor: "user", action: "user.invite", target: user.email, summary: `Invited ${user.email} as ${input.role}` });
    return { user: toUserView(user, clientId ? ((await clientNames()).get(clientId) ?? null) : null), link };
}
async function agencyAdminsLeft(excludingId: string): Promise<number> {
    return (await getGlobalStore().users.list((u) => u.role === "agency_admin" && u.status === "active" && u.id !== excludingId)).length;
}
export async function updateUser(viewer: Principal, id: string, patch: UpdateUserRequest): Promise<UserView> {
    const store = getGlobalStore();
    const prev = await store.users.get(id);
    if (!prev)
        throw new AppError("NOT_FOUND", "User not found");
    assertManages(viewer, prev);
    const role = patch.role ?? prev.role;
    const clientId = isAgencyRole(role) ? null : patch.clientId !== undefined ? patch.clientId : prev.clientId;
    if (patch.role || patch.clientId !== undefined) {
        if (id === viewer.userId && role !== prev.role)
            throw new AppError("VALIDATION_ERROR", "You can't change your own role");
        assertAssignable(viewer, role, clientId);
        if (!isAgencyRole(role) && !clientId)
            throw new AppError("VALIDATION_ERROR", "Client users need a client");
        await assertClientExists(clientId);
    }
    const status = patch.status === undefined ? prev.status : prev.status === "invited" && patch.status === "active" ? "invited" : patch.status;
    if (id === viewer.userId && status === "disabled")
        throw new AppError("VALIDATION_ERROR", "You can't disable yourself");
    if (prev.role === "agency_admin" && (role !== "agency_admin" || status === "disabled") && (await agencyAdminsLeft(id)) === 0) {
        throw new AppError("VALIDATION_ERROR", "Keep at least one active agency admin");
    }
    const next = await store.users.update(id, { name: patch.name ?? prev.name, role, clientId, status });
    if (next.status === "disabled" || next.role !== prev.role || next.clientId !== prev.clientId)
        await revokeUserSessions(id);
    await audit({ actor: "user", action: "user.update", target: next.email, summary: `Updated ${next.email}`, details: { role: next.role, status: next.status, clientId: next.clientId } });
    return toUserView(next, next.clientId ? ((await clientNames()).get(next.clientId) ?? null) : null);
}
export async function deleteUser(viewer: Principal, id: string): Promise<void> {
    const store = getGlobalStore();
    const prev = await store.users.get(id);
    if (!prev)
        throw new AppError("NOT_FOUND", "User not found");
    assertManages(viewer, prev);
    if (id === viewer.userId)
        throw new AppError("VALIDATION_ERROR", "You can't delete yourself");
    if (prev.role === "agency_admin" && (await agencyAdminsLeft(id)) === 0)
        throw new AppError("VALIDATION_ERROR", "Keep at least one active agency admin");
    await revokeUserSessions(id);
    for (const t of await store.authTokens.list((t2) => t2.userId === id))
        await store.authTokens.delete(t.id);
    await store.users.delete(id);
    await audit({ actor: "user", action: "user.delete", target: prev.email, summary: `Removed ${prev.email}` });
}
export async function issueLinkFor(viewer: Principal, id: string): Promise<IssuedLink> {
    const user = await getGlobalStore().users.get(id);
    if (!user)
        throw new AppError("NOT_FOUND", "User not found");
    assertManages(viewer, user);
    if (user.status === "disabled")
        throw new AppError("VALIDATION_ERROR", "Enable the user first");
    const link = await issueLink(user, user.status === "invited" ? "invite" : "reset");
    await audit({ actor: "user", action: `user.${link.kind}_link`, target: user.email, summary: `Created a ${link.kind} link for ${user.email}` });
    return link;
}
export async function resetMfaFor(viewer: Principal, id: string): Promise<void> {
    const user = await getGlobalStore().users.get(id);
    if (!user)
        throw new AppError("NOT_FOUND", "User not found");
    assertManages(viewer, user);
    await getGlobalStore().users.update(id, { mfa: null, mfaPending: null });
    await revokeUserSessions(id);
    await audit({ actor: "user", action: "user.mfa_reset", target: user.email, summary: `Reset two-factor authentication for ${user.email}` });
}
async function issueLink(user: UserRecord, kind: "invite" | "reset"): Promise<IssuedLink> {
    const store = getGlobalStore();
    for (const t of await store.authTokens.list((t2) => t2.userId === user.id && t2.kind === kind))
        await store.authTokens.delete(t.id);
    const token = newToken();
    const expiresAt = new Date(now().getTime() + authConfig().inviteHours * 3600000).toISOString();
    await store.authTokens.create({ id: tokenHash(token), kind, userId: user.id, expiresAt, usedAt: null });
    return { kind, url: `${appConfig().baseUrl.replace(/\/$/, "")}/invite/${token}`, expiresAt };
}
async function liveToken(token: string, kinds: AuthTokenRecord["kind"][]): Promise<{
    rec: AuthTokenRecord;
    user: UserRecord;
} | null> {
    const store = getGlobalStore();
    const rec = await store.authTokens.get(tokenHash(token));
    if (!rec || !kinds.includes(rec.kind) || rec.usedAt || Date.parse(rec.expiresAt) <= now().getTime())
        return null;
    const user = await store.users.get(rec.userId);
    if (!user || user.status === "disabled")
        return null;
    return { rec, user };
}
export async function inspectLink(token: string): Promise<InviteInfo> {
    const hit = await liveToken(token, ["invite", "reset"]);
    if (!hit)
        throw new AppError("NOT_FOUND", "This link is invalid or has expired. Ask your admin for a new one.");
    return { kind: hit.rec.kind === "invite" ? "invite" : "reset", email: hit.user.email, name: hit.user.name, expiresAt: hit.rec.expiresAt };
}
export async function acceptLink(token: string, password: string, name?: string): Promise<UserRecord> {
    const hit = await liveToken(token, ["invite", "reset"]);
    if (!hit)
        throw new AppError("NOT_FOUND", "This link is invalid or has expired. Ask your admin for a new one.");
    const store = getGlobalStore();
    const nowIso = now().toISOString();
    await store.authTokens.update(hit.rec.id, { usedAt: nowIso });
    const user = await store.users.update(hit.user.id, {
        passwordHash: await hashPassword(password),
        passwordChangedAt: nowIso,
        status: "active",
        name: name ?? hit.user.name,
        failedLogins: 0,
        lockedUntil: null,
    });
    await revokeUserSessions(user.id);
    await audit({ actor: "user", action: hit.rec.kind === "invite" ? "user.invite_accepted" : "user.password_reset", target: user.email, summary: `${user.email} ${hit.rec.kind === "invite" ? "accepted the invite" : "reset the password"}` });
    return user;
}
const INVALID = "Email or password is incorrect";
export async function verifyLogin(email: string, password: string): Promise<UserRecord> {
    const store = getGlobalStore();
    const user = await findUserByEmail(email);
    const t = now().getTime();
    if (user?.lockedUntil && Date.parse(user.lockedUntil) > t) {
        await verifyPassword(password, null);
        throw new AppError("RATE_LIMITED", "Too many failed attempts. Try again in a few minutes.", undefined, Math.ceil((Date.parse(user.lockedUntil) - t) / 1000));
    }
    const ok = await verifyPassword(password, user?.passwordHash ?? null);
    if (!user || !ok || user.status !== "active") {
        if (user && user.status === "active") {
            const failed = user.failedLogins + 1;
            const lockedUntil = failed >= MAX_FAILED ? new Date(t + LOCK_MINUTES * 60000).toISOString() : null;
            await store.users.update(user.id, { failedLogins: lockedUntil ? 0 : failed, lockedUntil });
            if (lockedUntil)
                await audit({ actor: "system", action: "auth.locked", target: user.email, summary: `Locked ${user.email} for ${LOCK_MINUTES} minutes after ${MAX_FAILED} failed sign-ins` });
        }
        throw new AppError("UNAUTHORIZED", INVALID);
    }
    return user;
}
export async function recordLogin(user: UserRecord, method: string): Promise<UserRecord> {
    const next = await getGlobalStore().users.update(user.id, { failedLogins: 0, lockedUntil: null, lastLoginAt: now().toISOString() });
    await audit({ actor: "user", action: "auth.login", target: user.email, summary: `${user.email} signed in (${method})`, actorId: user.id, actorEmail: user.email });
    return next;
}
export async function createMfaChallenge(user: UserRecord, next?: string, method: "password" | "google" = "password"): Promise<string> {
    const token = newToken(24);
    await getGlobalStore().authTokens.create({ id: tokenHash(token), kind: "mfa_challenge", userId: user.id, expiresAt: new Date(now().getTime() + CHALLENGE_MINUTES * 60000).toISOString(), usedAt: null, next, method });
    return token;
}
const MAX_MFA_FAILURES = 5;
export async function completeMfaChallenge(challenge: string, code: string): Promise<{
    user: UserRecord;
    next?: string;
    method: "password" | "google";
}> {
    const hit = await liveToken(challenge, ["mfa_challenge"]);
    if (!hit)
        throw new AppError("UNAUTHORIZED", "The sign-in attempt expired. Start again.");
    const tokens = getGlobalStore().authTokens;
    let user: UserRecord;
    try {
        user = await verifySecondFactor(hit.user, code);
    }
    catch (err) {
        const failures = (hit.rec.failures ?? 0) + 1;
        await tokens.update(hit.rec.id, failures >= MAX_MFA_FAILURES ? { failures, usedAt: now().toISOString() } : { failures });
        throw err;
    }
    await tokens.update(hit.rec.id, { usedAt: now().toISOString() });
    return { user, next: hit.rec.next, method: hit.rec.method ?? "password" };
}
export async function changePassword(userId: string, current: string, next: string, keepSessionId: string | null): Promise<void> {
    const store = getGlobalStore();
    const user = await store.users.get(userId);
    if (!user)
        throw new AppError("NOT_FOUND", "User not found");
    if (!(await verifyPassword(current, user.passwordHash)))
        throw new AppError("VALIDATION_ERROR", "Your current password is incorrect");
    await store.users.update(userId, { passwordHash: await hashPassword(next), passwordChangedAt: now().toISOString() });
    await revokeUserSessions(userId, keepSessionId ?? undefined);
    await audit({ actor: "user", action: "user.password_change", target: user.email, summary: `${user.email} changed their password` });
}
export async function updateProfile(userId: string, name: string): Promise<UserView> {
    const user = await getGlobalStore().users.update(userId, { name });
    return toUserView(user, user.clientId ? ((await clientNames()).get(user.clientId) ?? null) : null);
}
export async function rememberAccount(userId: string, accountId: string): Promise<void> {
    await getGlobalStore().users.update(userId, { lastAccountId: accountId }).catch(() => undefined);
}
export async function startMfaSetup(userId: string): Promise<MfaSetupResponse> {
    if (!secretsEnabled())
        throw new SecretsDisabledError();
    const store = getGlobalStore();
    const user = await store.users.get(userId);
    if (!user)
        throw new AppError("NOT_FOUND", "User not found");
    const secret = newTotpSecret();
    await store.users.update(userId, { mfaPending: { secret: encryptSecret(secret, mfaAad(userId)), createdAt: now().toISOString() } });
    return { secret, otpauthUri: otpauthUri(secret, user.email) };
}
export async function enableMfa(userId: string, code: string): Promise<MfaEnableResponse> {
    const store = getGlobalStore();
    const user = await store.users.get(userId);
    if (!user?.mfaPending)
        throw new AppError("VALIDATION_ERROR", "Start the setup again");
    const secret = decryptSecret(user.mfaPending.secret, mfaAad(userId));
    if (verifyTotp(secret, code, now().getTime()) === null)
        throw new AppError("VALIDATION_ERROR", "That code didn't match. Check the time on your phone and try the next code.");
    const recoveryCodes = newRecoveryCodes();
    await store.users.update(userId, { mfa: { secret: user.mfaPending.secret, enabledAt: now().toISOString(), recoveryHashes: recoveryCodes.map((c) => tokenHash(c.toLowerCase())) }, mfaPending: null });
    await audit({ actor: "user", action: "user.mfa_enable", target: user.email, summary: `${user.email} turned on two-factor authentication` });
    return { recoveryCodes };
}
export async function disableMfa(userId: string, password: string): Promise<void> {
    const store = getGlobalStore();
    const user = await store.users.get(userId);
    if (!user)
        throw new AppError("NOT_FOUND", "User not found");
    if (requiresMfa(user))
        throw new AppError("VALIDATION_ERROR", "Two-factor authentication is required for your role");
    if (!(await verifyPassword(password, user.passwordHash)))
        throw new AppError("VALIDATION_ERROR", "Your password is incorrect");
    await store.users.update(userId, { mfa: null, mfaPending: null });
    await audit({ actor: "user", action: "user.mfa_disable", target: user.email, summary: `${user.email} turned off two-factor authentication` });
}
async function verifySecondFactor(user: UserRecord, code: string): Promise<UserRecord> {
    const store = getGlobalStore();
    if (!user.mfa)
        return user;
    if (/^\d{6}$/.test(code)) {
        const step = verifyTotp(decryptSecret(user.mfa.secret, mfaAad(user.id)), code, now().getTime());
        if (step !== null && step > (user.mfa.lastStep ?? -1))
            return store.users.update(user.id, { mfa: { ...user.mfa, lastStep: step } });
        throw new AppError("UNAUTHORIZED", "That code didn't match");
    }
    const hash = tokenHash(code.trim().toLowerCase());
    if (user.mfa.recoveryHashes.includes(hash)) {
        const updated = await store.users.update(user.id, { mfa: { ...user.mfa, recoveryHashes: user.mfa.recoveryHashes.filter((h) => h !== hash) } });
        await audit({ actor: "user", action: "user.mfa_recovery_used", target: user.email, summary: `${user.email} signed in with a recovery code` });
        return updated;
    }
    throw new AppError("UNAUTHORIZED", "That code didn't match");
}
