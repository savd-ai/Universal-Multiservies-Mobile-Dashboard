import "server-only";
import type { ChannelKind, ChannelsSummary } from "@/lib/domain/contracts/plugins";
import type { DateRange } from "@/lib/domain/dates";
import { summarizeChannels, type ChannelSource } from "@/lib/domain/plugins/channels";
import type { RequestContext } from "../context";
import { platformRows } from "./platform-rows";
import { allPlugins } from "./registry";

// GET /api/channels: Google Ads + every connected metrics plugin over one range, summarized by the pure ledger
// (spend share over ad platforms only; analytics sessions and commerce revenue / MER reported beside it).

export async function channelsSummary(ctx: RequestContext, range: DateRange): Promise<ChannelsSummary> {
  const [res, plugins] = await Promise.all([platformRows({ google: ctx.source, accountId: ctx.accountId, range, source: "blended" }), allPlugins()]);
  const kindOf = new Map<string, ChannelKind>(plugins.map((p) => [p.manifest.id, p.manifest.category === "analytics" ? "analytics" : p.manifest.category === "commerce" ? "commerce" : "ad_platform"]));
  const sources: ChannelSource[] = res.sources.map((s) => ({ id: s.id, label: s.label, kind: s.id === "google_ads" ? "ad_platform" : (kindOf.get(s.id) ?? "ad_platform"), mode: s.mode, reason: s.reason, stale: s.stale }));
  return summarizeChannels({ rows: res.rows, sources, range, currency: ctx.account.currency, warnings: res.warnings });
}
