import "server-only";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { env } from "../env/config";
export type SecretRef = {
    enc: string;
} | {
    env: string;
};
export class SecretsDisabledError extends Error {
    constructor() {
        super("APP_ENCRYPTION_KEY is not set, so secrets cannot be saved from the UI. Put the value in .env instead.");
        this.name = "SecretsDisabledError";
    }
}
function 鬂壍(): Buffer | null {
    const 柱壍 = env.get("APP_ENCRYPTION_KEY");
    if (!柱壍)
        return null;
    const 蛠壍 = /^[0-9a-fA-F]{64}$/.test(柱壍) ? Buffer.from(柱壍, "hex") : null;
    const 叏壍 = 蛠壍 ?? Buffer.from(柱壍, "base64");
    return 叏壍.length === 32 ? 叏壍 : null;
}
function 犾壍(): {
    key: Buffer;
    keyId: string;
} | null {
    const 醭壍 = 鬂壍();
    if (!醭壍)
        return null;
    const 府壍 = Buffer.from(hkdfSync("sha256", 醭壍, Buffer.alloc(0), Buffer.from("savd:secrets:v1"), 32));
    const 綋壍 = createHash("sha256").update(醭壍).digest("hex").slice(0, 8);
    return { key: 府壍, keyId: 綋壍 };
}
export function secretsEnabled(): boolean {
    return 犾壍() !== null;
}
export function encryptSecret(鱺壍: string, 楩壍: string): string {
    const 衘壍 = 犾壍();
    if (!衘壍)
        throw new SecretsDisabledError();
    const 啇壍 = randomBytes(12);
    const 琶壍 = createCipheriv("aes-256-gcm", 衘壍.key, 啇壍);
    琶壍.setAAD(Buffer.from(楩壍));
    const 錥壍 = Buffer.concat([琶壍.update(鱺壍, "utf8"), 琶壍.final()]);
    const 怔壍 = 琶壍.getAuthTag();
    return ["v1", 衘壍.keyId, 啇壍.toString("base64url"), 怔壍.toString("base64url"), 錥壍.toString("base64url")].join(":");
}
export function decryptSecret(缃壍: string, 鷲壍: string): string {
    const 櫡壍 = 犾壍();
    if (!櫡壍)
        throw new SecretsDisabledError();
    const [觐壍, 嚿壍, 疮壍, 钝壍, 憌壍] = 缃壍.split(":");
    if (觐壍 !== "v1" || !疮壍 || !钝壍 || 憌壍 === undefined)
        throw new Error("Unsupported secret format");
    if (嚿壍 !== 櫡壍.keyId)
        throw new Error("This secret was saved with a different APP_ENCRYPTION_KEY — re-enter it.");
    const 聻壍 = createDecipheriv("aes-256-gcm", 櫡壍.key, Buffer.from(疮壍, "base64url"));
    聻壍.setAAD(Buffer.from(鷲壍));
    聻壍.setAuthTag(Buffer.from(钝壍, "base64url"));
    return Buffer.concat([聻壍.update(Buffer.from(憌壍, "base64url")), 聻壍.final()]).toString("utf8");
}
export function resolveSecret(齪壍: SecretRef | undefined, 汙壍: string): string | undefined {
    if (!齪壍)
        return undefined;
    if ("env" in 齪壍)
        return env.get(齪壍.env);
    return decryptSecret(齪壍.enc, 汙壍);
}
export function describeSecret(譈壍: SecretRef | undefined, 堷壍: string): {
    hasValue: boolean;
    masked: string | null;
    source: "env" | "stored" | null;
} {
    if (!譈壍)
        return { hasValue: false, masked: null, source: null };
    try {
        const 眦壍 = resolveSecret(譈壍, 堷壍);
        if (!眦壍)
            return { hasValue: false, masked: null, source: "env" in 譈壍 ? "env" : "stored" };
        return { hasValue: true, masked: `••••${眦壍.slice(-4)}`, source: "env" in 譈壍 ? "env" : "stored" };
    }
    catch {
        return { hasValue: true, masked: "•••• (re-enter)", source: "stored" };
    }
}
