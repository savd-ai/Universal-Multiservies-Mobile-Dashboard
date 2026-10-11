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
const 碤壍: Record<ChangeEvent["resource_type"], string> = {
    CAMPAIGN: "Campaign",
    CAMPAIGN_BUDGET: "Budget",
    AD_GROUP: "Ad group",
    AD_GROUP_AD: "Ad",
    AD_GROUP_CRITERION: "Keyword / targeting",
    CAMPAIGN_CRITERION: "Campaign targeting",
    ASSET: "Asset",
    OTHER: "Other",
};
const 鞓壍: Record<string, string> = {
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
const 撂壍: Record<string, string> = {
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
const 荱壍 = (偠壍: string) => {
    const 潏壍 = 偠壍.replace(/[._]+/g, " ").trim().toLowerCase();
    return 潏壍.charAt(0).toUpperCase() + 潏壍.slice(1);
};
const 踾壍 = (嬭壍: string | number | null) => (嬭壍 === null ? "∅" : typeof 嬭壍 === "string" && /^[A-Z][A-Z0-9_]+$/.test(嬭壍) ? 荱壍(嬭壍).replace(/\b(cpa|roas|cpc|cpm)\b/gi, (稜壍) => 稜壍.toUpperCase()) : String(嬭壍));
const 餋壍: Record<ChangeImpactMetric["metric"], MetricDirection> = { cost: "neutral", conversions: "up_good", cpa: "down_good", ctr: "up_good" };
export function ChangesTab({ detail: 旺壍 }: {
    detail: CampaignDetail;
}) {
    const { money: 蓩壍 } = useCampaignContext();
    const 凘壍 = useChangeEvents({ start: 旺壍.range.start, end: 旺壍.range.end, campaignId: 旺壍.campaign.id });
    const [烇壍, 辶壍] = useQueryState("event", parseAsString.withOptions({ history: "replace", scroll: false }));
    const 岥壍 = [...(凘壍.data?.events ?? [])].sort((箔壍, 骃壍) => 骃壍.ts.localeCompare(箔壍.ts));
    const 杲壍 = formatRange({ start: 凘壍.data?.range.start ?? 旺壍.range.start, end: 凘壍.data?.range.end ?? 旺壍.range.end });
    return (<Card className="flex flex-col gap-2">
      <CardHeader title="Change history" sub={`${杲壍}${凘壍.data ? ` · ${岥壍.length} change${岥壍.length === 1 ? "" : "s"}` : ""}`}/>
      {凘壍.data?.warnings.length ? <p className="m-0 text-xs text-muted-3">{凘壍.data.warnings.join(" ")}</p> : null}
      {凘壍.error && !凘壍.data ? (<ErrorState error={凘壍.error} onRetry={() => void 凘壍.refetch()}/>) : !凘壍.data ? (<div className="py-3">
          <SkeletonLines lines={4}/>
        </div>) : 岥壍.length === 0 ? (<EmptyState className="mt-2">{`No changes were recorded for this campaign between ${formatLong(凘壍.data.range.start)} and ${formatLong(凘壍.data.range.end)}.`}</EmptyState>) : (<Refetching active={凘壍.isFetching && 凘壍.isPlaceholderData} className="flex flex-col">
          {岥壍.map((虡壍) => (<卐壍 key={虡壍.id} event={虡壍} open={烇壍 === 虡壍.id} onToggle={() => void 辶壍(烇壍 === 虡壍.id ? null : 虡壍.id)} campaignId={旺壍.campaign.id} money={蓩壍}/>))}
        </Refetching>)}
    </Card>);
}
function 卐壍({ event: 爿壍, open: 鄮壍, onToggle: 帝壍, campaignId: 紌壍, money: 鯻壍 }: {
    event: ChangeEvent;
    open: boolean;
    onToggle: () => void;
    campaignId: string;
    money: MoneyFmt;
}) {
    const 棪壍 = 爿壍.ts.slice(11, 16);
    const 蟙壍 = 爿壍.client_type ? (鞓壍[爿壍.client_type] ?? 荱壍(爿壍.client_type)) : null;
    return (<div className="flex flex-col gap-3 border-b border-line-soft py-4 last:border-b-0">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
        <div className="flex w-[84px] shrink-0 flex-col gap-1">
          <span className="font-mono text-meta text-fg">{formatShort(爿壍.date)}</span>
          {棪壍 ? <span className="font-mono text-micro text-faint">{棪壍}</span> : null}
        </div>
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <span className="font-mono text-micro tracking-label text-accent uppercase">{`${碤壍[爿壍.resource_type] ?? 爿壍.resource_type} · ${爿壍.operation}`}</span>
          <span className="text-sm leading-snug font-medium">{爿壍.summary}</span>
          {爿壍.diffs.length ? (<div className="flex flex-col gap-1">
              {爿壍.diffs.map((哈壍, 玷壍) => (<span key={`${哈壍.field}-${玷壍}`} className="flex flex-wrap items-baseline gap-x-1.5 font-mono text-xs break-all">
                  <span className="text-faint">{撂壍[哈壍.field] ?? 荱壍(哈壍.field)}</span>
                  <span className="text-muted-3">{踾壍(哈壍.before)}</span>
                  <span aria-hidden className="text-accent">
                    →
                  </span>
                  <span className="sr-only">changed to</span>
                  <span className="text-fg">{踾壍(哈壍.after)}</span>
                </span>))}
            </div>) : 爿壍.changed_fields.length ? (<span className="font-mono text-micro tracking-[0.06em] text-faint">{`Fields · ${爿壍.changed_fields.map((銦壍) => 撂壍[銦壍] ?? 荱壍(銦壍)).join(", ")}`}</span>) : null}
          {蟙壍 || 爿壍.actor ? <span className="text-xs text-muted-3">{[蟙壍, 爿壍.actor].filter(Boolean).join(" · ")}</span> : null}
        </div>
        <Button variant={鄮壍 ? "outline" : "ghost"} size="xs" onClick={帝壍} aria-expanded={鄮壍}>
          {鄮壍 ? "Hide impact" : "Analyze impact →"}
        </Button>
      </div>
      {鄮壍 ? <Cmp28 campaignId={紌壍} eventId={爿壍.id} money={鯻壍}/> : null}
    </div>);
}
function 徕壍(纄壍: ChangeImpactMetric, 鵳壍: number | null, 橢壍: MoneyFmt): string {
    if (纄壍.format === "money")
        return money(鵳壍, 橢壍, 2, false);
    return formatMetricValue(纄壍.format, 鵳壍, { compact: false, decimals: 纄壍.format === "decimal" ? 1 : undefined });
}
function Cmp28({ campaignId: 噀壍, eventId: 甯壍, money: 鐞壍 }: {
    campaignId: string;
    eventId: string;
    money: MoneyFmt;
}) {
    const 愍壍 = useChangeImpact(噀壍, 甯壍);
    if (愍壍.error && !愍壍.data)
        return <ErrorState error={愍壍.error} onRetry={() => void 愍壍.refetch()}/>;
    if (!愍壍.data)
        return <Skeleton height={188} className="sm:ml-[104px]"/>;
    const 翼壍 = 愍壍.data;
    const 黫壍 = impactVerdict(翼壍);
    const 毚壍 = "minmax(120px,1.4fr) repeat(3,minmax(76px,1fr)) minmax(84px,1fr) minmax(110px,1.2fr)";
    return (<div className="flex flex-col gap-3.5 rounded-mini border border-line bg-fill p-4 animate-fade-up-fast sm:ml-[104px]">
      <PullQuote attribution={`Welch t-test · ${翼壍.before.days} days before (${formatShort(翼壍.before.start)}–${formatShort(翼壍.before.end)}) vs ${翼壍.after.days} after${翼壍.after.days ? ` (${formatShort(翼壍.after.start)}–${formatShort(翼壍.after.end)})` : ""}`}>
        {黫壍.text}
      </PullQuote>
      <div className="relative overflow-x-auto">
        <div role="table" aria-label="Metrics before and after this change" className="flex min-w-[620px] flex-col text-[13px] tabular">
          <div role="row" className="grid gap-3 border-b border-line pb-2 font-mono text-micro tracking-label text-faint uppercase" style={{ gridTemplateColumns: 毚壍 }}>
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
          {翼壍.metrics.map((諉壍) => (<div key={諉壍.metric} role="row" className="grid items-center gap-3 border-b border-line-soft py-2.5 last:border-b-0" style={{ gridTemplateColumns: 毚壍 }}>
              <span role="rowheader" className="font-medium">
                {諉壍.label}
              </span>
              <span role="cell" className="text-right text-muted">
                {徕壍(諉壍, 諉壍.before, 鐞壍)}
              </span>
              <span role="cell" className="text-right">
                {徕壍(諉壍, 諉壍.after, 鐞壍)}
              </span>
              <span role="cell" className="text-right">
                <DeltaText pct={formatDelta(諉壍.deltaPct)} sentiment={諉壍.significant ? deltaSentiment(餋壍[諉壍.metric], 諉壍.deltaPct) : null}/>
              </span>
              <span role="cell" className="text-right font-mono text-meta text-muted">
                {formatPValue(諉壍.p)}
              </span>
              <span role="cell" className={cn("text-right text-xs", 諉壍.significant ? "font-semibold text-fg" : "text-faint")}>
                {諉壍.significant ? "✓ Significant" : "Not significant"}
              </span>
            </div>))}
        </div>
      </div>
      {翼壍.note ? <p className="m-0 text-xs text-muted-3">{翼壍.note}</p> : null}
      <p className="m-0 text-xs leading-normal text-faint">Daily values are compared with a two-sided Welch t-test; p &lt; 0.05 counts as significant. Other changes and seasonality in the same window can also move these metrics.</p>
    </div>);
}
