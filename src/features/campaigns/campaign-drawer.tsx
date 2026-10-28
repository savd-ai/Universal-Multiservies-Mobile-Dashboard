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
const DRAWER_KPIS: {
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
    const [id, setId] = useCampaignParam();
    const { query } = useCampaignContext();
    const detail = useCampaignDetail(id, query);
    const c = detail.data?.campaign.id === id ? detail.data?.campaign : undefined;
    return (<Drawer open={!!id} onOpenChange={(o) => {
            if (!o)
                void setId(null);
        }} eyebrow={c ? `${c.type} · ${c.status}` : "Campaign"} title={c ? (c.name) : detail.error ? ("Campaign unavailable") : (<span className="inline-block h-6 w-56 animate-shimmer rounded-mini bg-tone/8 align-middle">
            <span className="sr-only">Loading campaign</span>
          </span>)}>
      {id ? <DrawerBody key={id} id={id}/> : null}
    </Drawer>);
}
function DrawerBody({ id }: {
    id: string;
}) {
    const { money: m, query, compareOn, filters, rangeSearch } = useCampaignContext();
    const detail = useCampaignDetail(id, query);
    const d = detail.data;
    if (detail.error && !d) {
        const missing = detail.error instanceof ApiError && detail.error.status === 404;
        return missing ? <p className="m-0 text-[13px] text-muted-3">This campaign doesn&apos;t exist in the current account.</p> : <ErrorState error={detail.error} onRetry={() => void detail.refetch()}/>;
    }
    if (!d)
        return <DrawerSkeleton />;
    const kpis: MiniKpi[] = DRAWER_KPIS.map((k) => ({
        label: k.label,
        value: formatMetric(k.key, d.kpis[k.key], m),
        delta: compareOn && d.prev ? <MetricDelta metric={k.key} cur={d.kpis[k.key]} prev={d.prev[k.key]}/> : undefined,
    }));
    const budget = d.campaign.budget_daily;
    const active = d.signals.filter((s) => s.status === "open");
    return (<Refetching active={detail.isFetching && detail.isPlaceholderData} className="flex flex-1 flex-col gap-[22px]">
      <KpiMiniGrid items={kpis}/>

      <div className="flex flex-col gap-2.5">
        <span className="meta">{`Daily spend · ${rangeShortLabel(filters.rangeKey, filters.range)}`}</span>
        <div className="relative h-[140px] border-b border-tone/8">
          <AreaSpark values={d.daily.map((p) => p.cost)} refLine={budget} height={140} gradientId={`drawer-spend-${id}`} className="absolute inset-0"/>
        </div>
        <span className="text-xs text-muted-3">{budget ? `Dashed line · daily budget ${money(budget, m)}` : "No daily budget set on this campaign."}</span>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="meta">Active signals</span>
        {active.length ? active.map((s) => <SignalItem key={s.id} signal={s}/>) : <span className="text-[13px] text-muted-3">Operating within expected range.</span>}
      </div>

      {d.pacing && d.pacing.monthlyTarget > 0 ? <DrawerPacing detail={d} money={m}/> : null}

      <QuickActions detail={d} money={m} detailHref={`/campaigns/${encodeURIComponent(id)}${rangeSearch}`}/>
    </Refetching>);
}
function DrawerPacing({ detail, money: m }: {
    detail: CampaignDetail;
    money: MoneyFmt;
}) {
    const { status } = useCampaignContext();
    const month = pacingMonthOf(status.data?.dataThrough);
    if (!detail.pacing)
        return null;
    return <PacingBlock pacing={detail.pacing} money={m} monthLabel={month.month} marker={month.marker}/>;
}
function QuickActions({ detail, money: m, detailHref }: {
    detail: CampaignDetail;
    money: MoneyFmt;
    detailHref: string;
}) {
    const writes = useCampaignWrites();
    const c = detail.campaign;
    const status = writes.pending.get(c.id) ?? c.status;
    const budget = c.budget_daily;
    const step = (pct: number) => (budget ? adjustBudget(budget, pct) : null);
    const down = step(-10);
    const up = step(10);
    return (<div className="mt-auto flex flex-col gap-3 border-t border-line pt-5">
      <div className="flex items-center gap-2.5">
        <span className="meta">Quick actions</span>
              </div>
      {budget && down !== null && up !== null ? (<div className="grid grid-cols-2 gap-2">
          <LiveGuard className="grid">
            <Button variant="outline" size="sm" className="w-full justify-center" disabled={!!writes.busy} loading={writes.busy === "budget"} onClick={() => void writes.setBudgets([{ campaignId: c.id, dailyBudget: down }])}>
              {`Budget −10% · ${money(down, m)}`}
            </Button>
          </LiveGuard>
          <LiveGuard className="grid">
            <Button variant="outline" size="sm" className="w-full justify-center" disabled={!!writes.busy} loading={writes.busy === "budget"} onClick={() => void writes.setBudgets([{ campaignId: c.id, dailyBudget: up }])}>
              {`Budget +10% · ${money(up, m)}`}
            </Button>
          </LiveGuard>
        </div>) : null}
      {c.status !== "Removed" ? (<LiveGuard className="grid">
          <Button variant="block" size="md" disabled={!!writes.busy} loading={writes.busy === "pause" || writes.busy === "enable"} onClick={() => void writes.setStatus([c.id], status === "Enabled" ? "Paused" : "Enabled")}>
            {status === "Enabled" ? "Pause campaign" : "Enable campaign"}
          </Button>
        </LiveGuard>) : null}
      <p className="m-0 text-xs text-muted-3">{READ_ONLY_COPY}</p>
      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <Link href={detailHref}>Open full detail →</Link>
        <GoogleAdsLink href={detail.deepLink} variant="link"/>
      </div>
      {writes.dialog}
    </div>);
}
function DrawerSkeleton() {
    return (<div className="flex flex-col gap-[22px]" aria-busy="true">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-mini bg-tone/8">
        {DRAWER_KPIS.map((k) => (<div key={k.key} className="flex flex-col gap-2 bg-surface px-4 py-3.5">
            <span className="label-mono">{k.label}</span>
            <Skeleton height={24} className="w-24"/>
          </div>))}
      </div>
      <Skeleton height={140}/>
      <SkeletonLines lines={3}/>
    </div>);
}
