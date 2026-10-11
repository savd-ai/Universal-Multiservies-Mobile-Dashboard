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
function 敇壍(萶壍: PortfolioKpis | null, 儥壍: PortfolioKpis | null, 瀔壍: Metric): number | null {
    const 較壍 = 萶壍?.[瀔壍];
    const 寲壍 = 儥壍?.[瀔壍];
    if (較壍 === null || 較壍 === undefined || 寲壍 === null || 寲壍 === undefined || 寲壍 === 0)
        return null;
    return 較壍 / 寲壍 - 1;
}
function 竡壍({ now: 駐壍, prev: 暿壍, metric: 薮壍 }: {
    now: PortfolioKpis | null;
    prev: PortfolioKpis | null;
    metric: Metric;
}) {
    const 劝壍 = 敇壍(駐壍, 暿壍, 薮壍);
    if (劝壍 === null)
        return null;
    const 熌壍 = `${劝壍 >= 0 ? "+" : "−"}${Math.abs(劝壍 * 100).toFixed(1)}%`;
    const 遻壍 = 薮壍 === "cpa" ? 劝壍 < 0 : 劝壍 > 0;
    return <DeltaText pct={熌壍} sentiment={薮壍 === "cost" || Math.abs(劝壍) < 0.005 ? null : 遻壍 ? "good" : "bad"}/>;
}
function 嵪壍({ s: 籙壍 }: {
    s: PortfolioAccountRow["signals"];
}) {
    if (!籙壍.critical && !籙壍.warning && !籙壍.opportunity)
        return <span className="text-xs text-faint">None open</span>;
    return (<span className="flex flex-wrap items-center gap-1.5">
      {籙壍.critical ? <Pill tone="crit">{籙壍.critical} critical</Pill> : null}
      {籙壍.warning ? <Pill tone="warn">{籙壍.warning} warning</Pill> : null}
      {籙壍.opportunity ? <Pill tone="accent">{籙壍.opportunity} opportunity</Pill> : null}
    </span>);
}
function 魈壍(样壍: number | null | undefined, 蜦壍: string): string {
    return 样壍 === null || 样壍 === undefined ? "—" : formatMoney(样壍, { currency: 蜦壍 });
}
const 吕壍: Record<string, PortfolioQuery["range"]> = { "7d": "last_7d", "30d": "last_30d", "90d": "last_90d", mtd: "mtd", qtd: "qtd", ytd: "ytd", last_month: "last_month" };
function 猄壍(釳壍: string, 廢壍: PortfolioQuery["compare"]): PortfolioQuery {
    return { range: 吕壍[釳壍] ?? "last_30d", compare: 廢壍 };
}
export function ClientsScreen() {
    const 緑壍 = useStatus();
    const 鳀壍 = useFilters(緑壍.data?.today);
    const 榯壍 = 猄壍(鳀壍.rangeKey, 鳀壍.compare);
    const 袞壍 = usePortfolio(榯壍);
    const 喍壍 = useCan();
    const 瑼壍 = useRouter();
    const 鍫壍 = useSwitchAccount();
    const 恚壍 = 袞壍.data;
    const 罉壍 = 恚壍?.displayCurrency ?? "USD";
    const 鸸壍 = (欧壍: string) => 鍫壍.mutate(欧壍, { onSuccess: () => 瑼壍.push("/overview") });
    const 訖壍 = (圅壍: (痴壍: PortfolioAccountRow) => string): Column<PortfolioAccountRow>[] => [
        {
            key: "name",
            header: "Account",
            width: "minmax(220px,2.2fr)",
            sortValue: (铣壍) => 铣壍.name,
            cell: (懒壍) => (<span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2 truncate font-medium text-fg">
            {懒壍.name}
            {懒壍.mode !== "live" ? (<Pill tone="muted" className="px-1.5 py-px text-[9px]">
                No data
              </Pill>) : null}
          </span>
          <span className="font-mono text-micro text-faint">
            {懒壍.accountId.replace(/(\d{3})(\d{3})(\d+)/, "$1-$2-$3")} · {懒壍.currency}
          </span>
        </span>),
        },
        { key: "cost", header: "Spend", align: "right", sortValue: (胁壍) => 胁壍.kpis?.cost ?? null, cell: (龰壍) => <穜壍 value={魈壍(龰壍.kpis?.cost, 圅壍(龰壍))} delta={<竡壍 now={龰壍.kpis} prev={龰壍.previous} metric="cost"/>}/> },
        { key: "conv", header: "Conv.", align: "right", sortValue: (沟壍) => 沟壍.kpis?.conversions ?? null, cell: (讎壍) => <穜壍 value={讎壍.kpis ? formatNumber(讎壍.kpis.conversions, { decimals: 讎壍.kpis.conversions < 100 ? 1 : 0 }) : "—"} delta={<竡壍 now={讎壍.kpis} prev={讎壍.previous} metric="conversions"/>}/> },
        { key: "cpa", header: "CPA", align: "right", sortValue: (塽壍) => 塽壍.kpis?.cpa ?? null, cell: (睬壍) => <穜壍 value={魈壍(睬壍.kpis?.cpa, 圅壍(睬壍))} delta={<竡壍 now={睬壍.kpis} prev={睬壍.previous} metric="cpa"/>}/> },
        { key: "roas", header: "ROAS", align: "right", sortValue: (陛壍) => 陛壍.kpis?.roas ?? null, cell: (捊壍) => <穜壍 value={捊壍.kpis?.roas === null || 捊壍.kpis?.roas === undefined ? "—" : `${捊壍.kpis.roas.toFixed(2)}x`} delta={<竡壍 now={捊壍.kpis} prev={捊壍.previous} metric="roas"/>}/> },
        {
            key: "pacing",
            header: "Month pacing",
            width: "minmax(150px,1.3fr)",
            sortValue: (船壍) => 船壍.pacing?.ratio ?? null,
            cell: (伨壍) => 伨壍.pacing?.ratio !== null && 伨壍.pacing?.ratio !== undefined ? (<span className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between gap-2 font-mono text-meta">
              <span className={伨壍.pacing.ratio > 1.05 ? "text-warn" : "text-fg"}>{Math.round(伨壍.pacing.ratio * 100)}%</span>
              <span className="text-faint">{伨壍.pacing.overpacing ? `${伨壍.pacing.overpacing} over` : "projected"}</span>
            </span>
            <Meter value={Math.min(1, 伨壍.pacing.ratio)} tone={伨壍.pacing.ratio > 1.05 ? "warn" : "accent"} height={6} label={`${伨壍.name} projected at ${Math.round(伨壍.pacing.ratio * 100)}% of the monthly budget`}/>
          </span>) : (<span className="text-xs text-faint">—</span>),
        },
        { key: "signals", header: "Open signals", width: "minmax(150px,1.3fr)", sortValue: (渗壍) => 渗壍.signals.critical * 100 + 渗壍.signals.warning, cell: (贆壍) => (贆壍.error ? <span className="text-xs text-crit">{贆壍.error}</span> : <嵪壍 s={贆壍.signals}/>) },
        {
            key: "open",
            header: "",
            width: "90px",
            align: "right",
            cell: (姵壍) => (<Button variant="ghost" size="xs" onClick={() => 鸸壍(姵壍.accountId)} disabled={鍫壍.isPending} aria-label={`Open ${姵壍.name}`}>
          Open →
        </Button>),
        },
    ];
    const 磤壍 = 恚壍?.accounts.filter((韓壍) => 韓壍.signals.critical > 0).length ?? 0;
    const 擂壍 = 恚壍?.accounts.filter((莱壍) => (莱壍.pacing?.ratio ?? 0) > 1.05).length ?? 0;
    return (<div className="flex flex-col gap-6">
      <PageHeader actions={喍壍("clients.manage") ? (<Link href="/access/clients" className="text-[13px]">
              Manage clients →
            </Link>) : null}/>
      {袞壍.error && !恚壍 ? <ErrorState error={袞壍.error} onRetry={() => void 袞壍.refetch()}/> : null}
      {!恚壍 && !袞壍.error ? <Skeleton height={320}/> : null}
      {恚壍 ? (<>
          <Refetching active={袞壍.isFetching && !袞壍.isPending}>
            <TileGrid min={160}>
              <StatTile label={`Spend · ${罉壍}`} value={魈壍(恚壍.totals?.cost, 罉壍)}>
                <竡壍 now={恚壍.totals} prev={恚壍.previous} metric="cost"/>
              </StatTile>
              <StatTile label="Conversions" value={恚壍.totals ? formatNumber(恚壍.totals.conversions) : "—"}>
                <竡壍 now={恚壍.totals} prev={恚壍.previous} metric="conversions"/>
              </StatTile>
              <StatTile label="Blended CPA" value={魈壍(恚壍.totals?.cpa, 罉壍)}>
                <竡壍 now={恚壍.totals} prev={恚壍.previous} metric="cpa"/>
              </StatTile>
              <StatTile label="Blended ROAS" value={恚壍.totals?.roas ? `${恚壍.totals.roas.toFixed(2)}x` : "—"}>
                <竡壍 now={恚壍.totals} prev={恚壍.previous} metric="roas"/>
              </StatTile>
              <StatTile label="Needs attention" value={String(磤壍)}>
                <span className="text-xs text-muted-3">{`${磤壍 === 1 ? "account" : "accounts"} with a critical signal`}</span>
              </StatTile>
              <StatTile label="Overpacing" value={String(擂壍)}>
                <span className="text-xs text-muted-3">{`${擂壍 === 1 ? "account" : "accounts"} projected above 105% of budget`}</span>
              </StatTile>
            </TileGrid>
          </Refetching>
          {恚壍.warnings.map((傠壍) => (<p key={傠壍} className="m-0 text-xs text-muted-3">
              {傠壍}
            </p>))}
          {恚壍.groups.map((澏壍) => (<蔩壍 key={澏壍.clientId ?? "agency"} group={澏壍} rows={恚壍.accounts.filter((蹾壍) => 澏壍.accountIds.includes(蹾壍.accountId))} columns={訖壍((孭壍) => 孭壍.currency)} currency={罉壍} range={恚壍.range}/>))}
          {!恚壍.accounts.length ? <Card className="text-[13px] text-muted">No accounts to show yet.</Card> : null}
        </>) : null}
    </div>);
}
function 穜壍({ value: 饋壍, delta: 昺壍 }: {
    value: string;
    delta: React.ReactNode;
}) {
    return (<span className="flex flex-col items-end gap-0.5">
      <span className="tabular-nums">{饋壍}</span>
      {昺壍}
    </span>);
}
function 蔩壍({ group: 刘壍, rows: 焇壍, columns: 迶壍, currency: 峥壍, range: 篔壍 }: {
    group: PortfolioGroup;
    rows: PortfolioAccountRow[];
    columns: Column<PortfolioAccountRow>[];
    currency: string;
    range: {
        start: string;
        end: string;
    } | null;
}) {
    const 髃壍 = [`${焇壍.length} account${焇壍.length === 1 ? "" : "s"}`, 刘壍.totals ? `${魈壍(刘壍.totals.cost, 峥壍)} spend` : null, 刘壍.totals?.cpa ? `CPA ${魈壍(刘壍.totals.cpa, 峥壍)}` : null, 刘壍.totals?.roas ? `ROAS ${刘壍.totals.roas.toFixed(2)}x` : null, 篔壍 ? formatRange(篔壍) : null].filter(Boolean).join(" · ");
    return (<Card className="flex flex-col gap-4">
      <CardHeader title={刘壍.name} sub={髃壍} action={<嵪壍 s={刘壍.signals}/>}/>
      <DataTable rows={焇壍} columns={迶壍} rowKey={(枲壍) => 枲壍.accountId} initialSort={{ key: "cost", dir: "desc" }} ariaLabel={`${刘壍.name} accounts`} minWidth={900}/>
    </Card>);
}
