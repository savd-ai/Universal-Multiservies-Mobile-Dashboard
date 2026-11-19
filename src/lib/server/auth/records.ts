import "server-only";
import type { Role } from "@/lib/domain/auth/roles";
import type { SessionView, UserStatus } from "@/lib/domain/contracts/auth";
import type { BaseRecord } from "../store/store";

// Stored shapes for users, sessions, clients and one-time tokens (global store, never sent to the browser as-is).

export interface UserRecord extends BaseRecord {
  email: string;
  name: string;
  role: Role;
  clientId: string | null;
  status: UserStatus;
  /** scrypt$N$r$p$salt$hash, null until an invite is accepted (or for Google-only users) */
  passwordHash: string | null;
  passwordChangedAt: string | null;
  /** TOTP secret encrypted with APP_ENCRYPTION_KEY + hashed one-time recovery codes */
  mfa: { secret: string; enabledAt: string; recoveryHashes: string[]; /** last TOTP step used (replay guard) */ lastStep?: number } | null;
  mfaPending: { secret: string; createdAt: string } | null;
  failedLogins: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  lastAccountId: string | null;
  invitedBy: string | null;
}

/** id = sha256 of the cookie token, so a leaked store file can't be replayed as a session */
export interface SessionRecord extends BaseRecord {
  userId: string;
  expiresAt: string;
  idleExpiresAt: string;
  lastSeenAt: string;
  ip: string;
  userAgent: string;
  method: SessionView["method"];
}

export interface ClientRecord extends BaseRecord {
  name: string;
  accountIds: string[];
  notes: string;
}

/** id = sha256 of the emailed/copied token */
export interface AuthTokenRecord extends BaseRecord {
  kind: "invite" | "reset" | "mfa_challenge";
  userId: string;
  expiresAt: string;
  usedAt: string | null;
  /** for mfa_challenge: where to go after the second factor, and wrong codes so far (5 end the attempt) */
  next?: string;
  /** mfa_challenge: how the first factor was given (the session records it) */
  method?: "password" | "google";
  failures?: number;
}
