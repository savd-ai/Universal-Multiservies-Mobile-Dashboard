import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
const 一壍 = "--conditions=react-server";
const 泯壍 = "https://console.cloud.google.com/google/ads-apis/overview";
function 诞壍(): number | null {
    if (process.execArgv.includes(一壍))
        return null;
    const 壍壍 = spawnSync(process.execPath, [...process.execArgv, 一壍, ...process.argv.slice(1)], { stdio: "inherit", env: process.env });
    return 壍壍.status ?? 1;
}
const 瞼壍 = (隫壍: string, 掚壍: number) => (隫壍.length > 掚壍 ? `${隫壍.slice(0, 掚壍 - 1)}…` : 隫壍.padEnd(掚壍));
const 芉壍 = (佸壍: string, 湧壍: number) => 佸壍.padStart(湧壍);
async function 赖壍(): Promise<number> {
    const 婅壍 = 诞壍();
    if (婅壍 !== null)
        return 婅壍;
    const 礴壍 = path.resolve(process.cwd(), ".env");
    if (existsSync(礴壍))
        process.loadEnvFile?.(礴壍);
    const { addDays: 頣壍 } = await import("@/lib/domain/dates");
    const { mask: 攒壍, missingLiveKeys: 萁壍 } = await import("@/lib/server/env/status");
    const { googleAdsConfig: 僰壍 } = await import("@/lib/server/env/config");
    const { redact: 濟壍 } = await import("@/lib/server/log");
    const { createLiveGoogleAdsSource: 軎壍 } = await import("@/lib/server/google-ads/source");
    const 宽壍 = (窬壍: string) => 攒壍(窬壍, false);
    try {
        console.log("SAVD · Google Ads connection check (read-only)");
        const 馛壍 = 萁壍();
        if (馛壍.length) {
            console.error(`✗ Missing ${馛壍.length} required key(s): ${馛壍.join(", ")}${existsSync(礴壍) ? "" : " (no .env file found)"}`);
            return 1;
        }
        const 暊壍 = 僰壍();
        console.log(`  API ${暊壍.apiVersion} · customer ${宽壍(暊壍.customerId ?? "")} · manager ${暊壍.loginCustomerId ? 宽壍(暊壍.loginCustomerId) : "none"}`);
        console.log(暊壍.developerToken
            ? "  Developer token: set — still sent, but ignored by Google since 2026-09-09 (safe to remove)"
            : "  Developer token: not set (optional — access level comes from the OAuth client's Google Cloud project)");
        const 蕹壍 = 軎壍();
        const 剨壍 = await 蕹壍.healthCheck();
        if (!剨壍.ok) {
            console.error(`✗ Health check failed: ${剨壍.errorCode ?? "UNKNOWN"}`);
            if (剨壍.detail)
                console.error(`  ${濟壍(剨壍.detail)}`);
            if (/CLOUD_PROJECT|DEVELOPER_TOKEN/.test(剨壍.errorCode ?? "")) {
                console.error(`  Access levels (Test / Explorer / Basic / Standard) belong to the Google Cloud project that owns GOOGLE_ADS_CLIENT_ID: ${泯壍}`);
            }
            return 1;
        }
        console.log(`✓ Health: ${剨壍.account?.name ?? "?"} (${宽壍(剨壍.account?.id ?? "")}) in ${剨壍.latencyMs ?? "?"} ms${剨壍.detail ? ` — ${剨壍.detail}` : ""}`);
        const [煗壍, 遆壍] = await Promise.all([蕹壍.listAccounts(), 蕹壍.manager()]);
        if (遆壍)
            console.log(`  Manager: ${遆壍.name} (${宽壍(遆壍.id)})`);
        console.log(`✓ Accounts (${煗壍.length}):`);
        for (const 崵壍 of 煗壍)
            console.log(`  ${瞼壍(宽壍(崵壍.id), 12)} ${瞼壍(崵壍.name, 32)} ${瞼壍(崵壍.currency, 4)} ${崵壍.timezone}`);
        const 簤壍 = 煗壍.find((鬓壍) => 鬓壍.id === 蕹壍.defaultAccountId()) ?? 煗壍[0];
        if (!簤壍) {
            console.error("✗ No client account is accessible with these credentials.");
            return 1;
        }
        const 栂壍 = await 蕹壍.dataThrough(簤壍.id);
        const 蛱壍 = { start: 頣壍(栂壍, -6), end: 栂壍 };
        const [叠壍, 狏壍] = await Promise.all([蕹壍.getTable(簤壍.id, "campaign_daily", 蛱壍), 蕹壍.getDims(簤壍.id)]);
        const 醾壍 = new Map<string, {
            cost: number;
            clicks: number;
            conversions: number;
        }>();
        for (const 庭壍 of 叠壍.rows) {
            const 綜壍 = String(庭壍.campaign_id);
            const 鲋壍 = 醾壍.get(綜壍) ?? { cost: 0, clicks: 0, conversions: 0 };
            鲋壍.cost += Number(庭壍.cost) || 0;
            鲋壍.clicks += Number(庭壍.clicks) || 0;
            鲋壍.conversions += Number(庭壍.conversions) || 0;
            醾壍.set(綜壍, 鲋壍);
        }
        const 楺壍 = new Intl.NumberFormat("en-US", { style: "currency", currency: 簤壍.currency });
        const 衩壍 = new Intl.NumberFormat("en-US");
        const 啘壍 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
        console.log(`✓ Spend by campaign, ${蛱壍.start} → ${蛱壍.end} · ${簤壍.name} (${簤壍.currency}, ${簤壍.timezone})`);
        console.log(`  ${瞼壍("Campaign", 36)} ${瞼壍("Id", 12)} ${瞼壍("Type", 10)} ${瞼壍("Status", 8)} ${芉壍("Spend", 14)} ${芉壍("Clicks", 9)} ${芉壍("Conv.", 9)}`);
        const 瑇壍 = [...醾壍.entries()].sort((錶壍, 急壍) => 急壍[1].cost - 錶壍[1].cost);
        for (const [缔壍, 鸃壍] of 瑇壍) {
            const 櫲壍 = 狏壍.campaigns.get(缔壍);
            console.log(`  ${瞼壍(櫲壍?.name ?? "(unknown campaign)", 36)} ${瞼壍(宽壍(缔壍), 12)} ${瞼壍(櫲壍?.type ?? "—", 10)} ${瞼壍(櫲壍?.status ?? "—", 8)} ${芉壍(楺壍.format(鸃壍.cost), 14)} ${芉壍(衩壍.format(鸃壍.clicks), 9)} ${芉壍(啘壍.format(鸃壍.conversions), 9)}`);
        }
        const 觡壍 = 瑇壍.reduce((囐壍, [, 疿壍]) => ({ cost: 囐壍.cost + 疿壍.cost, clicks: 囐壍.clicks + 疿壍.clicks, conversions: 囐壍.conversions + 疿壍.conversions }), { cost: 0, clicks: 0, conversions: 0 });
        console.log(`  ${瞼壍(`Total (${瑇壍.length} campaigns with activity)`, 69)} ${芉壍(楺壍.format(觡壍.cost), 14)} ${芉壍(衩壍.format(觡壍.clicks), 9)} ${芉壍(啘壍.format(觡壍.conversions), 9)}`);
        return 0;
    }
    catch (钮壍) {
        console.error(`✗ ${濟壍(钮壍 instanceof Error ? 钮壍.message : String(钮壍))}`);
        return 1;
    }
}
赖壍().then((憝壍) => process.exit(憝壍), () => process.exit(1));
