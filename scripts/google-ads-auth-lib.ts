import { createHash, randomBytes } from "node:crypto";
export const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const ADWORDS_SCOPE = "https://www.googleapis.com/auth/adwords";
export interface OAuthClient {
    clientId: string;
    clientSecret: string;
    kind: "installed" | "web";
}
export function parseClientFile(text: string): OAuthClient {
    let doc: unknown;
    try {
        doc = JSON.parse(text);
    }
    catch {
        throw new Error("The client file is not valid JSON.");
    }
    const root = (doc ?? {}) as Record<string, unknown>;
    const kind = root.installed ? "installed" : root.web ? "web" : null;
    const entry = kind ? (root[kind] as Record<string, unknown>) : null;
    const clientId = typeof entry?.client_id === "string" ? entry.client_id : "";
    const clientSecret = typeof entry?.client_secret === "string" ? entry.client_secret : "";
    if (!kind || !clientId || !clientSecret)
        throw new Error("The client file has no installed/web client_id and client_secret.");
    return { clientId, clientSecret, kind };
}
export function pkcePair(): {
    verifier: string;
    challenge: string;
} {
    const verifier = randomBytes(48).toString("base64url");
    return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}
export function consentUrl(p: {
    clientId: string;
    redirectUri: string;
    state: string;
    challenge: string;
    loginHint?: string;
}): string {
    const q = new URLSearchParams({
        client_id: p.clientId,
        redirect_uri: p.redirectUri,
        response_type: "code",
        scope: ADWORDS_SCOPE,
        access_type: "offline",
        prompt: "consent",
        code_challenge: p.challenge,
        code_challenge_method: "S256",
        state: p.state,
    });
    if (p.loginHint)
        q.set("login_hint", p.loginHint);
    return `${AUTH_URL}?${q.toString()}`;
}
export function upsertEnv(text: string, updates: Record<string, string>): string {
    const lines = text.length ? text.replace(/\r\n/g, "\n").split("\n") : [];
    if (lines.length && lines[lines.length - 1] === "")
        lines.pop();
    for (const [key, value] of Object.entries(updates)) {
        if (/[\r\n]/.test(value))
            throw new Error(`${key} contains a line break.`);
        const i = lines.findIndex((l) => new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`).test(l));
        if (i >= 0)
            lines[i] = `${key}=${value}`;
        else
            lines.push(`${key}=${value}`);
    }
    return `${lines.join("\n")}\n`;
}
export const maskSecret = (v: string) => (v.length <= 4 ? "••••" : `••••${v.slice(-4)}`);
