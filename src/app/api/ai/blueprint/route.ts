import { z } from "zod";
import { blueprintRequestSchema } from "@/lib/domain/contracts/ai";
import { takeAiQuota } from "@/lib/server/ai/quota";
import { buildBlueprint } from "@/lib/server/ai/services/blueprint";
import { requestContext } from "@/lib/server/context";
import { route } from "@/lib/server/http/api";

export const runtime = "nodejs";
export const maxDuration = 300;

const querySchema = z.object({ format: z.enum(["json", "editor"]).optional() });

/** Blueprint for an idea ({ideaSetId, ideaId} or {idea}); `?format=editor` returns a Google Ads Editor CSV (all Paused). */
export const POST = route({ body: blueprintRequestSchema, query: querySchema, maxBody: 32 * 1024 }, async ({ req, body, query, client }) => {
  takeAiQuota(client);
  const ctx = await requestContext(req);
  const format = query.format ?? body.format ?? "json";
  const { editor, ...result } = await buildBlueprint(ctx, { ...body, format }, req.signal);
  if (format !== "editor" || !editor) return result;
  const slug = result.blueprint.campaignName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "blueprint";
  return new Response(editor.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-editor.csv"`,
      "x-ai-source": result.source,
      "x-ai-model": result.model ?? "",
      ...(result.fallbackReason ? { "x-ai-fallback-reason": encodeURIComponent(result.fallbackReason) } : {}),
      "x-ai-warnings": encodeURIComponent(JSON.stringify([...result.warnings, ...editor.warnings])),
    },
  });
});
