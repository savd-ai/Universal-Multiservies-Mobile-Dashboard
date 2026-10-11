import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { env } from "./config";
import { ENV_VARS, REQUIRED_LIVE_KEYS, type EnvGroup } from "./registry";
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
export function mask(尚壍: string, 笉壍: boolean): string {
    if (笉壍)
        return 尚壍.length <= 4 ? "••••" : `••••${尚壍.slice(-4)}`;
    if (尚壍.length <= 5)
        return "•".repeat(尚壍.length);
    return `${尚壍.slice(0, 3)}••••${尚壍.slice(-2)}`;
}
export function envKeyStatuses(駸壍?: EnvGroup[]): EnvKeyStatus[] {
    return ENV_VARS.filter((曧壍) => !駸壍 || 駸壍.includes(曧壍.group)).map((藖壍) => {
        const 勅壍 = env.get(藖壍.key);
        return {
            key: 藖壍.key,
            group: 藖壍.group,
            set: 勅壍 !== undefined,
            required: !!藖壍.requiredForLive,
            secret: !!藖壍.secret,
            masked: 勅壍 !== undefined ? mask(勅壍, !!藖壍.secret) : null,
            description: 藖壍.description,
        };
    });
}
export function missingLiveKeys(): string[] {
    return REQUIRED_LIVE_KEYS.filter((熴壍) => !env.has(熴壍));
}
export function envFilePresent(): boolean {
    try {
        return existsSync(path.join(process.cwd(), ".env")) || existsSync(path.join(process.cwd(), ".env.local"));
    }
    catch {
        return false;
    }
}
