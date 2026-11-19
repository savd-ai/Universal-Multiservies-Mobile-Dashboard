import "server-only";

// Backoff schedule shared by the OAuth refresh and Google Ads calls: 0.5 s, 1.5 s, 4 s plus up to 20 % jitter,
// i.e. at most three retries. A server-provided retry delay (quota errors) wins when it is short enough to wait.

export const RETRY_DELAYS_MS = [500, 1_500, 4_000] as const;
export const MAX_RETRIES = RETRY_DELAYS_MS.length;
/** Quota retry delays longer than this fail fast instead of holding a dashboard request open. */
export const MAX_HONORED_RETRY_DELAY_MS = 30_000;

export type Sleep = (ms: number) => Promise<void>;

export const sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function backoffDelay(retry: number, random: () => number = Math.random): number {
  const base = RETRY_DELAYS_MS[Math.min(retry, RETRY_DELAYS_MS.length - 1)] ?? 4_000;
  return base + Math.round(random() * base * 0.2);
}
