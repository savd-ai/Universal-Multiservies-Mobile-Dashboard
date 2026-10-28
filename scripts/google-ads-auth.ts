import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { consentUrl, maskSecret, parseClientFile, pkcePair, TOKEN_URL, upsertEnv, type OAuthClient } from "./google-ads-auth-lib";
const ENV_FILE = path.resolve(process.cwd(), ".env");
const CONSENT_TIMEOUT_MS = 5 * 60000;
function arg(name: string): string | undefined {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
function newestDownloadedClientFile(): string | undefined {
    const dir = path.join(homedir(), "Downloads");
    try {
        return readdirSync(dir)
            .filter((f) => /^client_secret_.*\.json$/.test(f))
            .map((f) => path.join(dir, f))
            .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
    }
    catch {
        return undefined;
    }
}
function ask(question: string): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(question, (a) => (rl.close(), resolve(a.trim()))));
}
function askHidden(question: string): Promise<string> {
    if (!process.stdin.isTTY)
        return ask(question);
    process.stdout.write(question);
    return new Promise((resolve, reject) => {
        let value = "";
        const stdin = process.stdin;
        const done = (fn: () => void) => {
            stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener("data", onData);
            process.stdout.write("\n");
            fn();
        };
        const onData = (buf: Buffer) => {
            for (const ch of buf.toString("utf8")) {
                if (ch === "\r" || ch === "\n")
                    return done(() => resolve(value.trim()));
                if (ch === "\u0003")
                    return done(() => reject(new Error("Cancelled.")));
                if (ch === "\u007f" || ch === "\b")
                    value = value.slice(0, -1);
                else if (ch >= " ")
                    value += ch;
            }
        };
        stdin.setRawMode(true);
        stdin.resume();
        stdin.on("data", onData);
    });
}
async function resolveClient(): Promise<{
    client: OAuthClient;
    from: string;
}> {
    const file = arg("client-file") ?? newestDownloadedClientFile();
    if (file)
        return { client: parseClientFile(readFileSync(file, "utf8")), from: file };
    const id = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
    const secret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
    if (id && secret)
        return { client: { clientId: id, clientSecret: secret, kind: "installed" }, from: ".env" };
    const clientId = id || (await ask("OAuth client ID (…apps.googleusercontent.com): "));
    const clientSecret = secret || (await askHidden("OAuth client secret (hidden): "));
    if (!clientId || !clientSecret)
        throw new Error("A client ID and secret are required.");
    return { client: { clientId, clientSecret, kind: "installed" }, from: "prompt" };
}
function openInBrowser(url: string): void {
    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
    spawn(cmd, [url], { stdio: "ignore", detached: true }).on("error", () => undefined).unref();
}
async function waitForCode(port: number, onListening: (redirectUri: string) => void, state: string): Promise<{
    code: string;
    redirectUri: string;
}> {
    return new Promise((resolve, reject) => {
        let redirectUri = "";
        const server = createServer((req, res) => {
            const url = new URL(req.url ?? "/", "http://127.0.0.1");
            if (url.pathname !== "/") {
                res.writeHead(404).end();
                return;
            }
            const finish = (ok: boolean, text: string) => {
                res.writeHead(ok ? 200 : 400, { "content-type": "text/html; charset=utf-8" });
                res.end(`<!doctype html><meta charset="utf-8"><title>SAVD · Google Ads</title><body style="font:16px system-ui;padding:40px">${text}</body>`);
                clearTimeout(timer);
                server.close();
            };
            const error = url.searchParams.get("error");
            const code = url.searchParams.get("code");
            if (error) {
                finish(false, "Google returned an error — see the terminal.");
                reject(new Error(`Consent failed: ${error}`));
            }
            else if (url.searchParams.get("state") !== state || !code) {
                finish(false, "Unexpected request — see the terminal.");
                reject(new Error("State mismatch or missing code."));
            }
            else {
                finish(true, "Done — return to the terminal. You can close this tab.");
                resolve({ code, redirectUri });
            }
        });
        const timer = setTimeout(() => {
            server.close();
            reject(new Error("No consent within 5 minutes."));
        }, CONSENT_TIMEOUT_MS);
        server.on("error", reject);
        server.listen(port, "127.0.0.1", () => {
            redirectUri = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
            onListening(redirectUri);
        });
    });
}
async function exchange(client: OAuthClient, code: string, redirectUri: string, verifier: string): Promise<string> {
    const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: client.clientId, client_secret: client.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: verifier }),
        signal: AbortSignal.timeout(30000),
    });
    const body = (await res.json().catch(() => ({}))) as {
        refresh_token?: string;
        scope?: string;
        error?: string;
        error_description?: string;
    };
    if (!res.ok)
        throw new Error(`Token exchange failed: ${body.error ?? res.status}${body.error_description ? ` — ${body.error_description}` : ""}`);
    if (!body.refresh_token)
        throw new Error("Google returned no refresh token. Remove the app's access at myaccount.google.com/permissions and run again.");
    if (body.scope && !body.scope.split(" ").includes("https://www.googleapis.com/auth/adwords"))
        throw new Error("The adwords scope was not granted.");
    return body.refresh_token;
}
function writeEnv(updates: Record<string, string>): void {
    const before = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
    const tmp = `${ENV_FILE}.tmp-${process.pid}`;
    writeFileSync(tmp, upsertEnv(before, updates), { mode: 0o600 });
    renameSync(tmp, ENV_FILE);
    chmodSync(ENV_FILE, 0o600);
}
async function main(): Promise<number> {
    if (existsSync(ENV_FILE))
        process.loadEnvFile?.(ENV_FILE);
    console.log("SAVD · Google Ads OAuth (adwords scope, read by this dashboard only)");
    const { client, from: value } = await resolveClient();
    console.log(`  Client ${client.clientId} (${client.kind === "installed" ? "Desktop app" : "Web application"}) from ${value}`);
    const port = Number(arg("port") ?? (client.kind === "web" ? 8085 : 0));
    if (client.kind === "web")
        console.log(`  Web client: http://127.0.0.1:${port} must be an authorized redirect URI on this client.`);
    const state = randomBytes(16).toString("base64url");
    const { verifier, challenge } = pkcePair();
    const { code, redirectUri } = await waitForCode(port, (redirectUri2) => {
        const url = consentUrl({ clientId: client.clientId, redirectUri: redirectUri2, state, challenge, loginHint: arg("login-hint") });
        console.log("  Sign in with the Google account that can open the Google Ads accounts, then click Allow:");
        console.log(`  ${url}`);
        if (!flag("no-open"))
            openInBrowser(url);
        console.log("  Waiting for consent (5 min)…");
    }, state);
    const refreshToken = await exchange(client, code, redirectUri, verifier);
    writeEnv({ GOOGLE_ADS_CLIENT_ID: client.clientId, GOOGLE_ADS_CLIENT_SECRET: client.clientSecret, GOOGLE_ADS_REFRESH_TOKEN: refreshToken });
    console.log(`✓ .env updated: CLIENT_ID set · CLIENT_SECRET ${maskSecret(client.clientSecret)} · REFRESH_TOKEN ${maskSecret(refreshToken)}`);
    if (value !== ".env" && value !== "prompt")
        console.log(`  The client file still holds the secret — delete it when you no longer need it: ${value}`);
    console.log("  Next: npm run check:google-ads");
    return 0;
}
main().then((code) => process.exit(code), (err: unknown) => {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
});
