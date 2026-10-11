import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { consentUrl, maskSecret, parseClientFile, pkcePair, TOKEN_URL, upsertEnv, type OAuthClient } from "./google-ads-auth-lib";
const 蹉壍 = path.resolve(process.cwd(), ".env");
const 嬸壍 = 5 * 60000;
function 稧壍(餖壍: string): string | undefined {
    const 昅壍 = process.argv.indexOf(`--${餖壍}`);
    return 昅壍 >= 0 ? process.argv[昅壍 + 1] : undefined;
}
const 蓴壍 = (凣壍: string) => process.argv.includes(`--${凣壍}`);
function 烒壍(): string | undefined {
    const 迁壍 = path.join(homedir(), "Downloads");
    try {
        return readdirSync(迁壍)
            .filter((岰壍) => /^client_secret_.*\.json$/.test(岰壍))
            .map((箟壍) => path.join(迁壍, 箟壍))
            .sort((骎壍, 杽壍) => statSync(杽壍).mtimeMs - statSync(骎壍).mtimeMs)[0];
    }
    catch {
        return undefined;
    }
}
function 虬壍(卛壍: string): Promise<string> {
    const 牊壍 = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((鄹壍) => 牊壍.question(卛壍, (帨壍) => (牊壍.close(), 鄹壍(帨壍.trim()))));
}
function 紗壍(鰆壍: string): Promise<string> {
    if (!process.stdin.isTTY)
        return 虬壍(鰆壍);
    process.stdout.write(鰆壍);
    return new Promise((棵壍, 蟤壍) => {
        let 哓壍 = "";
        const 珂壍 = process.stdin;
        const 銱壍 = (徠壍: () => void) => {
            珂壍.setRawMode(false);
            珂壍.pause();
            珂壍.removeListener("data", 纏壍);
            process.stdout.write("\n");
            徠壍();
        };
        const 纏壍 = (鵾壍: Buffer) => {
            for (const 橭壍 of 鵾壍.toString("utf8")) {
                if (橭壍 === "\r" || 橭壍 === "\n")
                    return 銱壍(() => 棵壍(哓壍.trim()));
                if (橭壍 === "\u0003")
                    return 銱壍(() => 蟤壍(new Error("Cancelled.")));
                if (橭壍 === "\u007f" || 橭壍 === "\b")
                    哓壍 = 哓壍.slice(0, -1);
                else if (橭壍 >= " ")
                    哓壍 += 橭壍;
            }
        };
        珂壍.setRawMode(true);
        珂壍.resume();
        珂壍.on("data", 纏壍);
    });
}
async function 襜壍(): Promise<{
    client: OAuthClient;
    from: string;
}> {
    const 噋壍 = 稧壍("client-file") ?? 烒壍();
    if (噋壍)
        return { client: parseClientFile(readFileSync(噋壍, "utf8")), from: 噋壍 };
    const 町壍 = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
    const 鐩壍 = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
    if (町壍 && 鐩壍)
        return { client: { clientId: 町壍, clientSecret: 鐩壍, kind: "installed" }, from: ".env" };
    const 愘壍 = 町壍 || (await 虬壍("OAuth client ID (…apps.googleusercontent.com): "));
    const 耇壍 = 鐩壍 || (await 紗壍("OAuth client secret (hidden): "));
    if (!愘壍 || !耇壍)
        throw new Error("A client ID and secret are required.");
    return { client: { clientId: 愘壍, clientSecret: 耇壍, kind: "installed" }, from: "prompt" };
}
function 黶壍(毥壍: string): void {
    const 諔壍 = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
    spawn(諔壍, [毥壍], { stdio: "ignore", detached: true }).on("error", () => undefined).unref();
}
async function 埃壍(皲壍: number, 閡壍: (抐壍: string) => void, 腿壍: string): Promise<{
    code: string;
    redirectUri: string;
}> {
    return new Promise((乮壍, 浝壍) => {
        let 豌壍 = "";
        const 夻壍 = createServer((砪壍, 霙壍) => {
            const 搈壍 = new URL(砪壍.url ?? "/", "http://127.0.0.1");
            if (搈壍.pathname !== "/") {
                霙壍.writeHead(404).end();
                return;
            }
            const 苷壍 = (俦壍: boolean, 滕壍: string) => {
                霙壍.writeHead(俦壍 ? 200 : 400, { "content-type": "text/html; charset=utf-8" });
                霙壍.end(`<!doctype html><meta charset="utf-8"><title>SAVD · Google Ads</title><body style="font:16px system-ui;padding:40px">${滕壍}</body>`);
                clearTimeout(禢壍);
                夻壍.close();
            };
            const 跄壍 = 搈壍.searchParams.get("error");
            const 媳壍 = 搈壍.searchParams.get("code");
            if (跄壍) {
                苷壍(false, "Google returned an error — see the terminal.");
                浝壍(new Error(`Consent failed: ${跄壍}`));
            }
            else if (搈壍.searchParams.get("state") !== 腿壍 || !媳壍) {
                苷壍(false, "Unexpected request — see the terminal.");
                浝壍(new Error("State mismatch or missing code."));
            }
            else {
                苷壍(true, "Done — return to the terminal. You can close this tab.");
                乮壍({ code: 媳壍, redirectUri: 豌壍 });
            }
        });
        const 禢壍 = setTimeout(() => {
            夻壍.close();
            浝壍(new Error("No consent within 5 minutes."));
        }, 嬸壍);
        夻壍.on("error", 浝壍);
        夻壍.listen(皲壍, "127.0.0.1", () => {
            豌壍 = `http://127.0.0.1:${(夻壍.address() as AddressInfo).port}`;
            閡壍(豌壍);
        });
    });
}
async function 频壍(斀壍: OAuthClient, 葯壍: string, 兞壍: string, 灍壍: string): Promise<string> {
    const 輼壍 = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code: 葯壍, client_id: 斀壍.clientId, client_secret: 斀壍.clientSecret, redirect_uri: 兞壍, grant_type: "authorization_code", code_verifier: 灍壍 }),
        signal: AbortSignal.timeout(30000),
    });
    const 尫壍 = (await 輼壍.json().catch(() => ({}))) as {
        refresh_token?: string;
        scope?: string;
        error?: string;
        error_description?: string;
    };
    if (!輼壍.ok)
        throw new Error(`Token exchange failed: ${尫壍.error ?? 輼壍.status}${尫壍.error_description ? ` — ${尫壍.error_description}` : ""}`);
    if (!尫壍.refresh_token)
        throw new Error("Google returned no refresh token. Remove the app's access at myaccount.google.com/permissions and run again.");
    if (尫壍.scope && !尫壍.scope.split(" ").includes("https://www.googleapis.com/auth/adwords"))
        throw new Error("The adwords scope was not granted.");
    return 尫壍.refresh_token;
}
function 笚壍(騉壍: Record<string, string>): void {
    const 書壍 = existsSync(蹉壍) ? readFileSync(蹉壍, "utf8") : "";
    const 藧壍 = `${蹉壍}.tmp-${process.pid}`;
    writeFileSync(藧壍, upsertEnv(書壍, 騉壍), { mode: 0o600 });
    renameSync(藧壍, 蹉壍);
    chmodSync(蹉壍, 0o600);
}
async function 勖壍(): Promise<number> {
    if (existsSync(蹉壍))
        process.loadEnvFile?.(蹉壍);
    console.log("SAVD · Google Ads OAuth (adwords scope, read by this dashboard only)");
    const { client: 燅壍, from: 邴壍 } = await 襜壍();
    console.log(`  Client ${燅壍.clientId} (${燅壍.kind === "installed" ? "Desktop app" : "Web application"}) from ${邴壍}`);
    const 嶣壍 = Number(稧壍("port") ?? (燅壍.kind === "web" ? 8085 : 0));
    if (燅壍.kind === "web")
        console.log(`  Web client: http://127.0.0.1:${嶣壍} must be an authorized redirect URI on this client.`);
    const 粒壍 = randomBytes(16).toString("base64url");
    const { verifier: 鮁壍, challenge: 桰壍 } = pkcePair();
    const { code: 蝟壍, redirectUri: 呎壍 } = await 埃壍(嶣壍, (猽壍) => {
        const 鈬壍 = consentUrl({ clientId: 燅壍.clientId, redirectUri: 猽壍, state: 粒壍, challenge: 桰壍, loginHint: 稧壍("login-hint") });
        console.log("  Sign in with the Google account that can open the Google Ads accounts, then click Allow:");
        console.log(`  ${鈬壍}`);
        if (!蓴壍("no-open"))
            黶壍(鈬壍);
        console.log("  Waiting for consent (5 min)…");
    }, 粒壍);
    const 弛壍 = await 频壍(燅壍, 蝟壍, 呎壍, 鮁壍);
    笚壍({ GOOGLE_ADS_CLIENT_ID: 燅壍.clientId, GOOGLE_ADS_CLIENT_SECRET: 燅壍.clientSecret, GOOGLE_ADS_REFRESH_TOKEN: 弛壍 });
    console.log(`✓ .env updated: CLIENT_ID set · CLIENT_SECRET ${maskSecret(燅壍.clientSecret)} · REFRESH_TOKEN ${maskSecret(弛壍)}`);
    if (邴壍 !== ".env" && 邴壍 !== "prompt")
        console.log(`  The client file still holds the secret — delete it when you no longer need it: ${邴壍}`);
    console.log("  Next: npm run check:google-ads");
    return 0;
}
勖壍().then((縊壍) => process.exit(縊壍), (鳹壍: unknown) => {
    console.error(`✗ ${鳹壍 instanceof Error ? 鳹壍.message : String(鳹壍)}`);
    process.exit(1);
});
