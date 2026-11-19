"use client";

import Link from "next/link";
import { useMemo } from "react";
import { colorFor } from "@/components/charts/palette";
import { useChartTokens } from "@/components/charts/tokens";
import { PageHeader } from "@/components/shell/page-chrome";
import { cn } from "@/components/ui/cn";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ErrorState, Refetching, Skeleton } from "@/components/ui/feedback";
import { Sparkline } from "@/components/ui/spark";
import { Dot, Pill } from "@/components/ui/status";
import { Card, CardHeader, MiniCard, StatTile, TileGrid } from "@/components/ui/surfaces";
import { useStatus } from "@/lib/api/hooks";
import { useChannels, usePluginList } from "@/lib/api/plugins-ui";
import type { ChannelPlatformSummary, ChannelsSummary } from "@/lib/domain/contracts/plugins";
import { formatMetricValue, formatMoney, formatNumber } from "@/lib/domain/metrics/registry";
import { useFilters } from "@/lib/filters";
import { DailySpendChart, MerChart, seriesColor } from "./channel-charts";
import { channelKpis, foldPlatforms, merSeries, platformAbbr, platformColorIndex, splitWarnings } from "./channels-model";

// Channels (07): Google Ads + every connected ad platform on one spend base — KPI strip, spend & ROAS per platform,
// share of spend, daily mix, MER when a commerce source exists, and the platform ledger. Honours the top-bar range.

const DESCRIPTION = "Google Ads and every connected ad platform on one spend base. Analytics and commerce sources sit beside it — never summed into ad totals.";

function ModeBadge({ mode }: { mode: "live" | "demo" }) {
  return (
    <Pill tone={mode === "live" ? "accent" : "muted"} className="px-1.5 py-px text-[9px]">
      {mode === "live" ? "Live" : "Demo"}
    </Pill>
  );
}

function Mark({ abbr }: { abbr: string }) {
  return (
    <span aria-hidden className="grid size-[26px] shrink-0 place-items-center rounded-full border border-tone/12 font-mono text-[9px] text-muted">
      {abbr}
    </span>
  );
}

export function ChannelsScreen() {
  const status = useStatus();
  const f = useFilters(status.data?.today);
  const q = useChannels(f.range);
  const plugins = usePluginList();
  const icons = useMemo(() => new Map((plugins.data?.plugins ?? []).map((p) => [p.manifest.id, p.manifest.icon.abbr])), [plugins.data]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        description={DESCRIPTION}
        actions={
          <Link href="/plugins?cat=ad_platform" className="text-[13px]">
            + Connect another platform
          </Link>
        }
      />
      {q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.data ? (
        <ChannelsSkeleton />
      ) : (
        <Refetching active={q.isFetching && q.isPlaceholderData}>
          <ChannelsBody data={q.data} rangeLabel={f.rangeLabel} icons={icons} />
        </Refetching>
      )}
    </div>
  );
}

function ChannelsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <Skeleton height={96} className="w-full" />
      <div className="grid grid-cols-1 gap-5 wide:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Skeleton height={260} className="rounded-card" />
        <Skeleton height={260} className="rounded-card" />
      </div>
      <Skeleton height={320} className="rounded-card" />
    </div>
  );
}

function ChannelsBody({ data, rangeLabel, icons }: { data: ChannelsSummary; rangeLabel: string; icons: ReadonlyMap<string, string> }) {
  const t = useChartTokens();
  const currency = data.currency;
  const kpis = channelKpis(data);
  const colorIndex = useMemo(() => platformColorIndex(data.platforms.map((p) => p.id)), [data.platforms]);
  const color = (id: string) => colorFor("platform", id, colorIndex.get(id) ?? 0, t);
  const money = (v: number | null | undefined, compact = true) => (v === null || v === undefined ? "—" : formatMoney(v, { currency, compact }));
  const ratio = (v: number | null | undefined) => formatMetricValue("ratio", v);
  const stack = useMemo(() => foldPlatforms(data.platforms), [data.platforms]);
  const mer = useMemo(() => merSeries(data), [data]);
  const { attribution, other } = splitWarnings(data.warnings);
  const platforms = data.platforms;
  const maxCost = Math.max(1, ...platforms.map((p) => p.cost));
  const maxRoas = Math.max(0.01, ...platforms.map((p) => p.roas ?? 0));
  const days = data.range.days;

  return (
    <div className="flex flex-col gap-5">
      <TileGrid min={170}>
        <StatTile label="Total ad spend" value={money(kpis.spend)}>
          <span className="text-xs text-muted-3">
            {kpis.platforms} platform{kpis.platforms === 1 ? "" : "s"} · {rangeLabel}
          </span>
        </StatTile>
        <StatTile label="Blended ROAS" value={ratio(kpis.roas)}>
          <span className="text-xs text-muted-3">conversion value ÷ ad spend</span>
        </StatTile>
        {kpis.mer !== null ? (
          <StatTile label="MER" value={ratio(kpis.mer)}>
            <span className="text-xs text-muted-3">store revenue {money(kpis.storeRevenue)} ÷ ad spend</span>
          </StatTile>
        ) : (
          <StatTile label="MER" value={<span className="text-faint">—</span>}>
            <Link href="/plugins?cat=commerce" className="text-xs">
              Needs store revenue — connect commerce →
            </Link>
          </StatTile>
        )}
        <StatTile label="Conversions" value={formatNumber(kpis.conversions)}>
          <span className="text-xs text-warn" title={attribution ?? undefined}>
            ▲ platform-attributed · may double-count
          </span>
        </StatTile>
        <StatTile label="Blended CPA" value={money(kpis.cpa, false)}>
          <span className="text-xs text-muted-3">ad spend ÷ conversions</span>
        </StatTile>
      </TileGrid>

      {attribution ? (
        <div role="note" className="flex flex-wrap items-start gap-x-3.5 gap-y-1.5 rounded-mini border border-warn/30 bg-warn-t/40 px-[18px] py-3">
          <span className="mt-px font-mono text-micro tracking-eyebrow text-warn uppercase">Attribution</span>
          <span className="min-w-[240px] flex-1 text-[13px] leading-normal text-muted">
            {attribution} {kpis.mer !== null ? "MER uses store revenue, so it isn't inflated by overlapping claims." : "Connect a commerce source for MER, which isn't inflated by overlapping claims."}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 wide:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card className="flex flex-col gap-4">
          <CardHeader title="Spend & ROAS by platform" sub={`Ad platforms · ${rangeLabel}`} />
          <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)] gap-4 font-mono text-micro tracking-label text-faint uppercase sm:grid" aria-hidden>
            <span>Platform</span>
            <span>Spend</span>
            <span>ROAS</span>
          </div>
          <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
            {platforms.map((p) => (
              <li key={p.id} className="grid grid-cols-2 items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
                <div className="col-span-2 flex min-w-0 items-center gap-2.5 text-[13px] sm:col-span-1">
                  <Mark abbr={platformAbbr(p.id, p.label, icons)} />
                  <span className="truncate font-medium">{p.label}</span>
                  <ModeBadge mode={p.mode} />
                  {p.stale ? <span className="font-mono text-micro text-warn uppercase" title={p.reason}>▲ stale</span> : null}
                </div>
                <BarCell value={p.cost} max={maxCost} color={color(p.id)} label={money(p.cost)} ariaLabel={`${p.label} spend ${money(p.cost, false)}`} />
                <BarCell value={p.roas ?? 0} max={maxRoas} color={color(p.id)} label={ratio(p.roas)} ariaLabel={`${p.label} ROAS ${ratio(p.roas)}`} />
              </li>
            ))}
          </ul>
          <Link
            href="/plugins?cat=ad_platform"
            className="mt-auto rounded-mini border border-dashed border-tone/14 p-3 text-center text-xs text-muted-3 transition-colors hover:border-teal/40 hover:text-accent hover:opacity-100"
          >
            + Connect another platform
          </Link>
        </Card>

        <Card className="flex flex-col gap-4">
          <CardHeader title="Share of spend" sub="Of total ad spend" />
          <div role="img" aria-label={`Share of spend: ${platforms.map((p) => `${p.label} ${(p.share * 100).toFixed(1)}%`).join(", ")}`} className="flex h-3.5 w-full gap-0.5 overflow-hidden rounded-[4px] bg-tone/5">
            {platforms
              .filter((p) => p.share > 0)
              .map((p) => (
                <div key={p.id} className="h-full first:rounded-l-[4px] last:rounded-r-[4px]" style={{ width: `${p.share * 100}%`, background: color(p.id) }} />
              ))}
          </div>
          <ul className="m-0 flex list-none flex-col p-0">
            {platforms.map((p) => (
              <li key={p.id} className="flex items-center gap-3 border-b border-line-soft py-2.5 text-[13px] last:border-b-0">
                <span aria-hidden className="h-0.5 w-3.5 shrink-0 rounded-full" style={{ background: color(p.id) }} />
                <span className="min-w-0 flex-1 truncate">{p.label}</span>
                <span className="tabular text-muted-3">{money(p.cost)}</span>
                <span className="w-14 text-right font-display font-semibold tabular">{(p.share * 100).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
          <span className="mt-auto text-xs leading-normal text-muted-3">Analytics and commerce sources aren&apos;t ad spend, so they&apos;re never part of this split.</span>
        </Card>
      </div>

      <Card className="flex flex-col gap-4">
        <CardHeader title="Daily spend by platform" sub={`Stacked · ${days} days`} />
        {stack.length > 1 ? (
          <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-xs text-muted">
            {stack.map((s) => (
              <span key={s.id} className="flex items-center gap-2">
                <span aria-hidden className="h-0.5 w-3.5 rounded-full" style={{ background: seriesColor(s, colorIndex, t) }} />
                {s.label}
              </span>
            ))}
          </div>
        ) : null}
        <DailySpendChart dates={data.dates} series={stack} colorIndex={colorIndex} currency={currency} />
      </Card>

      {mer ? (
        <Card className="flex flex-col gap-4">
          <CardHeader title="MER vs store revenue" sub={`${data.commerce.map((c) => c.label).join(" + ")} · store revenue ÷ total ad spend`} />
          <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 text-xs text-muted">
            <span className="flex items-center gap-2">
              <span aria-hidden className="h-0.5 w-3.5 rounded-full bg-accent-line" />
              Store revenue
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden className="h-0.5 w-3.5 rounded-full bg-tone/35" />
              Ad spend
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden className="h-0.5 w-3.5 rounded-full bg-accent-line" />
              MER (lower panel)
            </span>
          </div>
          <MerChart dates={mer.dates} revenue={mer.revenue} spend={mer.spend} mer={mer.mer} currency={currency} />
        </Card>
      ) : (
        <Link
          href="/plugins?cat=commerce"
          className="rounded-mini border border-dashed border-tone/14 p-4 text-center text-[13px] text-muted-3 transition-colors hover:border-teal/40 hover:text-accent hover:opacity-100"
        >
          Connect Shopify or WooCommerce to track MER — store revenue ÷ total ad spend, immune to double-counted conversions →
        </Link>
      )}

      {data.analytics.length || data.commerce.length ? (
        <div className="flex flex-col gap-3">
          <span className="label-mono">Beside ad spend</span>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))" }}>
            {data.analytics.map((a) => (
              <MiniCard key={a.id} className="flex flex-col gap-2.5">
                <SideHeader label={a.label} kind="Analytics" mode={a.mode} stale={a.stale} reason={a.reason} />
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-[22px] font-semibold tabular">{formatNumber(a.sessions)}</span>
                  <span className="text-xs text-muted-3">sessions</span>
                </div>
                <span className="text-xs text-muted-3">
                  {formatNumber(a.conversions)} conversions · {money(a.conv_value)} revenue (own attribution)
                </span>
                <Sparkline values={a.trend} height={28} />
              </MiniCard>
            ))}
            {data.commerce.map((c) => (
              <MiniCard key={c.id} className="flex flex-col gap-2.5">
                <SideHeader label={c.label} kind="Commerce" mode={c.mode} stale={c.stale} reason={c.reason} />
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-[22px] font-semibold tabular">{money(c.store_revenue)}</span>
                  <span className="text-xs text-muted-3">store revenue</span>
                </div>
                <span className="text-xs text-muted-3">{formatNumber(c.orders)} orders</span>
                <Sparkline values={c.trend} height={28} />
              </MiniCard>
            ))}
          </div>
        </div>
      ) : null}

      <Card className="flex flex-col gap-4">
        <CardHeader title="Platform ledger" sub={`${rangeLabel} · ${currency}`} />
        <PlatformTable data={data} icons={icons} color={color} money={money} />
      </Card>

      <SourcesNote data={data} other={other} />
    </div>
  );
}

function BarCell({ value, max, color, label, ariaLabel }: { value: number; max: number; color: string; label: string; ariaLabel: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5" aria-label={ariaLabel} role="img">
      <div className="h-1.5 min-w-0 flex-1 rounded-pill bg-tone/5">
        <div className="h-full rounded-pill" style={{ width: `${Math.max(0, Math.min(1, value / max)) * 100}%`, background: color }} />
      </div>
      <span className="w-[58px] shrink-0 text-right text-[13px] tabular">{label}</span>
    </div>
  );
}

function SideHeader({ label, kind, mode, stale, reason }: { label: string; kind: string; mode: "live" | "demo"; stale?: boolean; reason?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{label}</span>
      <span className="font-mono text-micro tracking-label text-faint uppercase">{kind}</span>
      <ModeBadge mode={mode} />
      {stale ? (
        <span className="font-mono text-micro text-warn uppercase" title={reason}>
          ▲ stale
        </span>
      ) : null}
    </div>
  );
}

type Row = ChannelPlatformSummary;

function PlatformTable({ data, icons, color, money }: { data: ChannelsSummary; icons: ReadonlyMap<string, string>; color: (id: string) => string; money: (v: number | null | undefined, compact?: boolean) => string }) {
  const pct = (v: number | null) => formatMetricValue("percent", v, { decimals: 2 });
  const tot = data.totals;
  const columns: Column<Row>[] = [
    {
      key: "platform",
      header: "Platform",
      width: "minmax(210px,1.8fr)",
      sortValue: (r) => r.label,
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Mark abbr={platformAbbr(r.id, r.label, icons)} />
          <span className="truncate font-medium" title={r.reason}>
            {r.label}
          </span>
          <ModeBadge mode={r.mode} />
        </span>
      ),
      total: <span className="font-display">Blended</span>,
    },
    { key: "cost", header: "Spend", align: "right", width: "minmax(90px,1fr)", sortValue: (r) => r.cost, cell: (r) => money(r.cost, false), total: money(tot.cost, false) },
    { key: "share", header: "Share", align: "right", width: "72px", sortValue: (r) => r.share, cell: (r) => `${(r.share * 100).toFixed(1)}%`, total: "100%" },
    { key: "impressions", header: "Impr.", align: "right", width: "minmax(80px,1fr)", sortValue: (r) => r.impressions, cell: (r) => formatNumber(r.impressions), total: formatNumber(tot.impressions) },
    { key: "clicks", header: "Clicks", align: "right", width: "minmax(70px,1fr)", sortValue: (r) => r.clicks, cell: (r) => formatNumber(r.clicks), total: formatNumber(tot.clicks) },
    { key: "ctr", header: "CTR", align: "right", width: "72px", sortValue: (r) => r.ctr, cell: (r) => pct(r.ctr), total: pct(tot.impressions > 0 ? tot.clicks / tot.impressions : null) },
    { key: "cpc", header: "CPC", align: "right", width: "72px", sortValue: (r) => r.cpc, cell: (r) => money(r.cpc, false), total: money(tot.clicks > 0 ? tot.cost / tot.clicks : null, false) },
    { key: "conversions", header: "Conv.", align: "right", width: "minmax(70px,1fr)", sortValue: (r) => r.conversions, cell: (r) => formatNumber(r.conversions), total: formatNumber(tot.conversions) },
    { key: "cpa", header: "CPA", align: "right", width: "80px", sortValue: (r) => r.cpa, cell: (r) => money(r.cpa, false), total: money(tot.cpa, false) },
    { key: "conv_value", header: "Conv. value", align: "right", width: "minmax(90px,1fr)", sortValue: (r) => r.conv_value, cell: (r) => money(r.conv_value), total: money(tot.conv_value) },
    { key: "roas", header: "ROAS", align: "right", width: "68px", sortValue: (r) => r.roas, cell: (r) => formatMetricValue("ratio", r.roas), total: formatMetricValue("ratio", tot.roas) },
    {
      key: "trend",
      header: "Daily spend",
      width: "96px",
      cell: (r) => <Sparkline values={r.trend} color={color(r.id)} height={22} />,
    },
  ];
  return <DataTable rows={data.platforms} columns={columns} rowKey={(r) => r.id} ariaLabel="Platform ledger" initialSort={{ key: "cost", dir: "desc" }} minWidth={1080} empty="No ad platforms in this range." />;
}

function SourcesNote({ data, other }: { data: ChannelsSummary; other: string[] }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-mini border border-line px-[18px] py-3.5">
      <span className="label-mono">Sources</span>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {data.sources.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]">
            <Dot tone={s.stale ? "warn" : s.mode === "live" ? "accent" : "faint"} size={6} />
            <span className="font-medium">{s.label}</span>
            <ModeBadge mode={s.mode} />
            {s.stale ? <span className="font-mono text-micro text-warn uppercase">▲ stale</span> : null}
            {s.reason ? <span className={cn("min-w-0 flex-1 text-xs", s.stale ? "text-warn" : "text-muted-3")}>{s.reason}</span> : null}
          </li>
        ))}
        {other.map((w) => (
          <li key={w} className="flex items-start gap-2.5 text-xs leading-normal text-muted-3">
            <Dot tone="warn" size={6} className="mt-1" />
            {w}
          </li>
        ))}
      </ul>
    </div>
  );
}
