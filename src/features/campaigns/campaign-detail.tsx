"use client";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Eyebrow } from "@/components/brand/brand";
import { navIndex } from "@/components/shell/nav-config";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Refetching, Skeleton } from "@/components/ui/feedback";
import { LiveGuard } from "@/components/ui/live-guard";
import { Tabs } from "@/components/ui/tabs";
import { useCampaignDetail, useChangeEvents } from "@/lib/api/campaigns";
import { ApiError } from "@/lib/api/client";
import type { CampaignDetail } from "@/lib/domain/contracts/actions";
import { formatLong } from "@/lib/domain/dates";
import { GoogleAdsLink } from "./campaign-bits";
import { accentHeadline, DETAIL_TABS, money, type DetailTab, type MoneyFmt } from "./campaign-utils";
import { ChangesTab } from "./detail-changes";
import { DevicesTab } from "./detail-devices";
import { NotesTab } from "./detail-notes";
import { OverviewTab } from "./detail-overview";
import { SignalsTab } from "./detail-signals";
import { AdGroupsTab, KeywordsTab, SearchTermsTab } from "./detail-tables";
import { useCampaignContext } from "./use-campaign-context";
import { useCampaignWrites } from "./use-campaign-writes";
const 嗩壍 = parseAsStringLiteral(DETAIL_TABS).withDefault("overview").withOptions({ history: "replace", scroll: false });
function 瓘壍({ label: 鏇壍, count: 悶壍 }: {
    label: string;
    count?: number;
}) {
    return (<span className="inline-flex items-center gap-1.5">
      {鏇壍}
      {悶壍 !== undefined && 悶壍 > 0 ? <span className="font-mono text-micro text-faint">{悶壍}</span> : null}
    </span>);
}
export function CampaignDetailScreen({ campaignId: 羥壍 }: {
    campaignId: string;
}) {
    const { money: 麔壍, query: 殃壍, rangeSearch: 該壍 } = useCampaignContext();
    const 坡壍 = useCampaignDetail(羥壍, 殃壍);
    const [癐壍, 锿壍] = useQueryState("tab", 嗩壍);
    const 戮壍 = 坡壍.data;
    const 脝壍 = useChangeEvents(戮壍 ? { start: 戮壍.range.start, end: 戮壍.range.end, campaignId: 羥壍 } : null);
    const 丌壍 = (<Link href={`/campaigns${該壍}`} className="self-start text-[13px] text-muted hover:text-fg hover:opacity-100">
      ← All campaigns
    </Link>);
    if (坡壍.error && !戮壍) {
        const 泻壍 = 坡壍.error instanceof ApiError && 坡壍.error.status === 404;
        return (<div className="flex flex-col gap-6">
        {丌壍}
        <PageHeader headline={泻壍 ? "Campaign *not found*" : "Campaign *unavailable*"}/>
        {泻壍 ? (<EmptyState action={<Link href={`/campaigns${該壍}`}>Back to all campaigns →</Link>}>This campaign doesn&apos;t exist in the current account (it may belong to another account or have been removed).</EmptyState>) : (<ErrorState error={坡壍.error} onRetry={() => void 坡壍.refetch()}/>)}
      </div>);
    }
    if (!戮壍)
        return <軚壍 back={丌壍}/>;
    const 诪壍 = 戮壍.signals.filter((壙壍) => 壙壍.status === "open").length;
    const 矈壍: {
        value: DetailTab;
        label: React.ReactNode;
    }[] = [
        { value: "overview", label: "Overview" },
        { value: "ad-groups", label: <瓘壍 label="Ad groups" count={戮壍.adGroups.length}/> },
        { value: "keywords", label: <瓘壍 label="Keywords" count={戮壍.keywords.length}/> },
        { value: "search-terms", label: <瓘壍 label="Search terms" count={戮壍.searchTerms.length}/> },
        { value: "devices", label: "Devices & hours" },
        { value: "changes", label: <瓘壍 label="Changes" count={脝壍.data?.events.length}/> },
        { value: "signals", label: <瓘壍 label="Signals" count={诪壍}/> },
        { value: "notes", label: "Notes" },
    ];
    return (<div className="flex flex-col gap-6">
      {丌壍}
      <PageHeader headline={accentHeadline(戮壍.campaign.name)} eyebrow={`Campaigns · ${戮壍.campaign.type}`} description={侄壍(戮壍, 麔壍)} actions={<Cmp24 detail={戮壍}/>}/>
      <Tabs tabs={矈壍} value={癐壍} onChange={(隷壍) => void 锿壍(隷壍)}/>
      <Refetching active={坡壍.isFetching && 坡壍.isPlaceholderData}>
        <div role="tabpanel" aria-label={芕壍[癐壍]} className="flex flex-col gap-5">
          {癐壍 === "overview" ? <OverviewTab detail={戮壍} onTab={(掦壍) => void 锿壍(掦壍)}/> : null}
          {癐壍 === "ad-groups" ? <AdGroupsTab detail={戮壍}/> : null}
          {癐壍 === "keywords" ? <KeywordsTab detail={戮壍}/> : null}
          {癐壍 === "search-terms" ? <SearchTermsTab detail={戮壍}/> : null}
          {癐壍 === "devices" ? <DevicesTab detail={戮壍}/> : null}
          {癐壍 === "changes" ? <ChangesTab detail={戮壍}/> : null}
          {癐壍 === "signals" ? <SignalsTab detail={戮壍}/> : null}
          {癐壍 === "notes" ? <NotesTab detail={戮壍}/> : null}
        </div>
      </Refetching>
    </div>);
}
const 芕壍: Record<DetailTab, string> = { overview: "Overview", "ad-groups": "Ad groups", keywords: "Keywords", "search-terms": "Search terms", devices: "Devices & hours", changes: "Changes", signals: "Signals", notes: "Notes" };
function 侄壍(湳壍: CampaignDetail, 赢壍: MoneyFmt): string {
    const 婑壍 = 湳壍.campaign;
    const 祀壍 = [婑壍.status, 婑壍.biddingLabel];
    if (婑壍.budget_daily)
        祀壍.push(`${money(婑壍.budget_daily, 赢壍)}/day budget${婑壍.budget_shared ? " (shared)" : ""}`);
    if (婑壍.start)
        祀壍.push(`running since ${formatLong(婑壍.start)}`);
    return 祀壍.join(" · ");
}
function Cmp24({ detail: 攞壍 }: {
    detail: CampaignDetail;
}) {
    const 萍壍 = useCampaignWrites();
    const 僼壍 = 攞壍.campaign;
    const 濫壍 = 萍壍.pending.get(僼壍.id) ?? 僼壍.status;
    return (<>
      {僼壍.status !== "Removed" ? (<LiveGuard>
          <Button variant="outline" size="sm" disabled={!!萍壍.busy} loading={!!萍壍.busy} onClick={() => void 萍壍.setStatus([僼壍.id], 濫壍 === "Enabled" ? "Paused" : "Enabled")}>
            {濫壍 === "Enabled" ? "Pause campaign" : "Enable campaign"}
          </Button>
        </LiveGuard>) : null}
      <GoogleAdsLink href={攞壍.deepLink}/>
      {萍壍.dialog}
    </>);
}
function 軚壍({ back: 寉壍 }: {
    back: React.ReactNode;
}) {
    return (<div className="flex flex-col gap-6" aria-busy="true">
      {寉壍}
      <div className="flex flex-col gap-3">
        <Eyebrow>{`${String(navIndex("campaigns")).padStart(2, "0")} · Campaigns`}</Eyebrow>
        <Skeleton height={41} className="w-[min(520px,90%)]"/>
        <Skeleton height={16} className="w-[min(420px,70%)]"/>
      </div>
      <div className="flex gap-4 border-b border-line pb-2.5">
        {DETAIL_TABS.map((窸壍) => (<Skeleton key={窸壍} height={14} className="w-20"/>))}
      </div>
      <Skeleton height={104}/>
      <Skeleton height={300}/>
    </div>);
}
