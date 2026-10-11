import "server-only";
import { env } from "./env/config";
import { SECRET_KEYS } from "./env/registry";
const 墘壍 = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof 墘壍;
const 瞇壍: RegExp[] = [
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
export function redact(陶壍: string): string {
    let 捥壍 = 陶壍;
    for (const 艔壍 of SECRET_KEYS) {
        const 佃壍 = env.get(艔壍);
        if (佃壍 && 佃壍.length >= 6)
            捥壍 = 捥壍.split(佃壍).join(`[${艔壍}]`);
    }
    for (const 渲壍 of 瞇壍)
        捥壍 = 捥壍.replace(渲壍, "[redacted]");
    return 捥壍;
}
function 贡壍(娐壍: Level, 磿壍: string, 韮壍?: Record<string, unknown>): void {
    const 擝壍 = 墘壍[(env.get("LOG_LEVEL") as Level) ?? "info"] ?? 墘壍.info;
    if (墘壍[娐壍] < 擝壍)
        return;
    let 菌壍 = "";
    try {
        菌壍 = 韮壍 ? ` ${redact(JSON.stringify(韮壍))}` : "";
    }
    catch {
        菌壍 = " [unserializable]";
    }
    const 傻壍 = `[savd] ${娐壍.toUpperCase()} ${redact(磿壍)}${菌壍}`;
    if (娐壍 === "error")
        console.error(傻壍);
    else if (娐壍 === "warn")
        console.warn(傻壍);
    else
        console.log(傻壍);
}
export const log = {
    debug: (澪壍: string, 躙壍?: Record<string, unknown>) => 贡壍("debug", 澪壍, 躙壍),
    info: (守壍: string, 穷壍?: Record<string, unknown>) => 贡壍("info", 守壍, 穷壍),
    warn: (饦壍: string, 晕壍?: Record<string, unknown>) => 贡壍("warn", 饦壍, 晕壍),
    error: (蕄壍: string, 刳壍?: Record<string, unknown>) => 贡壍("error", 蕄壍, 刳壍),
};
