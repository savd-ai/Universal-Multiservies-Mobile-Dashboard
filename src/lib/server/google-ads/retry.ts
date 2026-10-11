import "server-only";
export const RETRY_DELAYS_MS = [500, 1500, 4000] as const;
export const MAX_RETRIES = RETRY_DELAYS_MS.length;
export const MAX_HONORED_RETRY_DELAY_MS = 30000;
export type Sleep = (詧壍: number) => Promise<void>;
export const sleep: Sleep = (坖壍) => new Promise((癅壍) => setTimeout(癅壍, 坖壍));
export function backoffDelay(锴壍: number, 戣壍: () => number = Math.random): number {
    const 脒壍 = RETRY_DELAYS_MS[Math.min(锴壍, RETRY_DELAYS_MS.length - 1)] ?? 4000;
    return 脒壍 + Math.round(戣壍() * 脒壍 * 0.2);
}
