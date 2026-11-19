import { z } from "zod";
import { CLIENT_ID_PATTERN, ROLES, type Permission, type Role } from "../auth/roles";

// Login, sessions, users and clients (multi-tenancy). Request schemas are shared by the API and the UI forms;
// views are DTOs — password hashes, TOTP secrets and session tokens never leave the server.

export const AUTH_MODES = ["required", "off"] as const;
export type AuthMode = (typeof AUTH_MODES)[number];

export const PASSWORD_MIN = 10;
const email = z.email().max(254).transform((v) => v.trim().toLowerCase());
const password = z.string().min(PASSWORD_MIN, `At least ${PASSWORD_MIN} characters`).max(256);
const name = z.string().trim().min(1).max(80);
const accountId = z.string().regex(/^\d{6,12}$/);
const otp = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");
const recoveryCode = z.string().regex(/^[a-z0-9]{4}-[a-z0-9]{4}$/i, "Recovery codes look like abcd-1234");

export const loginSchema = z.object({ email, password: z.string().min(1).max(256), next: z.string().max(512).optional() });
/** `challenge` comes from the password step; after Google sign-in it is in an HttpOnly cookie instead. */
export const mfaLoginSchema = z.object({ challenge: z.string().min(16).max(128).optional(), code: z.union([otp, recoveryCode]) });
export const setupSchema = z.object({ code: z.string().trim().min(6).max(128), email, name, password });
export const acceptInviteSchema = z.object({ token: z.string().min(16).max(128), password, name: name.optional() });
export const changePasswordSchema = z.object({ current: z.string().min(1).max(256), next: password });
export const profileSchema = z.object({ name });
export const mfaEnableSchema = z.object({ code: otp });
export const mfaDisableSchema = z.object({ password: z.string().min(1).max(256) });

export const createUserSchema = z
  .object({ email, name, role: z.enum(ROLES), clientId: z.string().regex(CLIENT_ID_PATTERN).nullable().default(null) })
  .refine((u) => (u.role.startsWith("client_") ? !!u.clientId : true), { message: "Client users need a client", path: ["clientId"] });

export const updateUserSchema = z.object({
  name: name.optional(),
  role: z.enum(ROLES).optional(),
  clientId: z.string().regex(CLIENT_ID_PATTERN).nullable().optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

export const clientSchema = z.object({
  name: z.string().trim().min(1).max(80),
  accountIds: z.array(accountId).max(500).default([]),
  notes: z.string().max(500).default(""),
  /** new workspace: the default templates, or a copy of the agency workspace's dashboards, questions, metrics and rules */
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
  /** directory info for the assigned accounts that the agency credentials can still reach */
  accounts: { id: string; name: string; currency: string }[];
  /** assigned ids the agency credentials no longer reach (unlinked from the manager account) */
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
  /** null when access control is off (AUTH_MODE=off) */
  user: UserView | null;
  permissions: Permission[];
  workspace: WorkspaceInfo;
  googleSignIn: boolean;
  /** 2FA is required for this user by AUTH_REQUIRE_2FA and not set up yet */
  mfaSetupRequired: boolean;
}

export interface AuthConfigResponse {
  authMode: AuthMode;
  setupRequired: boolean;
  googleSignIn: boolean;
}

export interface LoginResponse {
  ok: boolean;
  /** set when the password was right and a second factor is needed */
  mfa?: { challenge: string };
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
  method: "password" | "google" | "setup" | "invite";
}

export interface MfaSetupResponse {
  secret: string;
  otpauthUri: string;
}

export interface MfaEnableResponse {
  recoveryCodes: string[];
}

/** Where to go after login: only same-site paths, never protocol-relative or external URLs. */
export function safeNext(next: string | null | undefined, fallback = "/overview"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/^\/(login|setup|invite)(\/|$|\?)/.test(next)) return fallback;
  return next;
}
