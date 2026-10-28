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
function rawKey(): Buffer | null {
    const v = env.get("APP_ENCRYPTION_KEY");
    if (!v)
        return null;
    const hex = /^[0-9a-fA-F]{64}$/.test(v) ? Buffer.from(v, "hex") : null;
    const buf = hex ?? Buffer.from(v, "base64");
    return buf.length === 32 ? buf : null;
}
function derived(): {
    key: Buffer;
    keyId: string;
} | null {
    const k = rawKey();
    if (!k)
        return null;
    const key = Buffer.from(hkdfSync("sha256", k, Buffer.alloc(0), Buffer.from("savd:secrets:v1"), 32));
    const keyId = createHash("sha256").update(k).digest("hex").slice(0, 8);
    return { key, keyId };
}
export function secretsEnabled(): boolean {
    return derived() !== null;
}
export function encryptSecret(plain: string, aad: string): string {
    const d = derived();
    if (!d)
        throw new SecretsDisabledError();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", d.key, iv);
    cipher.setAAD(Buffer.from(aad));
    const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ["v1", d.keyId, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(":");
}
export function decryptSecret(token: string, aad: string): string {
    const d = derived();
    if (!d)
        throw new SecretsDisabledError();
    const [version, keyId, ivB, tagB, ctB] = token.split(":");
    if (version !== "v1" || !ivB || !tagB || ctB === undefined)
        throw new Error("Unsupported secret format");
    if (keyId !== d.keyId)
        throw new Error("This secret was saved with a different APP_ENCRYPTION_KEY — re-enter it.");
    const decipher = createDecipheriv("aes-256-gcm", d.key, Buffer.from(ivB, "base64url"));
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ctB, "base64url")), decipher.final()]).toString("utf8");
}
export function resolveSecret(ref: SecretRef | undefined, aad: string): string | undefined {
    if (!ref)
        return undefined;
    if ("env" in ref)
        return env.get(ref.env);
    return decryptSecret(ref.enc, aad);
}
export function describeSecret(ref: SecretRef | undefined, aad: string): {
    hasValue: boolean;
    masked: string | null;
    source: "env" | "stored" | null;
} {
    if (!ref)
        return { hasValue: false, masked: null, source: null };
    try {
        const plain = resolveSecret(ref, aad);
        if (!plain)
            return { hasValue: false, masked: null, source: "env" in ref ? "env" : "stored" };
        return { hasValue: true, masked: `••••${plain.slice(-4)}`, source: "env" in ref ? "env" : "stored" };
    }
    catch {
        return { hasValue: true, masked: "•••• (re-enter)", source: "stored" };
    }
}
