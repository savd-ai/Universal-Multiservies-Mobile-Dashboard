import "server-only";
import { env } from "./env/config";
import { SECRET_KEYS } from "./env/registry";
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;
const TOKEN_PATTERNS: RegExp[] = [
    /ya29\.[0-9A-Za-z\-_]+/g,
    /1\/\/[0-9A-Za-z\-_]{20,}/g,
    /sk-ant-[0-9A-Za-z\-_]+/g,
    /sk-[0-9A-Za-z]{20,}/g,
    /AIza[0-9A-Za-z\-_]{30,}/g,
    /Bearer\s+[0-9A-Za-z\-_.~+/=]+/gi,
    /https:\/\/hooks\.slack\.com\/services\/[^\s"']+/g,
    /https:\/\/discord(?:app)?\.com\/api\/webhooks\/[^\s"']+/g,
    /https:\/\/[^\s"']*logic\.azure\.com[^\s"']*/g,
];
export function redact(input: string): string {
    let out = input;
    for (const key of SECRET_KEYS) {
        const v = env.get(key);
        if (v && v.length >= 6)
            out = out.split(v).join(`[${key}]`);
    }
    for (const re of TOKEN_PATTERNS)
        out = out.replace(re, "[redacted]");
    return out;
}
function emit(level: Level, msg: string, data?: Record<string, unknown>): void {
    const min = LEVELS[(env.get("LOG_LEVEL") as Level) ?? "info"] ?? LEVELS.info;
    if (LEVELS[level] < min)
        return;
    let payload = "";
    try {
        payload = data ? ` ${redact(JSON.stringify(data))}` : "";
    }
    catch {
        payload = " [unserializable]";
    }
    const line = `[savd] ${level.toUpperCase()} ${redact(msg)}${payload}`;
    if (level === "error")
        console.error(line);
    else if (level === "warn")
        console.warn(line);
    else
        console.log(line);
}
export const log = {
    debug: (m: string, d?: Record<string, unknown>) => emit("debug", m, d),
    info: (m: string, d?: Record<string, unknown>) => emit("info", m, d),
    warn: (m: string, d?: Record<string, unknown>) => emit("warn", m, d),
    error: (m: string, d?: Record<string, unknown>) => emit("error", m, d),
};
