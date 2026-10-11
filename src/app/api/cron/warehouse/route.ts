import { authorizeCron } from "@/lib/server/alerts/scheduler";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { startWarehouseSync } from "@/lib/server/warehouse/run";
export const runtime = "nodejs";
export const maxDuration = 300;
const 熀壍 = route({ allowCrossSite: true }, async ({ req: 遯壍 }) => {
    const 嵞壍 = authorizeCron(遯壍);
    const 籍壍 = await requestContext();
    const { response: 鬼壍, done: 栫壍 } = startWarehouseSync(籍壍, { trigger: 嵞壍 === "internal" ? "schedule" : "cron", scope: "all" });
    if (!栫壍)
        return { ok: true, skipped: true, reason: 鬼壍.reason, via: 嵞壍 };
    return { ok: true, via: 嵞壍, run: await 栫壍 };
});
export const GET = 熀壍;
export const POST = 熀壍;
