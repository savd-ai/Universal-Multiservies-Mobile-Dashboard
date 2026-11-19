import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { env } from "./config";
import { ENV_VARS, REQUIRED_LIVE_KEYS, type EnvGroup } from "./registry";

// Presence + masking. The browser only ever sees whether a key is set and (for non-secrets) a short masked hint.

export interface EnvKeyStatus {
  key: string;
  group: EnvGroup;
  set: boolean;
  required: boolean;
  secret: boolean;
  masked: string | null;
  pluginId?: string;
  description: string;
}

/** Secrets show only the last 4 characters; ids show first 3 + last 2 (the prototype's format). */
export function mask(value: string, secret: boolean): string {
  if (secret) return value.length <= 4 ? "••••" : `••••${value.slice(-4)}`;
  if (value.length <= 5) return "•".repeat(value.length);
  return `${value.slice(0, 3)}••••${value.slice(-2)}`;
}

export function envKeyStatuses(groups?: EnvGroup[]): EnvKeyStatus[] {
  return ENV_VARS.filter((v) => !groups || groups.includes(v.group)).map((v) => {
    const value = env.get(v.key);
    return {
      key: v.key,
      group: v.group,
      set: value !== undefined,
      required: !!v.requiredForLive,
      secret: !!v.secret,
      masked: value !== undefined ? mask(value, !!v.secret) : null,
      pluginId: v.pluginId,
      description: v.description,
    };
  });
}

export function missingLiveKeys(): string[] {
  return REQUIRED_LIVE_KEYS.filter((k) => !env.has(k));
}

export function envFilePresent(): boolean {
  try {
    return existsSync(path.join(process.cwd(), ".env")) || existsSync(path.join(process.cwd(), ".env.local"));
  } catch {
    return false;
  }
}
