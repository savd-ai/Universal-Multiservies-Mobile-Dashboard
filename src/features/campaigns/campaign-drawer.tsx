"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorState, Refetching, Skeleton, SkeletonLines } from "@/components/ui/feedback";
import { LiveGuard, READ_ONLY_COPY } from "@/components/ui/live-guard";
import { Drawer } from "@/components/ui/overlays";
import { AreaSpark } from "@/components/ui/spark";
import { useCampaignDetail } from "@/lib/api/campaigns";
import { ApiError } from "@/lib/api/client";
import type { CampaignDetail } from "@/lib/domain/contracts/actions";
import { GoogleAdsLink, KpiMiniGrid, MetricDelta, PacingBlock, SignalItem, type MiniKpi } from "./campaign-bits";
import { adjustBudget, formatMetric, money, pacingMonthOf, rangeShortLabel, type MetricKey, type MoneyFmt } from "./campaign-utils";
import { useCampaignContext, useCampaignParam } from "./use-campaign-context";
import { useCampaignWrites } from "./use-campaign-writes";
const 馧壍: {
    key: MetricKey;
    label: string;
}[] = [
    { key: "cost", label: "Spend" },
    { key: "conversions", label: "Conversions" },
    { key: "cpa", label: "CPA" },
    { key: "roas", label: "ROAS" },
    { key: "ctr", label: "CTR" },
    { key: "cpc", label: "CPC" },
];
export function CampaignDrawerHost() {
    const [暖壍, 薅壍] = useCampaignParam();
    const { query: 剴壍 } = useCampaignContext();
    const 煣壍 = useCampaignDetail(暖壍, 剴壍);
    const 遒壍 = 煣壍.data?.campaign.id === 暖壍 ? 煣壍.data?.campaign : undefined;
    return (<Drawer open={!!暖壍} onOpenChange={(嵁壍) => {
            if (!嵁壍)
                void 薅壍(null);
        }} eyebrow={遒壍 ? `${遒壍.type} · ${遒壍.status}` : "Campaign"} title={遒壍 ? (遒壍.name) : 煣壍.error ? ("Campaign unavailable") : (<span className="inline-block h-6 w-56 animate-shimmer rounded-mini bg-tone/8 align-middle">
            <span className="sr-only">Loading campaign</span>
          </span>)}>
      {暖壍 ? <Cmp25 key={暖壍} id={暖壍}/> : null}
    </Drawer>);
}
function Cmp25({ id: 鬟壍 }: {
    id: string;
}) {
    const { money: 栎壍, query: 蛽壍, compareOn: 召壍, filters: 狛壍, rangeSearch: 释壍 } = useCampaignContext();
    const 庹壍 = useCampaignDetail(鬟壍, 蛽壍);
    const 綨壍 = 庹壍.data;
    if (庹壍.error && !綨壍) {
        const 鲗壍 = 庹壍.error instanceof ApiError && 庹壍.error.status === 404;
        return 鲗壍 ? <p className="m-0 text-[13px] text-muted-3">This campaign doesn&apos;t exist in the current account.</p> : <ErrorState error={庹壍.error} onRetry={() => void 庹壍.refetch()}/>;
    }
    if (!綨壍)
        return <淮壍 />;
    const 榆壍: MiniKpi[] = 馧壍.map((衵壍) => ({
        label: 衵壍.label,
        value: formatMetric(衵壍.key, 綨壍.kpis[衵壍.key], 栎壍),
        delta: 召壍 && 綨壍.prev ? <MetricDelta metric={衵壍.key} cur={綨壍.kpis[衵壍.key]} prev={綨壍.prev[衵壍.key]}/> : undefined,
    }));
    const 啤壍 = 綨壍.campaign.budget_daily;
    const 瑓壍 = 綨壍.signals.filter((鍂壍) => 鍂壍.status === "open");
    return (<Refetching active={庹壍.isFetching && 庹壍.isPlaceholderData} className="flex flex-1 flex-col gap-[22px]">
      <KpiMiniGrid items={榆壍}/>

      <div className="flex flex-col gap-2.5">
        <span className="meta">{`Daily spend · ${rangeShortLabel(狛壍.rangeKey, 狛壍.range)}`}</span>
        <div className="relative h-[140px] border-b border-tone/8">
          <AreaSpark values={綨壍.daily.map((怱壍) => 怱壍.cost)} refLine={啤壍} height={140} gradientId={`drawer-spend-${鬟壍}`} className="absolute inset-0"/>
        </div>
        <span className="text-xs text-muted-3">{啤壍 ? `Dashed line · daily budget ${money(啤壍, 栎壍)}` : "No daily budget set on this campaign."}</span>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="meta">Active signals</span>
        {瑓壍.length ? 瑓壍.map((缠壍) => <SignalItem key={缠壍.id} signal={缠壍}/>) : <span className="text-[13px] text-muted-3">Operating within expected range.</span>}
      </div>

      {綨壍.pacing && 綨壍.pacing.monthlyTarget > 0 ? <Cmp26 detail={綨壍} money={栎壍}/> : null}

      <Cmp27 detail={綨壍} money={栎壍} detailHref={`/campaigns/${encodeURIComponent(鬟壍)}${释壍}`}/>
    </Refetching>);
}
function Cmp26({ detail: 櫾壍, money: 觭壍 }: {
    detail: CampaignDetail;
    money: MoneyFmt;
}) {
    const { status: 囜壍 } = useCampaignContext();
    const 痋壍 = pacingMonthOf(囜壍.data?.dataThrough);
    if (!櫾壍.pacing)
        return null;
    return <PacingBlock pacing={櫾壍.pacing} money={觭壍} monthLabel={痋壍.month} marker={痋壍.marker}/>;
}
function Cmp27({ detail: 憩壍, money: 肘壍, detailHref: 龇壍 }: {
    detail: CampaignDetail;
    money: MoneyFmt;
    detailHref: string;
}) {
    const 汶壍 = useCampaignWrites();
    const 譥壍 = 憩壍.campaign;
    const 塔壍 = 汶壍.pending.get(譥壍.id) ?? 譥壍.status;
    const 睃壍 = 譥壍.budget_daily;
    const 防壍 = (挡壍: number) => (睃壍 ? adjustBudget(睃壍, 挡壍) : null);
    const 舐壍 = 防壍(-10);
    const 仿壍 = 防壍(10);
    return (<div className="mt-auto flex flex-col gap-3 border-t border-line pt-5">
      <div className="flex items-center gap-2.5">
        <span className="meta">Quick actions</span>
              </div>
      {睃壍 && 舐壍 !== null && 仿壍 !== null ? (<div className="grid grid-cols-2 gap-2">
          <LiveGuard className="grid">
            <Button variant="outline" size="sm" className="w-full justify-center" disabled={!!汶壍.busy} loading={汶壍.busy === "budget"} onClick={() => void 汶壍.setBudgets([{ campaignId: 譥壍.id, dailyBudget: 舐壍 }])}>
              {`Budget −10% · ${money(舐壍, 肘壍)}`}
            </Button>
          </LiveGuard>
          <LiveGuard className="grid">
            <Button variant="outline" size="sm" className="w-full justify-center" disabled={!!汶壍.busy} loading={汶壍.busy === "budget"} onClick={() => void 汶壍.setBudgets([{ campaignId: 譥壍.id, dailyBudget: 仿壍 }])}>
              {`Budget +10% · ${money(仿壍, 肘壍)}`}
            </Button>
          </LiveGuard>
        </div>) : null}
      {譥壍.status !== "Removed" ? (<LiveGuard className="grid">
          <Button variant="block" size="md" disabled={!!汶壍.busy} loading={汶壍.busy === "pause" || 汶壍.busy === "enable"} onClick={() => void 汶壍.setStatus([譥壍.id], 塔壍 === "Enabled" ? "Paused" : "Enabled")}>
            {塔壍 === "Enabled" ? "Pause campaign" : "Enable campaign"}
          </Button>
        </LiveGuard>) : null}
      <p className="m-0 text-xs text-muted-3">{READ_ONLY_COPY}</p>
      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <Link href={龇壍}>Open full detail →</Link>
        <GoogleAdsLink href={憩壍.deepLink} variant="link"/>
      </div>
      {汶壍.dialog}
    </div>);
}
function 淮壍() {
    return (<div className="flex flex-col gap-[22px]" aria-busy="true">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-mini bg-tone/8">
        {馧壍.map((賝壍) => (<div key={賝壍.key} className="flex flex-col gap-2 bg-surface px-4 py-3.5">
            <span className="label-mono">{賝壍.label}</span>
            <Skeleton height={24} className="w-24"/>
          </div>))}
      </div>
      <Skeleton height={140}/>
      <SkeletonLines lines={3}/>
    </div>);
}
