"use client";
import { parseAsString, useQueryState } from "nuqs";
import { PullQuote } from "@/components/brand/brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { EmptyState, ErrorState, Refetching, Skeleton, SkeletonLines } from "@/components/ui/feedback";
import { DeltaText } from "@/components/ui/status";
import { Card, CardHeader } from "@/components/ui/surfaces";
import { useChangeEvents, useChangeImpact } from "@/lib/api/campaigns";
import type { CampaignDetail, ChangeImpactMetric } from "@/lib/domain/contracts/actions";
import { formatLong, formatRange, formatShort } from "@/lib/domain/dates";
import { deltaSentiment, formatDelta, formatMetricValue } from "@/lib/domain/metrics/registry";
import type { ChangeEvent } from "@/lib/domain/schema/facts";
import type { MetricDirection } from "@/lib/domain/types";
import { formatPValue, impactVerdict, money, type MoneyFmt } from "./campaign-utils";
import { useCampaignContext } from "./use-campaign-context";
const RESOURCE_LABEL: Record<ChangeEvent["resource_type"], string> = {
    CAMPAIGN: "Campaign",
    CAMPAIGN_BUDGET: "Budget",
    AD_GROUP: "Ad group",
    AD_GROUP_AD: "Ad",
    AD_GROUP_CRITERION: "Keyword / targeting",
    CAMPAIGN_CRITERION: "Campaign targeting",
    ASSET: "Asset",
    OTHER: "Other",
};
const CLIENT_LABEL: Record<string, string> = {
    GOOGLE_ADS_WEB_CLIENT: "Google Ads web",
    GOOGLE_ADS_EDITOR: "Google Ads Editor",
    GOOGLE_ADS_API: "Google Ads API",
    GOOGLE_ADS_SCRIPTS: "Google Ads scripts",
    GOOGLE_ADS_AUTOMATED_RULE: "Automated rule",
    GOOGLE_ADS_BULK_UPLOAD: "Bulk upload",
    GOOGLE_ADS_RECOMMENDATIONS: "Recommendations",
    GOOGLE_ADS_MOBILE_APP: "Google Ads app",
    INTERNAL_TOOL: "Google internal tool",
    SEARCH_ADS_360_SYNC: "Search Ads 360",
    SEARCH_ADS_360_POST: "Search Ads 360",
    OTHER: "Other",
};
const FIELD_LABEL: Record<string, string> = {
    bidding_strategy_type: "Bid strategy",
    final_urls: "Final URL",
    status: "Status",
    amount_micros: "Budget",
    amount: "Budget",
    total_amount: "Total budget",
    "target_cpa.target_cpa": "Target CPA",
    "maximize_conversions.target_cpa": "Target CPA",
    "target_roas.target_roas": "Target ROAS",
    "maximize_conversion_value.target_roas": "Target ROAS",
    "ad.name": "Ad name",
};
const humanize = (s: string) => {
    const t = s.replace(/[._]+/g, " ").trim().toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
};
const valueLabel = (v: string | number | null) => (v === null ? "∅" : typeof v === "string" && /^[A-Z][A-Z0-9_]+$/.test(v) ? humanize(v).replace(/\b(cpa|roas|cpc|cpm)\b/gi, (w) => w.toUpperCase()) : String(v));
const IMPACT_DIRECTION: Record<ChangeImpactMetric["metric"], MetricDirection> = { cost: "neutral", conversions: "up_good", cpa: "down_good", ctr: "up_good" };
export function ChangesTab({ detail: d }: {
    detail: CampaignDetail;
}) {
    const { money: m } = useCampaignContext();
    const q = useChangeEvents({ start: d.range.start, end: d.range.end, campaignId: d.campaign.id });
    const [open, setOpen] = useQueryState("event", parseAsString.withOptions({ history: "replace", scroll: false }));
    const events = [...(q.data?.events ?? [])].sort((a, b) => b.ts.localeCompare(a.ts));
    const period = formatRange({ start: q.data?.range.start ?? d.range.start, end: q.data?.range.end ?? d.range.end });
    return (<Card className="flex flex-col gap-2">
      <CardHeader title="Change history" sub={`${period}${q.data ? ` · ${events.length} change${events.length === 1 ? "" : "s"}` : ""}`}/>
      {q.data?.warnings.length ? <p className="m-0 text-xs text-muted-3">{q.data.warnings.join(" ")}</p> : null}
      {q.error && !q.data ? (<ErrorState error={q.error} onRetry={() => void q.refetch()}/>) : !q.data ? (<div className="py-3">
          <SkeletonLines lines={4}/>
        </div>) : events.length === 0 ? (<EmptyState className="mt-2">{`No changes were recorded for this campaign between ${formatLong(q.data.range.start)} and ${formatLong(q.data.range.end)}.`}</EmptyState>) : (<Refetching active={q.isFetching && q.isPlaceholderData} className="flex flex-col">
          {events.map((e) => (<ChangeRow key={e.id} event={e} open={open === e.id} onToggle={() => void setOpen(open === e.id ? null : e.id)} campaignId={d.campaign.id} money={m}/>))}
        </Refetching>)}
    </Card>);
}
function ChangeRow({ event: e, open, onToggle, campaignId, money: m }: {
    event: ChangeEvent;
    open: boolean;
    onToggle: () => void;
    campaignId: string;
    money: MoneyFmt;
}) {
    const time = e.ts.slice(11, 16);
    const client = e.client_type ? (CLIENT_LABEL[e.client_type] ?? humanize(e.client_type)) : null;
    return (<div className="flex flex-col gap-3 border-b border-line-soft py-4 last:border-b-0">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
        <div className="flex w-[84px] shrink-0 flex-col gap-1">
          <span className="font-mono text-meta text-fg">{formatShort(e.date)}</span>
          {time ? <span className="font-mono text-micro text-faint">{time}</span> : null}
        </div>
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <span className="font-mono text-micro tracking-label text-accent uppercase">{`${RESOURCE_LABEL[e.resource_type] ?? e.resource_type} · ${e.operation}`}</span>
          <span className="text-sm leading-snug font-medium">{e.summary}</span>
          {e.diffs.length ? (<div className="flex flex-col gap-1">
              {e.diffs.map((df, i) => (<span key={`${df.field}-${i}`} className="flex flex-wrap items-baseline gap-x-1.5 font-mono text-xs break-all">
                  <span className="text-faint">{FIELD_LABEL[df.field] ?? humanize(df.field)}</span>
                  <span className="text-muted-3">{valueLabel(df.before)}</span>
                  <span aria-hidden className="text-accent">
                    →
                  </span>
                  <span className="sr-only">changed to</span>
                  <span className="text-fg">{valueLabel(df.after)}</span>
                </span>))}
            </div>) : e.changed_fields.length ? (<span className="font-mono text-micro tracking-[0.06em] text-faint">{`Fields · ${e.changed_fields.map((f) => FIELD_LABEL[f] ?? humanize(f)).join(", ")}`}</span>) : null}
          {client || e.actor ? <span className="text-xs text-muted-3">{[client, e.actor].filter(Boolean).join(" · ")}</span> : null}
        </div>
        <Button variant={open ? "outline" : "ghost"} size="xs" onClick={onToggle} aria-expanded={open}>
          {open ? "Hide impact" : "Analyze impact →"}
        </Button>
      </div>
      {open ? <ImpactPanel campaignId={campaignId} eventId={e.id} money={m}/> : null}
    </div>);
}
function impactValue(metric: ChangeImpactMetric, v: number | null, m: MoneyFmt): string {
    if (metric.format === "money")
        return money(v, m, 2, false);
    return formatMetricValue(metric.format, v, { compact: false, decimals: metric.format === "decimal" ? 1 : undefined });
}
function ImpactPanel({ campaignId, eventId, money: m }: {
    campaignId: string;
    eventId: string;
    money: MoneyFmt;
}) {
    const q = useChangeImpact(campaignId, eventId);
    if (q.error && !q.data)
        return <ErrorState error={q.error} onRetry={() => void q.refetch()}/>;
    if (!q.data)
        return <Skeleton height={188} className="sm:ml-[104px]"/>;
    const r = q.data;
    const verdict = impactVerdict(r);
    const cols = "minmax(120px,1.4fr) repeat(3,minmax(76px,1fr)) minmax(84px,1fr) minmax(110px,1.2fr)";
    return (<div className="flex flex-col gap-3.5 rounded-mini border border-line bg-fill p-4 animate-fade-up-fast sm:ml-[104px]">
      <PullQuote attribution={`Welch t-test · ${r.before.days} days before (${formatShort(r.before.start)}–${formatShort(r.before.end)}) vs ${r.after.days} after${r.after.days ? ` (${formatShort(r.after.start)}–${formatShort(r.after.end)})` : ""}`}>
        {verdict.text}
      </PullQuote>
      <div className="relative overflow-x-auto">
        <div role="table" aria-label="Metrics before and after this change" className="flex min-w-[620px] flex-col text-[13px] tabular">
          <div role="row" className="grid gap-3 border-b border-line pb-2 font-mono text-micro tracking-label text-faint uppercase" style={{ gridTemplateColumns: cols }}>
            <span role="columnheader">Metric</span>
            <span role="columnheader" className="text-right">
              Before
            </span>
            <span role="columnheader" className="text-right">
              After
            </span>
            <span role="columnheader" className="text-right">
              Change
            </span>
            <span role="columnheader" className="text-right">
              p-value
            </span>
            <span role="columnheader" className="text-right">
              Result
            </span>
          </div>
          {r.metrics.map((x) => (<div key={x.metric} role="row" className="grid items-center gap-3 border-b border-line-soft py-2.5 last:border-b-0" style={{ gridTemplateColumns: cols }}>
              <span role="rowheader" className="font-medium">
                {x.label}
              </span>
              <span role="cell" className="text-right text-muted">
                {impactValue(x, x.before, m)}
              </span>
              <span role="cell" className="text-right">
                {impactValue(x, x.after, m)}
              </span>
              <span role="cell" className="text-right">
                <DeltaText pct={formatDelta(x.deltaPct)} sentiment={x.significant ? deltaSentiment(IMPACT_DIRECTION[x.metric], x.deltaPct) : null}/>
              </span>
              <span role="cell" className="text-right font-mono text-meta text-muted">
                {formatPValue(x.p)}
              </span>
              <span role="cell" className={cn("text-right text-xs", x.significant ? "font-semibold text-fg" : "text-faint")}>
                {x.significant ? "✓ Significant" : "Not significant"}
              </span>
            </div>))}
        </div>
      </div>
      {r.note ? <p className="m-0 text-xs text-muted-3">{r.note}</p> : null}
      <p className="m-0 text-xs leading-normal text-faint">Daily values are compared with a two-sided Welch t-test; p &lt; 0.05 counts as significant. Other changes and seasonality in the same window can also move these metrics.</p>
    </div>);
}
