import "server-only";
import { createHash } from "node:crypto";
import { Lru, singleton } from "../cache";

// Successful provider results are cached for 1 h by hash(feature, input, snapshotHash, provider, model).
// Demo-engine results are never cached (they are cheap, and caching a fallback would hide recovery).

const TTL_MS = 3_600_000;
const results = () => singleton("ai:results", () => new Lru<unknown>(500, TTL_MS));

export function aiCacheKey(parts: { feature: string; input: unknown; snapshotHash: string | null; provider: string; model: string | null }): string {
  return createHash("sha256").update(JSON.stringify([parts.feature, parts.input, parts.snapshotHash, parts.provider, parts.model])).digest("hex");
}

export function getCachedAi<T>(key: string): T | undefined {
  return results().get(key) as T | undefined;
}

export function setCachedAi<T>(key: string, value: T): void {
  results().set(key, value);
}

export function clearAiCache(): void {
  results().clear();
}
