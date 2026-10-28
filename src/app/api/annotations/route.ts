import { z } from "zod";
import { annotationBodySchema } from "@/lib/domain/contracts/dashboard";
import { addDays } from "@/lib/domain/dates";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";
import { getStore } from "@/lib/server/store";
export const runtime = "nodejs";
const querySchema = z.object({ start: z.string().optional(), end: z.string().optional(), includeChanges: z.enum(["0", "1"]).optional(), campaignId: z.string().optional() });
export const GET = route({ query: querySchema }, async ({ req, query }) => {
    const ctx = await requestContext(req);
    const end = query.end ?? ctx.dataThrough;
    const start = query.start ?? addDays(end, -89);
    const notes = (await getStore().annotations.list((a) => a.date >= start && a.date <= end && (!a.accountId || a.accountId === ctx.accountId) && (!query.campaignId || !a.campaignId || a.campaignId === query.campaignId))).map((a) => ({
        id: a.id,
        date: a.date,
        text: a.text,
        kind: a.kind,
        campaignId: a.campaignId,
        source: "note" as const,
    }));
    const changes = query.includeChanges === "1"
        ? (await ctx.source.getChangeEvents(ctx.accountId, { start, end }))
            .filter((e) => !query.campaignId || e.campaign_id === query.campaignId)
            .slice(0, 200)
            .map((e) => ({ id: e.id, date: e.date, text: e.summary, kind: "change" as const, campaignId: e.campaign_id, source: "change" as const }))
        : [];
    return { annotations: [...notes, ...changes].sort((a, b) => a.date.localeCompare(b.date)) };
});
export const POST = route({ body: annotationBodySchema }, async ({ req, body }) => {
    const ctx = await requestContext(req);
    return getStore().annotations.create({ ...body, accountId: body.accountId ?? ctx.accountId });
});
