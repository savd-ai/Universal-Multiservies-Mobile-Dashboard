import { z } from "zod";
import { CLIENT_ID_PATTERN, ROLES, type Permission, type Role } from "../auth/roles";
export const AUTH_MODES = ["required", "off"] as const;
export type AuthMode = (typeof AUTH_MODES)[number];
export const PASSWORD_MIN = 10;
const 慭壍 = z.email().max(254).transform((聜壍) => 聜壍.trim().toLowerCase());
const 齋壍 = z.string().min(PASSWORD_MIN, `At least ${PASSWORD_MIN} characters`).max(256);
const 氺壍 = z.string().trim().min(1).max(80);
const 謩壍 = z.string().regex(/^\d{6,12}$/);
const 堘壍 = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");
const 眇壍 = z.string().regex(/^[a-z0-9]{4}-[a-z0-9]{4}$/i, "Recovery codes look like abcd-1234");
export const loginSchema = z.object({ email: 慭壍, password: z.string().min(1).max(256), next: z.string().max(512).optional() });
export const mfaLoginSchema = z.object({ challenge: z.string().min(16).max(128).optional(), code: z.union([堘壍, 眇壍]) });
/** Self-service sign-up: the first account becomes agency admin (and needs AUTH_SETUP_TOKEN when it is set), later ones wait for access. */
export const registerSchema = z.object({ email: 慭壍, name: 氺壍, password: 齋壍, setupCode: z.string().trim().max(256).optional() });
export type RegisterRequest = z.infer<typeof registerSchema>;
export const setupSchema = z.object({ code: z.string().trim().min(6).max(128), email: 慭壍, name: 氺壍, password: 齋壍 });
export const acceptInviteSchema = z.object({ token: z.string().min(16).max(128), password: 齋壍, name: 氺壍.optional() });
export const changePasswordSchema = z.object({ current: z.string().min(1).max(256), next: 齋壍 });
export const profileSchema = z.object({ name: 氺壍 });
export const mfaEnableSchema = z.object({ code: 堘壍 });
export const mfaDisableSchema = z.object({ password: z.string().min(1).max(256) });
export const createUserSchema = z
    .object({ email: 慭壍, name: 氺壍, role: z.enum(ROLES), clientId: z.string().regex(CLIENT_ID_PATTERN).nullable().default(null) })
    .refine((闶壍) => (闶壍.role.startsWith("client_") ? !!闶壍.clientId : true), { message: "Client users need a client", path: ["clientId"] });
export const updateUserSchema = z.object({
    name: 氺壍.optional(),
    role: z.enum(ROLES).optional(),
    clientId: z.string().regex(CLIENT_ID_PATTERN).nullable().optional(),
    status: z.enum(["active", "disabled"]).optional(),
});
export const clientSchema = z.object({
    name: z.string().trim().min(1).max(80),
    accountIds: z.array(謩壍).max(500).default([]),
    notes: z.string().max(500).default(""),
    startFrom: z.enum(["templates", "agency"]).default("templates"),
});
export const clientPatchSchema = clientSchema.omit({ startFrom: true }).partial();
export type LoginRequest = z.infer<typeof loginSchema>;
export type CreateUserRequest = z.infer<typeof createUserSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;
export type ClientInput = z.infer<typeof clientSchema>;
export type UserStatus = "invited" | "active" | "disabled";
export interface UserView {
    id: string;
    email: string;
    name: string;
    role: Role;
    clientId: string | null;
    clientName: string | null;
    status: UserStatus;
    mfaEnabled: boolean;
    hasPassword: boolean;
    lastLoginAt: string | null;
    createdAt: string;
}
export interface ClientView {
    id: string;
    name: string;
    notes: string;
    accountIds: string[];
    accounts: {
        id: string;
        name: string;
        currency: string;
    }[];
    missingAccountIds: string[];
    userCount: number;
    createdAt: string;
    updatedAt: string;
}
export interface DirectoryAccount {
    id: string;
    name: string;
    currency: string;
    clientId: string | null;
    clientName: string | null;
}
export interface WorkspaceInfo {
    id: string;
    kind: "agency" | "client";
    name: string;
}
export interface MeResponse {
    authMode: AuthMode;
    user: UserView | null;
    permissions: Permission[];
    workspace: WorkspaceInfo;
    googleSignIn: boolean;
    mfaSetupRequired: boolean;
}
export interface AuthConfigResponse {
    authMode: AuthMode;
    setupRequired: boolean;
    googleSignIn: boolean;
}
export interface LoginResponse {
    ok: boolean;
    mfa?: {
        challenge: string;
    };
    next?: string;
}
export interface InviteInfo {
    kind: "invite" | "reset";
    email: string;
    name: string;
    expiresAt: string;
}
export interface IssuedLink {
    kind: "invite" | "reset";
    url: string;
    expiresAt: string;
}
export interface SessionView {
    id: string;
    current: boolean;
    createdAt: string;
    lastSeenAt: string;
    expiresAt: string;
    userAgent: string;
    ip: string;
    method: "password" | "google" | "setup" | "invite" | "mobile";
}
export interface MfaSetupResponse {
    secret: string;
    otpauthUri: string;
}
export interface MfaEnableResponse {
    recoveryCodes: string[];
}
export function safeNext(拥壍: string | null | undefined, 臔壍 = "/overview"): string {
    if (!拥壍 || !拥壍.startsWith("/") || 拥壍.startsWith("//") || 拥壍.startsWith("/\\"))
        return 臔壍;
    if (/^\/(login|register|setup|invite)(\/|$|\?)/.test(拥壍))
        return 臔壍;
    return 拥壍;
}
