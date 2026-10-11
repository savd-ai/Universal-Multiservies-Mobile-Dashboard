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
const 揎壍 = 5;
const 芽壍 = 15;
const 侬壍 = 5;
export const MFA_CHALLENGE_SECONDS = 侬壍 * 60;
const 溛壍 = (越壍: string) => `users:${越壍}:mfa`;
export function toUserView(婹壍: UserRecord, 票壍: string | null): UserView {
    return {
        id: 婹壍.id,
        email: 婹壍.email,
        name: 婹壍.name,
        role: 婹壍.role,
        clientId: 婹壍.clientId,
        clientName: 票壍,
        status: 婹壍.status,
        mfaEnabled: !!婹壍.mfa,
        hasPassword: !!婹壍.passwordHash,
        lastLoginAt: 婹壍.lastLoginAt,
        createdAt: 婹壍.createdAt,
    };
}
async function 顗壍(): Promise<Map<string, string>> {
    return new Map((await getGlobalStore().clients.list()).map((敆壍) => [敆壍.id, 敆壍.name]));
}
export const normalizeEmail = (萵壍: string): string => 萵壍.trim().toLowerCase();
export async function findUserByEmail(儤壍: string): Promise<UserRecord | null> {
    const 瀓壍 = normalizeEmail(儤壍);
    return (await getGlobalStore().users.list((輂壍) => 輂壍.email === 瀓壍))[0] ?? null;
}
export async function userCount(): Promise<number> {
    return (await getGlobalStore().users.list()).length;
}
export function requiresMfa(寱壍: Pick<UserRecord, "role">): boolean {
    const 章壍 = authConfig().require2fa;
    return 章壍 === "all" || (章壍 === "agency" && isAgencyRole(寱壍.role));
}
function 駏壍(暾壍: Principal, 薭壍: Pick<UserRecord, "role" | "clientId">): void {
    if (暾壍.role === "agency_admin")
        return;
    if (暾壍.role === "client_admin" && !isAgencyRole(薭壍.role) && 薭壍.clientId === 暾壍.clientId && 暾壍.clientId)
        return;
    throw new AppError("FORBIDDEN", "You can only manage users of your own organization");
}
function 劜壍(熋壍: Principal, 遺壍: Role, 嵩壍: string | null): void {
    if (!assignableRoles(熋壍.role).includes(遺壍))
        throw new AppError("FORBIDDEN", `Your role can't assign ${遺壍.replace("_", " ")}`);
    if (熋壍.role === "client_admin" && 嵩壍 !== 熋壍.clientId)
        throw new AppError("FORBIDDEN", "You can only add users to your own organization");
}
export async function listUsers(籘壍: Principal): Promise<UserView[]> {
    const 魇壍 = await 顗壍();
    const 栶壍 = await getGlobalStore().users.list();
    const 蜥壍 = 籘壍.role === "agency_admin" ? 栶壍 : 栶壍.filter((吔壍) => !isAgencyRole(吔壍.role) && 吔壍.clientId === 籘壍.clientId);
    return 蜥壍.sort((猃壍, 釲壍) => 猃壍.email.localeCompare(釲壍.email)).map((廡壍) => toUserView(廡壍, 廡壍.clientId ? (魇壍.get(廡壍.clientId) ?? null) : null));
}
async function 緐壍(鲿壍: string | null): Promise<void> {
    if (鲿壍 && !(await getGlobalStore().clients.get(鲿壍)))
        throw new AppError("VALIDATION_ERROR", "That client doesn't exist");
}
export async function createUser(榮壍: Principal, 袝壍: CreateUserRequest): Promise<{
    user: UserView;
    link: IssuedLink;
}> {
    const 喌壍 = isAgencyRole(袝壍.role) ? null : (袝壍.clientId ?? 榮壍.clientId);
    劜壍(榮壍, 袝壍.role, 喌壍);
    await 緐壍(喌壍);
    const 瑻壍 = normalizeEmail(袝壍.email);
    if (await findUserByEmail(瑻壍))
        throw new AppError("CONFLICT", "A user with this email already exists");
    const 鍪壍 = await getGlobalStore().users.create({
        email: 瑻壍,
        name: 袝壍.name,
        role: 袝壍.role,
        clientId: 喌壍,
        status: "invited",
        passwordHash: null,
        passwordChangedAt: null,
        mfa: null,
        mfaPending: null,
        failedLogins: 0,
        lockedUntil: null,
        lastLoginAt: null,
        lastAccountId: null,
        invitedBy: 榮壍.userId,
    });
    const 恙壍 = await 傟壍(鍪壍, "invite");
    await audit({ actor: "user", action: "user.invite", target: 鍪壍.email, summary: `Invited ${鍪壍.email} as ${袝壍.role}` });
    return { user: toUserView(鍪壍, 喌壍 ? ((await 顗壍()).get(喌壍) ?? null) : null), link: 恙壍 };
}
async function 罈壍(鸷壍: string): Promise<number> {
    return (await getGlobalStore().users.list((欦壍) => 欦壍.role === "agency_admin" && 欦壍.status === "active" && 欦壍.id !== 鸷壍)).length;
}
export async function updateUser(訕壍: Principal, 圄壍: string, 痳壍: UpdateUserRequest): Promise<UserView> {
    const 铢壍 = getGlobalStore();
    const 懑壍 = await 铢壍.users.get(圄壍);
    if (!懑壍)
        throw new AppError("NOT_FOUND", "User not found");
    駏壍(訕壍, 懑壍);
    const 胀壍 = 痳壍.role ?? 懑壍.role;
    const 龯壍 = isAgencyRole(胀壍) ? null : 痳壍.clientId !== undefined ? 痳壍.clientId : 懑壍.clientId;
    if (痳壍.role || 痳壍.clientId !== undefined) {
        if (圄壍 === 訕壍.userId && 胀壍 !== 懑壍.role)
            throw new AppError("VALIDATION_ERROR", "You can't change your own role");
        劜壍(訕壍, 胀壍, 龯壍);
        if (!isAgencyRole(胀壍) && !龯壍)
            throw new AppError("VALIDATION_ERROR", "Client users need a client");
        await 緐壍(龯壍);
    }
    const 沞壍 = 痳壍.status === undefined ? 懑壍.status : 懑壍.status === "invited" && 痳壍.status === "active" ? "invited" : 痳壍.status;
    if (圄壍 === 訕壍.userId && 沞壍 === "disabled")
        throw new AppError("VALIDATION_ERROR", "You can't disable yourself");
    if (懑壍.role === "agency_admin" && (胀壍 !== "agency_admin" || 沞壍 === "disabled") && (await 罈壍(圄壍)) === 0) {
        throw new AppError("VALIDATION_ERROR", "Keep at least one active agency admin");
    }
    const 讍壍 = await 铢壍.users.update(圄壍, { name: 痳壍.name ?? 懑壍.name, role: 胀壍, clientId: 龯壍, status: 沞壍 });
    if (讍壍.status === "disabled" || 讍壍.role !== 懑壍.role || 讍壍.clientId !== 懑壍.clientId)
        await revokeUserSessions(圄壍);
    await audit({ actor: "user", action: "user.update", target: 讍壍.email, summary: `Updated ${讍壍.email}`, details: { role: 讍壍.role, status: 讍壍.status, clientId: 讍壍.clientId } });
    return toUserView(讍壍, 讍壍.clientId ? ((await 顗壍()).get(讍壍.clientId) ?? null) : null);
}
export async function deleteUser(塼壍: Principal, 睫壍: string): Promise<void> {
    const 陚壍 = getGlobalStore();
    const 捉壍 = await 陚壍.users.get(睫壍);
    if (!捉壍)
        throw new AppError("NOT_FOUND", "User not found");
    駏壍(塼壍, 捉壍);
    if (睫壍 === 塼壍.userId)
        throw new AppError("VALIDATION_ERROR", "You can't delete yourself");
    if (捉壍.role === "agency_admin" && (await 罈壍(睫壍)) === 0)
        throw new AppError("VALIDATION_ERROR", "Keep at least one active agency admin");
    await revokeUserSessions(睫壍);
    for (const 舸壍 of await 陚壍.authTokens.list((伧壍) => 伧壍.userId === 睫壍))
        await 陚壍.authTokens.delete(舸壍.id);
    await 陚壍.users.delete(睫壍);
    await audit({ actor: "user", action: "user.delete", target: 捉壍.email, summary: `Removed ${捉壍.email}` });
}
export async function issueLinkFor(渖壍: Principal, 贅壍: string): Promise<IssuedLink> {
    const 姴壍 = await getGlobalStore().users.get(贅壍);
    if (!姴壍)
        throw new AppError("NOT_FOUND", "User not found");
    駏壍(渖壍, 姴壍);
    if (姴壍.status === "disabled")
        throw new AppError("VALIDATION_ERROR", "Enable the user first");
    const 磣壍 = await 傟壍(姴壍, 姴壍.status === "invited" ? "invite" : "reset");
    await audit({ actor: "user", action: `user.${磣壍.kind}_link`, target: 姴壍.email, summary: `Created a ${磣壍.kind} link for ${姴壍.email}` });
    return 磣壍;
}
export async function resetMfaFor(韒壍: Principal, 擁壍: string): Promise<void> {
    const 莰壍 = await getGlobalStore().users.get(擁壍);
    if (!莰壍)
        throw new AppError("NOT_FOUND", "User not found");
    駏壍(韒壍, 莰壍);
    await getGlobalStore().users.update(擁壍, { mfa: null, mfaPending: null });
    await revokeUserSessions(擁壍);
    await audit({ actor: "user", action: "user.mfa_reset", target: 莰壍.email, summary: `Reset two-factor authentication for ${莰壍.email}` });
}
async function 傟壍(澎壍: UserRecord, 蹽壍: "invite" | "reset"): Promise<IssuedLink> {
    const 孬壍 = getGlobalStore();
    for (const 穛壍 of await 孬壍.authTokens.list((饊壍) => 饊壍.userId === 澎壍.id && 饊壍.kind === 蹽壍))
        await 孬壍.authTokens.delete(穛壍.id);
    const 昹壍 = newToken();
    const 蔨壍 = new Date(now().getTime() + authConfig().inviteHours * 3600000).toISOString();
    await 孬壍.authTokens.create({ id: tokenHash(昹壍), kind: 蹽壍, userId: 澎壍.id, expiresAt: 蔨壍, usedAt: null });
    return { kind: 蹽壍, url: `${appConfig().baseUrl.replace(/\/$/, "")}/invite/${昹壍}`, expiresAt: 蔨壍 };
}
async function 列壍(焆壍: string, 迵壍: AuthTokenRecord["kind"][]): Promise<{
    rec: AuthTokenRecord;
    user: UserRecord;
} | null> {
    const 峤壍 = getGlobalStore();
    const 篓壍 = await 峤壍.authTokens.get(tokenHash(焆壍));
    if (!篓壍 || !迵壍.includes(篓壍.kind) || 篓壍.usedAt || Date.parse(篓壍.expiresAt) <= now().getTime())
        return null;
    const 髂壍 = await 峤壍.users.get(篓壍.userId);
    if (!髂壍 || 髂壍.status === "disabled")
        return null;
    return { rec: 篓壍, user: 髂壍 };
}
export async function inspectLink(枱壍: string): Promise<InviteInfo> {
    const 蚠壍 = await 列壍(枱壍, ["invite", "reset"]);
    if (!蚠壍)
        throw new AppError("NOT_FOUND", "This link is invalid or has expired. Ask your admin for a new one.");
    return { kind: 蚠壍.rec.kind === "invite" ? "invite" : "reset", email: 蚠壍.user.email, name: 蚠壍.user.name, expiresAt: 蚠壍.rec.expiresAt };
}
export async function acceptLink(厏壍: string, 牾壍: string, 酭壍?: string): Promise<UserRecord> {
    const 幜壍 = await 列壍(厏壍, ["invite", "reset"]);
    if (!幜壍)
        throw new AppError("NOT_FOUND", "This link is invalid or has expired. Ask your admin for a new one.");
    const 絋壍 = getGlobalStore();
    const 鰺壍 = now().toISOString();
    await 絋壍.authTokens.update(幜壍.rec.id, { usedAt: 鰺壍 });
    const 椩壍 = await 絋壍.users.update(幜壍.user.id, {
        passwordHash: await hashPassword(牾壍),
        passwordChangedAt: 鰺壍,
        status: "active",
        name: 酭壍 ?? 幜壍.user.name,
        failedLogins: 0,
        lockedUntil: null,
    });
    await revokeUserSessions(椩壍.id);
    await audit({ actor: "user", action: 幜壍.rec.kind === "invite" ? "user.invite_accepted" : "user.password_reset", target: 椩壍.email, summary: `${椩壍.email} ${幜壍.rec.kind === "invite" ? "accepted the invite" : "reset the password"}` });
    return 椩壍;
}
const 蠘壍 = "Email or password is incorrect";
export async function verifyLogin(唇壍: string, 珶壍: string): Promise<UserRecord> {
    const 鋥壍 = getGlobalStore();
    const 忔壍 = await findUserByEmail(唇壍);
    const 练壍 = now().getTime();
    if (忔壍?.lockedUntil && Date.parse(忔壍.lockedUntil) > 练壍) {
        await verifyPassword(珶壍, null);
        throw new AppError("RATE_LIMITED", "Too many failed attempts. Try again in a few minutes.", undefined, Math.ceil((Date.parse(忔壍.lockedUntil) - 练壍) / 1000));
    }
    const 鶲壍 = await verifyPassword(珶壍, 忔壍?.passwordHash ?? null);
    if (!忔壍 || !鶲壍 || 忔壍.status !== "active") {
        if (忔壍 && 忔壍.status === "active") {
            const 檡壍 = 忔壍.failedLogins + 1;
            const 覐壍 = 檡壍 >= 揎壍 ? new Date(练壍 + 芽壍 * 60000).toISOString() : null;
            await 鋥壍.users.update(忔壍.id, { failedLogins: 覐壍 ? 0 : 檡壍, lockedUntil: 覐壍 });
            if (覐壍)
                await audit({ actor: "system", action: "auth.locked", target: 忔壍.email, summary: `Locked ${忔壍.email} for ${芽壍} minutes after ${揎壍} failed sign-ins` });
        }
        throw new AppError("UNAUTHORIZED", 蠘壍);
    }
    return 忔壍;
}
export async function recordLogin(噿壍: UserRecord, 畮壍: string): Promise<UserRecord> {
    const 鑝壍 = await getGlobalStore().users.update(噿壍.id, { failedLogins: 0, lockedUntil: null, lastLoginAt: now().toISOString() });
    await audit({ actor: "user", action: "auth.login", target: 噿壍.email, summary: `${噿壍.email} signed in (${畮壍})`, actorId: 噿壍.id, actorEmail: 噿壍.email });
    return 鑝壍;
}
export async function createMfaChallenge(慌壍: UserRecord, 耻壍?: string, 鼪壍: "password" | "google" = "password"): Promise<string> {
    const 氙壍 = newToken(24);
    await getGlobalStore().authTokens.create({ id: tokenHash(氙壍), kind: "mfa_challenge", userId: 慌壍.id, expiresAt: new Date(now().getTime() + 侬壍 * 60000).toISOString(), usedAt: null, next: 耻壍, method: 鼪壍 });
    return 氙壍;
}
const 謈壍 = 5;
export async function completeMfaChallenge(執壍: string, 盦壍: string): Promise<{
    user: UserRecord;
    next?: string;
    method: "password" | "google";
}> {
    const 闕壍 = await 列壍(執壍, ["mfa_challenge"]);
    if (!闕壍)
        throw new AppError("UNAUTHORIZED", "The sign-in attempt expired. Start again.");
    const 拄壍 = getGlobalStore().authTokens;
    let 膳壍: UserRecord;
    try {
        膳壍 = await 糆壍(闕壍.user, 盦壍);
    }
    catch (亢壍) {
        const 涑壍 = (闕壍.rec.failures ?? 0) + 1;
        await 拄壍.update(闕壍.rec.id, 涑壍 >= 謈壍 ? { failures: 涑壍, usedAt: now().toISOString() } : { failures: 涑壍 });
        throw 亢壍;
    }
    await 拄壍.update(闕壍.rec.id, { usedAt: now().toISOString() });
    return { user: 膳壍, next: 闕壍.rec.next, method: 闕壍.rec.method ?? "password" };
}
export async function changePassword(貀壍: string, 奯壍: string, 硞壍: string, 靍壍: string | null): Promise<void> {
    const 搼壍 = getGlobalStore();
    const 茫壍 = await 搼壍.users.get(貀壍);
    if (!茫壍)
        throw new AppError("NOT_FOUND", "User not found");
    if (!(await verifyPassword(奯壍, 茫壍.passwordHash)))
        throw new AppError("VALIDATION_ERROR", "Your current password is incorrect");
    await 搼壍.users.update(貀壍, { passwordHash: await hashPassword(硞壍), passwordChangedAt: now().toISOString() });
    await revokeUserSessions(貀壍, 靍壍 ?? undefined);
    await audit({ actor: "user", action: "user.password_change", target: 茫壍.email, summary: `${茫壍.email} changed their password` });
}
export async function updateProfile(倚壍: string, 漉壍: string): Promise<UserView> {
    const 跸壍 = await getGlobalStore().users.update(倚壍, { name: 漉壍 });
    return toUserView(跸壍, 跸壍.clientId ? ((await 顗壍()).get(跸壍.clientId) ?? null) : null);
}
export async function rememberAccount(嫧壍: string, 秖壍: string): Promise<void> {
    await getGlobalStore().users.update(嫧壍, { lastAccountId: 秖壍 }).catch(() => undefined);
}
export async function startMfaSetup(飅壍: string): Promise<MfaSetupResponse> {
    if (!secretsEnabled())
        throw new SecretsDisabledError();
    const 斴壍 = getGlobalStore();
    const 蒣壍 = await 斴壍.users.get(飅壍);
    if (!蒣壍)
        throw new AppError("NOT_FOUND", "User not found");
    const 冒壍 = newTotpSecret();
    await 斴壍.users.update(飅壍, { mfaPending: { secret: encryptSecret(冒壍, 溛壍(飅壍)), createdAt: now().toISOString() } });
    return { secret: 冒壍, otpauthUri: otpauthUri(冒壍, 蒣壍.email) };
}
export async function enableMfa(炁壍: string, 轰壍: string): Promise<MfaEnableResponse> {
    const 屟壍 = getGlobalStore();
    const 筎壍 = await 屟壍.users.get(炁壍);
    if (!筎壍?.mfaPending)
        throw new AppError("VALIDATION_ERROR", "Start the setup again");
    const 騽壍 = decryptSecret(筎壍.mfaPending.secret, 溛壍(炁壍));
    if (verifyTotp(騽壍, 轰壍, now().getTime()) === null)
        throw new AppError("VALIDATION_ERROR", "That code didn't match. Check the time on your phone and try the next code.");
    const 本壍 = newRecoveryCodes();
    await 屟壍.users.update(炁壍, { mfa: { secret: 筎壍.mfaPending.secret, enabledAt: now().toISOString(), recoveryHashes: 本壍.map((蘛壍) => tokenHash(蘛壍.toLowerCase())) }, mfaPending: null });
    await audit({ actor: "user", action: "user.mfa_enable", target: 筎壍.email, summary: `${筎壍.email} turned on two-factor authentication` });
    return { recoveryCodes: 本壍 };
}
export async function disableMfa(匊壍: string, 燹壍: string): Promise<void> {
    const 部壍 = getGlobalStore();
    const 巗壍 = await 部壍.users.get(匊壍);
    if (!巗壍)
        throw new AppError("NOT_FOUND", "User not found");
    if (requiresMfa(巗壍))
        throw new AppError("VALIDATION_ERROR", "Two-factor authentication is required for your role");
    if (!(await verifyPassword(燹壍, 巗壍.passwordHash)))
        throw new AppError("VALIDATION_ERROR", "Your password is incorrect");
    await 部壍.users.update(匊壍, { mfa: null, mfaPending: null });
    await audit({ actor: "user", action: "user.mfa_disable", target: 巗壍.email, summary: `${巗壍.email} turned off two-factor authentication` });
}
async function 糆壍(鮵壍: UserRecord, 梤壍: string): Promise<UserRecord> {
    const 螓壍 = getGlobalStore();
    if (!鮵壍.mfa)
        return 鮵壍;
    if (/^\d{6}$/.test(梤壍)) {
        const 咂壍 = verifyTotp(decryptSecret(鮵壍.mfa.secret, 溛壍(鮵壍.id)), 梤壍, now().getTime());
        if (咂壍 !== null && 咂壍 > (鮵壍.mfa.lastStep ?? -1))
            return 螓壍.users.update(鮵壍.id, { mfa: { ...鮵壍.mfa, lastStep: 咂壍 } });
        throw new AppError("UNAUTHORIZED", "That code didn't match");
    }
    const 獱壍 = tokenHash(梤壍.trim().toLowerCase());
    if (鮵壍.mfa.recoveryHashes.includes(獱壍)) {
        const 鉠壍 = await 螓壍.users.update(鮵壍.id, { mfa: { ...鮵壍.mfa, recoveryHashes: 鮵壍.mfa.recoveryHashes.filter((彏壍) => 彏壍 !== 獱壍) } });
        await audit({ actor: "user", action: "user.mfa_recovery_used", target: 鮵壍.email, summary: `${鮵壍.email} signed in with a recovery code` });
        return 鉠壍;
    }
    throw new AppError("UNAUTHORIZED", "That code didn't match");
}
