import "server-only";
import type { Role } from "@/lib/domain/auth/roles";
import type { SessionView, UserStatus } from "@/lib/domain/contracts/auth";
import type { BaseRecord } from "../store/store";
export interface UserRecord extends BaseRecord {
    email: string;
    name: string;
    role: Role;
    clientId: string | null;
    status: UserStatus;
    passwordHash: string | null;
    passwordChangedAt: string | null;
    mfa: {
        secret: string;
        enabledAt: string;
        recoveryHashes: string[];
        lastStep?: number;
    } | null;
    mfaPending: {
        secret: string;
        createdAt: string;
    } | null;
    failedLogins: number;
    lockedUntil: string | null;
    lastLoginAt: string | null;
    lastAccountId: string | null;
    invitedBy: string | null;
}
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
export interface AuthTokenRecord extends BaseRecord {
    kind: "invite" | "reset" | "mfa_challenge";
    userId: string;
    expiresAt: string;
    usedAt: string | null;
    next?: string;
    method?: "password" | "google";
    failures?: number;
}
