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
const tabParser = parseAsStringLiteral(DETAIL_TABS).withDefault("overview").withOptions({ history: "replace", scroll: false });
function TabLabel({ label, count }: {
    label: string;
    count?: number;
}) {
    return (<span className="inline-flex items-center gap-1.5">
      {label}
      {count !== undefined && count > 0 ? <span className="font-mono text-micro text-faint">{count}</span> : null}
    </span>);
}
export function CampaignDetailScreen({ campaignId }: {
    campaignId: string;
}) {
    const { money: m, query, rangeSearch } = useCampaignContext();
    const detail = useCampaignDetail(campaignId, query);
    const [tab, setTab] = useQueryState("tab", tabParser);
    const d = detail.data;
    const changes = useChangeEvents(d ? { start: d.range.start, end: d.range.end, campaignId } : null);
    const back = (<Link href={`/campaigns${rangeSearch}`} className="self-start text-[13px] text-muted hover:text-fg hover:opacity-100">
      ← All campaigns
    </Link>);
    if (detail.error && !d) {
        const missing = detail.error instanceof ApiError && detail.error.status === 404;
        return (<div className="flex flex-col gap-6">
        {back}
        <PageHeader headline={missing ? "Campaign *not found*" : "Campaign *unavailable*"}/>
        {missing ? (<EmptyState action={<Link href={`/campaigns${rangeSearch}`}>Back to all campaigns →</Link>}>This campaign doesn&apos;t exist in the current account (it may belong to another account or have been removed).</EmptyState>) : (<ErrorState error={detail.error} onRetry={() => void detail.refetch()}/>)}
      </div>);
    }
    if (!d)
        return <DetailSkeleton back={back}/>;
    const openSignals = d.signals.filter((s) => s.status === "open").length;
    const tabs: {
        value: DetailTab;
        label: React.ReactNode;
    }[] = [
        { value: "overview", label: "Overview" },
        { value: "ad-groups", label: <TabLabel label="Ad groups" count={d.adGroups.length}/> },
        { value: "keywords", label: <TabLabel label="Keywords" count={d.keywords.length}/> },
        { value: "search-terms", label: <TabLabel label="Search terms" count={d.searchTerms.length}/> },
        { value: "devices", label: "Devices & hours" },
        { value: "changes", label: <TabLabel label="Changes" count={changes.data?.events.length}/> },
        { value: "signals", label: <TabLabel label="Signals" count={openSignals}/> },
        { value: "notes", label: "Notes" },
    ];
    return (<div className="flex flex-col gap-6">
      {back}
      <PageHeader headline={accentHeadline(d.campaign.name)} eyebrow={`Campaigns · ${d.campaign.type}`} description={describe(d, m)} actions={<HeaderActions detail={d}/>}/>
      <Tabs tabs={tabs} value={tab} onChange={(v) => void setTab(v)}/>
      <Refetching active={detail.isFetching && detail.isPlaceholderData}>
        <div role="tabpanel" aria-label={TAB_NAMES[tab]} className="flex flex-col gap-5">
          {tab === "overview" ? <OverviewTab detail={d} onTab={(t) => void setTab(t)}/> : null}
          {tab === "ad-groups" ? <AdGroupsTab detail={d}/> : null}
          {tab === "keywords" ? <KeywordsTab detail={d}/> : null}
          {tab === "search-terms" ? <SearchTermsTab detail={d}/> : null}
          {tab === "devices" ? <DevicesTab detail={d}/> : null}
          {tab === "changes" ? <ChangesTab detail={d}/> : null}
          {tab === "signals" ? <SignalsTab detail={d}/> : null}
          {tab === "notes" ? <NotesTab detail={d}/> : null}
        </div>
      </Refetching>
    </div>);
}
const TAB_NAMES: Record<DetailTab, string> = { overview: "Overview", "ad-groups": "Ad groups", keywords: "Keywords", "search-terms": "Search terms", devices: "Devices & hours", changes: "Changes", signals: "Signals", notes: "Notes" };
function describe(d: CampaignDetail, m: MoneyFmt): string {
    const c = d.campaign;
    const parts = [c.status, c.biddingLabel];
    if (c.budget_daily)
        parts.push(`${money(c.budget_daily, m)}/day budget${c.budget_shared ? " (shared)" : ""}`);
    if (c.start)
        parts.push(`running since ${formatLong(c.start)}`);
    return parts.join(" · ");
}
function HeaderActions({ detail }: {
    detail: CampaignDetail;
}) {
    const writes = useCampaignWrites();
    const c = detail.campaign;
    const status = writes.pending.get(c.id) ?? c.status;
    return (<>
      {c.status !== "Removed" ? (<LiveGuard>
          <Button variant="outline" size="sm" disabled={!!writes.busy} loading={!!writes.busy} onClick={() => void writes.setStatus([c.id], status === "Enabled" ? "Paused" : "Enabled")}>
            {status === "Enabled" ? "Pause campaign" : "Enable campaign"}
          </Button>
        </LiveGuard>) : null}
      <GoogleAdsLink href={detail.deepLink}/>
      {writes.dialog}
    </>);
}
function DetailSkeleton({ back }: {
    back: React.ReactNode;
}) {
    return (<div className="flex flex-col gap-6" aria-busy="true">
      {back}
      <div className="flex flex-col gap-3">
        <Eyebrow>{`${String(navIndex("campaigns")).padStart(2, "0")} · Campaigns`}</Eyebrow>
        <Skeleton height={41} className="w-[min(520px,90%)]"/>
        <Skeleton height={16} className="w-[min(420px,70%)]"/>
      </div>
      <div className="flex gap-4 border-b border-line pb-2.5">
        {DETAIL_TABS.map((t) => (<Skeleton key={t} height={14} className="w-20"/>))}
      </div>
      <Skeleton height={104}/>
      <Skeleton height={300}/>
    </div>);
}
