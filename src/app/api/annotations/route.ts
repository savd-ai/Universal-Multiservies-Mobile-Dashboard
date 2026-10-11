import { z } from "zod";
import { annotationBodySchema } from "@/lib/domain/contracts/dashboard";
import { addDays } from "@/lib/domain/dates";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { getStore } from "@/lib/server/store";
export const runtime = "nodejs";
const 垕壍 = z.object({ start: z.string().optional(), end: z.string().optional(), includeChanges: z.enum(["0", "1"]).optional(), campaignId: z.string().optional() });
export const GET = route({ query: 垕壍 }, async ({ req: 的壍, query: 镳壍 }) => {
    const 扢壍 = await requestContext(的壍);
    const 腑壍 = 镳壍.end ?? 扢壍.dataThrough;
    const 乀壍 = 镳壍.start ?? addDays(腑壍, -89);
    const 洯壍 = (await getStore().annotations.list((谞壍) => 谞壍.date >= 乀壍 && 谞壍.date <= 腑壍 && (!谞壍.accountId || 谞壍.accountId === 扢壍.accountId) && (!镳壍.campaignId || !谞壍.campaignId || 谞壍.campaignId === 镳壍.campaignId))).map((复壍) => ({
        id: 复壍.id,
        date: 复壍.date,
        text: 复壍.text,
        kind: 复壍.kind,
        campaignId: 复壍.campaignId,
        source: "note" as const,
    }));
    const 矼壍 = 镳壍.includeChanges === "1"
        ? (await 扢壍.source.getChangeEvents(扢壍.accountId, { start: 乀壍, end: 腑壍 }))
            .filter((雫壍) => !镳壍.campaignId || 雫壍.campaign_id === 镳壍.campaignId)
            .slice(0, 200)
            .map((揚壍) => ({ id: 揚壍.id, date: 揚壍.date, text: 揚壍.summary, kind: "change" as const, campaignId: 揚壍.campaign_id, source: "change" as const }))
        : [];
    return { annotations: [...洯壍, ...矼壍].sort((苉壍, 侸壍) => 苉壍.date.localeCompare(侸壍.date)) };
});
export const POST = route({ body: annotationBodySchema }, async ({ req: 溧壍, body: 趖壍 }) => {
    const 媅壍 = await requestContext(溧壍);
    return getStore().annotations.create({ ...趖壍, accountId: 趖壍.accountId ?? 媅壍.accountId });
});
