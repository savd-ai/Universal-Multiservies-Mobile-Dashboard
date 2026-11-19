import "server-only";

// Readers for Google Ads REST rows (proto3 JSON mapping): keys are lowerCamelCase, int64 values arrive as strings,
// enums as their names, and unset or default values are omitted — so every reader has an explicit fallback.

export type GoogleAdsRow = Record<string, unknown>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Value at a dotted camelCase path, e.g. `at(row, "metrics.costMicros")`. */
export function at(row: unknown, path: string): unknown {
  let cur: unknown = row;
  for (const key of path.split(".")) {
    if (!isRecord(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function text(row: unknown, path: string): string | undefined {
  const v = at(row, path);
  if (typeof v === "string") return v === "" ? undefined : v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

/** Counters and int64 metrics: missing means zero (proto3 omits zero values). */
export function num(row: unknown, path: string): number {
  return toNumber(at(row, path)) ?? 0;
}

/** Optional doubles such as impression share: `null` when the API reported no value. */
export function numOrNull(row: unknown, path: string): number | null {
  return toNumber(at(row, path));
}

export function flag(row: unknown, path: string): boolean {
  return at(row, path) === true;
}

export const fromMicros = (micros: number): number => micros / 1_000_000;

/** Last path segment of a resource name: `customers/1/campaigns/123` → `123`, `…/adGroupCriteria/5~7` → `5~7`. */
export function idFromResourceName(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const last = name.split("/").pop();
  return last ? last : undefined;
}
