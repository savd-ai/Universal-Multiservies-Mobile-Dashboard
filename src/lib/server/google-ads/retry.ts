import "server-only";
export const RETRY_DELAYS_MS = [500, 1500, 4000] as const;
export const MAX_RETRIES = RETRY_DELAYS_MS.length;
export const MAX_HONORED_RETRY_DELAY_MS = 30000;
export type Sleep = (ms: number) => Promise<void>;
export const sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export function backoffDelay(retry: number, random: () => number = Math.random): number {
    const base = RETRY_DELAYS_MS[Math.min(retry, RETRY_DELAYS_MS.length - 1)] ?? 4000;
    return base + Math.round(random() * base * 0.2);
}
