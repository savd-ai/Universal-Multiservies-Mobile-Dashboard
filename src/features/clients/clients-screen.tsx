"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ErrorState, Refetching, Skeleton } from "@/components/ui/feedback";
import { DeltaText, Meter, Pill } from "@/components/ui/status";
import { Card, CardHeader, StatTile, TileGrid } from "@/components/ui/surfaces";
import { useCan, usePortfolio } from "@/lib/api/auth";
import { useSwitchAccount } from "@/lib/api/data-source";
import { useStatus } from "@/lib/api/hooks";
import { type PortfolioAccountRow, type PortfolioGroup, type PortfolioKpis, type PortfolioQuery } from "@/lib/domain/contracts/portfolio";
import { formatRange } from "@/lib/domain/dates";
import { formatMoney, formatNumber } from "@/lib/domain/metrics/registry";
import { useFilters } from "@/lib/filters";
type Metric = "cost" | "conversions" | "cpa" | "roas";
function change(now: PortfolioKpis | null, prev: PortfolioKpis | null, key: Metric): number | null {
    const a = now?.[key];
    const b = prev?.[key];
    if (a === null || a === undefined || b === null || b === undefined || b === 0)
        return null;
    return a / b - 1;
}
function Delta({ now, prev, metric }: {
    now: PortfolioKpis | null;
    prev: PortfolioKpis | null;
    metric: Metric;
}) {
    const c = change(now, prev, metric);
    if (c === null)
        return null;
    const pct = `${c >= 0 ? "+" : "−"}${Math.abs(c * 100).toFixed(1)}%`;
    const good = metric === "cpa" ? c < 0 : c > 0;
    return <DeltaText pct={pct} sentiment={metric === "cost" || Math.abs(c) < 0.005 ? null : good ? "good" : "bad"}/>;
}
function Signals({ s }: {
    s: PortfolioAccountRow["signals"];
}) {
    if (!s.critical && !s.warning && !s.opportunity)
        return <span className="text-xs text-faint">None open</span>;
    return (<span className="flex flex-wrap items-center gap-1.5">
      {s.critical ? <Pill tone="crit">{s.critical} critical</Pill> : null}
      {s.warning ? <Pill tone="warn">{s.warning} warning</Pill> : null}
      {s.opportunity ? <Pill tone="accent">{s.opportunity} opportunity</Pill> : null}
    </span>);
}
function money(v: number | null | undefined, currency: string): string {
    return v === null || v === undefined ? "—" : formatMoney(v, { currency });
}
const RANGE_PRESET: Record<string, PortfolioQuery["range"]> = { "7d": "last_7d", "30d": "last_30d", "90d": "last_90d", mtd: "mtd", qtd: "qtd", ytd: "ytd", last_month: "last_month" };
function portfolioQuery(rangeKey: string, compare: PortfolioQuery["compare"]): PortfolioQuery {
    return { range: RANGE_PRESET[rangeKey] ?? "last_30d", compare };
}
export function ClientsScreen() {
    const status = useStatus();
    const f = useFilters(status.data?.today);
    const q = portfolioQuery(f.rangeKey, f.compare);
    const portfolio = usePortfolio(q);
    const can = useCan();
    const router = useRouter();
    const switcher = useSwitchAccount();
    const data = portfolio.data;
    const cur = data?.displayCurrency ?? "USD";
    const open = (id: string) => switcher.mutate(id, { onSuccess: () => router.push("/overview") });
    const columns = (currency: (r: PortfolioAccountRow) => string): Column<PortfolioAccountRow>[] => [
        {
            key: "name",
            header: "Account",
            width: "minmax(220px,2.2fr)",
            sortValue: (r) => r.name,
            cell: (r) => (<span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2 truncate font-medium text-fg">
            {r.name}
            {r.mode !== "live" ? (<Pill tone="muted" className="px-1.5 py-px text-[9px]">
                Demo
              </Pill>) : null}
          </span>
          <span className="font-mono text-micro text-faint">
            {r.accountId.replace(/(\d{3})(\d{3})(\d+)/, "$1-$2-$3")} · {r.currency}
          </span>
        </span>),
        },
        { key: "cost", header: "Spend", align: "right", sortValue: (r) => r.kpis?.cost ?? null, cell: (r) => <Cell value={money(r.kpis?.cost, currency(r))} delta={<Delta now={r.kpis} prev={r.previous} metric="cost"/>}/> },
        { key: "conv", header: "Conv.", align: "right", sortValue: (r) => r.kpis?.conversions ?? null, cell: (r) => <Cell value={r.kpis ? formatNumber(r.kpis.conversions, { decimals: r.kpis.conversions < 100 ? 1 : 0 }) : "—"} delta={<Delta now={r.kpis} prev={r.previous} metric="conversions"/>}/> },
        { key: "cpa", header: "CPA", align: "right", sortValue: (r) => r.kpis?.cpa ?? null, cell: (r) => <Cell value={money(r.kpis?.cpa, currency(r))} delta={<Delta now={r.kpis} prev={r.previous} metric="cpa"/>}/> },
        { key: "roas", header: "ROAS", align: "right", sortValue: (r) => r.kpis?.roas ?? null, cell: (r) => <Cell value={r.kpis?.roas === null || r.kpis?.roas === undefined ? "—" : `${r.kpis.roas.toFixed(2)}x`} delta={<Delta now={r.kpis} prev={r.previous} metric="roas"/>}/> },
        {
            key: "pacing",
            header: "Month pacing",
            width: "minmax(150px,1.3fr)",
            sortValue: (r) => r.pacing?.ratio ?? null,
            cell: (r) => r.pacing?.ratio !== null && r.pacing?.ratio !== undefined ? (<span className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between gap-2 font-mono text-meta">
              <span className={r.pacing.ratio > 1.05 ? "text-warn" : "text-fg"}>{Math.round(r.pacing.ratio * 100)}%</span>
              <span className="text-faint">{r.pacing.overpacing ? `${r.pacing.overpacing} over` : "projected"}</span>
            </span>
            <Meter value={Math.min(1, r.pacing.ratio)} tone={r.pacing.ratio > 1.05 ? "warn" : "accent"} height={6} label={`${r.name} projected at ${Math.round(r.pacing.ratio * 100)}% of the monthly budget`}/>
          </span>) : (<span className="text-xs text-faint">—</span>),
        },
        { key: "signals", header: "Open signals", width: "minmax(150px,1.3fr)", sortValue: (r) => r.signals.critical * 100 + r.signals.warning, cell: (r) => (r.error ? <span className="text-xs text-crit">{r.error}</span> : <Signals s={r.signals}/>) },
        {
            key: "open",
            header: "",
            width: "90px",
            align: "right",
            cell: (r) => (<Button variant="ghost" size="xs" onClick={() => open(r.accountId)} disabled={switcher.isPending} aria-label={`Open ${r.name}`}>
          Open →
        </Button>),
        },
    ];
    const critical = data?.accounts.filter((a) => a.signals.critical > 0).length ?? 0;
    const overpacing = data?.accounts.filter((a) => (a.pacing?.ratio ?? 0) > 1.05).length ?? 0;
    return (<div className="flex flex-col gap-6">
      <PageHeader actions={can("clients.manage") ? (<Link href="/access/clients" className="text-[13px]">
              Manage clients →
            </Link>) : null}/>
      {portfolio.error && !data ? <ErrorState error={portfolio.error} onRetry={() => void portfolio.refetch()}/> : null}
      {!data && !portfolio.error ? <Skeleton height={320}/> : null}
      {data ? (<>
          <Refetching active={portfolio.isFetching && !portfolio.isPending}>
            <TileGrid min={160}>
              <StatTile label={`Spend · ${cur}`} value={money(data.totals?.cost, cur)}>
                <Delta now={data.totals} prev={data.previous} metric="cost"/>
              </StatTile>
              <StatTile label="Conversions" value={data.totals ? formatNumber(data.totals.conversions) : "—"}>
                <Delta now={data.totals} prev={data.previous} metric="conversions"/>
              </StatTile>
              <StatTile label="Blended CPA" value={money(data.totals?.cpa, cur)}>
                <Delta now={data.totals} prev={data.previous} metric="cpa"/>
              </StatTile>
              <StatTile label="Blended ROAS" value={data.totals?.roas ? `${data.totals.roas.toFixed(2)}x` : "—"}>
                <Delta now={data.totals} prev={data.previous} metric="roas"/>
              </StatTile>
              <StatTile label="Needs attention" value={String(critical)}>
                <span className="text-xs text-muted-3">{`${critical === 1 ? "account" : "accounts"} with a critical signal`}</span>
              </StatTile>
              <StatTile label="Overpacing" value={String(overpacing)}>
                <span className="text-xs text-muted-3">{`${overpacing === 1 ? "account" : "accounts"} projected above 105% of budget`}</span>
              </StatTile>
            </TileGrid>
          </Refetching>
          {data.warnings.map((w) => (<p key={w} className="m-0 text-xs text-muted-3">
              {w}
            </p>))}
          {data.groups.map((g) => (<GroupCard key={g.clientId ?? "agency"} group={g} rows={data.accounts.filter((a) => g.accountIds.includes(a.accountId))} columns={columns((r) => r.currency)} currency={cur} range={data.range}/>))}
          {!data.accounts.length ? <Card className="text-[13px] text-muted">No accounts to show yet.</Card> : null}
        </>) : null}
    </div>);
}
function Cell({ value, delta }: {
    value: string;
    delta: React.ReactNode;
}) {
    return (<span className="flex flex-col items-end gap-0.5">
      <span className="tabular-nums">{value}</span>
      {delta}
    </span>);
}
function GroupCard({ group, rows, columns, currency, range }: {
    group: PortfolioGroup;
    rows: PortfolioAccountRow[];
    columns: Column<PortfolioAccountRow>[];
    currency: string;
    range: {
        start: string;
        end: string;
    } | null;
}) {
    const sub = [`${rows.length} account${rows.length === 1 ? "" : "s"}`, group.totals ? `${money(group.totals.cost, currency)} spend` : null, group.totals?.cpa ? `CPA ${money(group.totals.cpa, currency)}` : null, group.totals?.roas ? `ROAS ${group.totals.roas.toFixed(2)}x` : null, range ? formatRange(range) : null].filter(Boolean).join(" · ");
    return (<Card className="flex flex-col gap-4">
      <CardHeader title={group.name} sub={sub} action={<Signals s={group.signals}/>}/>
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.accountId} initialSort={{ key: "cost", dir: "desc" }} ariaLabel={`${group.name} accounts`} minWidth={900}/>
    </Card>);
}
