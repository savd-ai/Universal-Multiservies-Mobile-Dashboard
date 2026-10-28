import "server-only";
import type { AccountInfo, Mode } from "@/lib/domain/types";
export type GuardedFetch = (text: string, second?: RequestInit & {
    timeoutMs?: number;
    maxBytes?: number;
}) => Promise<Response>;
export interface SendContext {
    config: Record<string, string>;
    env: Readonly<Record<string, string | undefined>>;
    fetch: GuardedFetch;
    account: AccountInfo;
    mode: Mode;
    now: Date;
}
export interface SendResult {
    ok: boolean;
    status?: number;
    retryAfterMs?: number;
    permanent?: boolean;
    error?: string;
    preview?: string;
}
