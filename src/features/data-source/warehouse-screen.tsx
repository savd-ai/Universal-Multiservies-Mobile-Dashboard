"use client";
import { useMemo, useState } from "react";
import { EChart } from "@/components/charts/echart";
import { baseOption, categoryAxis, prefersReducedMotion, tooltipHtml, valueAxis } from "@/components/charts/base";
import type { ChartTokens } from "@/components/charts/tokens";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ErrorState, InlineEmpty, Skeleton } from "@/components/ui/feedback";
import { Dot, Pill, type Tone } from "@/components/ui/status";
import { Card, CardHeader, MetaStat, StatTile, TileGrid } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useStatus } from "@/lib/api/hooks";
import { useWarehouse, useWarehouseSync } from "@/lib/api/warehouse";
import type { SyncStatus, WarehouseMonth, WarehouseRun, WarehouseStatus, WarehouseTableCoverage } from "@/lib/domain/contracts/warehouse";
import { formatLong } from "@/lib/domain/dates";
import { displayMoney, moneyFromStatus, type MoneyFmt } from "@/lib/money";
import { formatDateTime, timeAgo } from "./format";
import { useNow } from "./use-now";
const 謲壍 = "Google Ads data is kept in a local SQLite database, so history outlives Google's limits (30 days of change history, 92 days hourly, 12 months of search terms, 37 months daily) and settled days are read locally instead of asking Google again.";
const 堡壍: Record<SyncStatus, Tone> = { ok: "accent", partial: "warn", failed: "crit", running: "muted" };
const 眐壍: Record<SyncStatus, string> = { ok: "OK", partial: "Partial", failed: "Failed", running: "Running" };
const 闿壍: Record<WarehouseRun["trigger"], string> = { manual: "Sync now", schedule: "Timer", cron: "Cron", cli: "CLI" };
const 拮壍 = (臝壍: number) => 臝壍.toLocaleString("en-US");
const 仌壍 = (涻壍: number, 貪壍: string, 妙壍 = `${貪壍}s`) => `${拮壍(涻壍)} ${涻壍 === 1 ? 貪壍 : 妙壍}`;
const 碈壍 = (靷壍: string) => new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${靷壍}-01T00:00:00Z`));
function 摦壍(荕壍: string | null): string {
    if (!荕壍)
        return "—";
    const 偄壍 = 荕壍.split(/[\\/]/).filter(Boolean);
    return 荕壍.length > 34 && 偄壍.length > 2 ? `…/${偄壍.slice(-2).join("/")}` : 荕壍;
}
function 漳壍(踢壍: number | null): string {
    if (踢壍 === null)
        return "In memory";
    if (踢壍 < 1024 * 1024)
        return `${Math.max(1, Math.round(踢壍 / 1024))} KB`;
    return `${(踢壍 / 1048576).toFixed(1)} MB`;
}
function 嬑壍(稀壍: WarehouseRun): string {
    if (!稀壍.finishedAt)
        return "—";
    const 飯壍 = Math.max(0, Math.round((Date.parse(稀壍.finishedAt) - Date.parse(稀壍.startedAt)) / 1000));
    return 飯壍 < 60 ? `${飯壍} s` : `${Math.floor(飯壍 / 60)} min ${飯壍 % 60} s`;
}
export function WarehouseScreen() {
    const 旞壍 = useStatus();
    const 蓍壍 = 旞壍.data?.account.id ?? "";
    const 冼壍 = useWarehouse(蓍壍);
    const 炫壍 = useWarehouseSync(蓍壍);
    const 辚壍 = 冼壍.data;
    const 岉壍 = !!辚壍?.running || 炫壍.isPending;
    const 筸壍 = (驧壍: "account" | "all") => 炫壍.mutate({ scope: 驧壍 }, {
        onSuccess: (杖壍) => toast(杖壍.started ? (驧壍 === "all" ? "Syncing every account in the background" : "Syncing this account in the background") : (杖壍.reason ?? "Nothing to sync"), { tone: 杖壍.started ? "default" : "warn" }),
        onError: (虅壍) => toast(虅壍.message || "Sync failed to start", { tone: "crit" }),
    });
    const 匴壍 = (<PageHeader description={謲壍} actions={<>
          <Button variant="outline" onClick={() => 筸壍("account")} loading={炫壍.isPending && 炫壍.variables?.scope === "account"} disabled={岉壍 || !辚壍?.available}>
            Sync this account
          </Button>
          <Button variant="brand" onClick={() => 筸壍("all")} loading={炫壍.isPending && 炫壍.variables?.scope === "all"} disabled={岉壍 || !辚壍?.available}>
            Sync all accounts
          </Button>
        </>}/>);
    if (冼壍.error && !辚壍) {
        return (<div className="flex flex-col gap-6">
        {匴壍}
        <ErrorState error={冼壍.error} onRetry={() => void 冼壍.refetch()}/>
      </div>);
    }
    if (!辚壍 || !旞壍.data) {
        return (<div className="flex flex-col gap-6">
        {匴壍}
        <Skeleton height={190} className="rounded-card"/>
        <Skeleton height={380} className="rounded-card"/>
      </div>);
    }
    const 爣壍 = moneyFromStatus(旞壍.data);
    return (<div className="flex flex-col gap-6">
      {匴壍}
      <Cmp44 w={辚壍}/>
      {辚壍.available ? (<>
          <Cmp45 w={辚壍}/>
          <Cmp46 months={辚壍.months} money={爣壍} accountName={辚壍.account.name}/>
          <竳壍 runs={辚壍.runs} timeZone={旞壍.data.account.timezone}/>
        </>) : null}
    </div>);
}
function Cmp44({ w: 币壍 }: {
    w: WarehouseStatus;
}) {
    const 糰壍 = useNow();
    const 鯟壍 = !币壍.enabled ? { label: "Off", tone: "faint" as Tone } : 币壍.available ? { label: "On", tone: "accent" as Tone } : { label: "Unavailable", tone: "crit" as Tone };
    return (<Card accent={币壍.available} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Dot tone={鯟壍.tone} halo={币壍.available} size={9}/>
        <span className="font-display text-2xl font-semibold tracking-[-0.02em]">SQLite warehouse</span>
        <Pill tone={鯟壍.tone}>{鯟壍.label}</Pill>
        <Pill tone={币壍.mode === "live" ? "accent" : "warn"}>{币壍.mode === "live" ? "Live data" : "No live data"}</Pill>
        {币壍.running ? <Pill tone="muted">{`Syncing · started ${糰壍 !== null ? timeAgo(币壍.running.startedAt, 糰壍) : ""}`}</Pill> : null}
      </div>
      {币壍.reason ? <p className="m-0 max-w-[80ch] text-[14px] leading-relaxed text-muted">{币壍.reason}</p> : null}
      {币壍.available ? (<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetaStat label="File" value={<span className="block truncate font-mono text-[13px]" title={币壍.file ?? ""}>{摦壍(币壍.file)}</span>}/>
          <MetaStat label="Size" value={<span className="text-[15px]">{漳壍(币壍.sizeBytes)}</span>}/>
          <MetaStat label="Schema" value={<span className="font-mono text-[14px]">{`v${币壍.schemaVersion} · SQLite ${币壍.sqliteVersion ?? "?"}`}</span>}/>
          <MetaStat label="Accounts stored" value={<span className="text-[15px]">{拮壍(币壍.accountsStored)}</span>}/>
        </div>) : null}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-line pt-4 text-xs text-muted-3">
        <span>{`Settled days read locally: ${币壍.reads ? "on" : "off (store only)"}`}</span>
        <span>{币壍.scheduler.enabled ? `Sync timer: every ${币壍.scheduler.intervalMinutes} min${币壍.scheduler.lastTickAt && 糰壍 !== null ? ` · last ${timeAgo(币壍.scheduler.lastTickAt, 糰壍)}` : ""}` : "Sync timer: off (WAREHOUSE_SYNC_ENABLED)"}</span>
        <span>{`Backfill ${拮壍(币壍.backfillDays)} days`}</span>
        <span>{`Up to ${拮壍(币壍.maxRequests)} API requests per sync`}</span>
        <span>{币壍.retentionDays ? `Facts kept ${拮壍(币壍.retentionDays)} days` : "Facts kept forever"}</span>
        <span>{`Last ${币壍.restatementDays} days refreshed (conversions restate)`}</span>
      </div>
      {币壍.note ? <p className="m-0 text-xs leading-relaxed text-muted-3">{币壍.note}</p> : null}
    </Card>);
}
function Cmp45({ w: 螽壍 }: {
    w: WarehouseStatus;
}) {
    const 咬壍 = useNow();
    const 玛壍: Column<WarehouseTableCoverage>[] = [
        {
            key: "table",
            header: "Table",
            width: "minmax(210px,2fr)",
            cell: (銊壍) => (<span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">{銊壍.label}</span>
          <span className="truncate font-mono text-micro text-faint">{銊壍.sqlTable}</span>
        </span>),
        },
        { key: "rows", header: "Rows", width: "90px", align: "right", sortValue: (役壍) => 役壍.rows, cell: (繨壍) => <span className="tabular">{拮壍(繨壍.rows)}</span> },
        { key: "from", header: "From", width: "110px", sortValue: (鵗壍) => 鵗壍.firstDay, cell: (橆壍) => <span className="font-mono text-meta">{橆壍.firstDay ?? "—"}</span> },
        { key: "to", header: "To", width: "110px", sortValue: (褵壍) => 褵壍.lastDay, cell: (嘤壍) => <span className="font-mono text-meta">{嘤壍.lastDay ?? "—"}</span> },
        {
            key: "periods",
            header: "Stored",
            width: "120px",
            align: "right",
            sortValue: (甓壍) => 甓壍.periods,
            cell: (鐂壍) => <span className="tabular" title={`${拮壍(鐂壍.settledPeriods)} settled`}>{鐂壍.table === "search_term_daily" ? 仌壍(鐂壍.periods, "month") : 仌壍(鐂壍.periods, "day")}</span>,
        },
        {
            key: "beyond",
            header: "Beyond Google",
            width: "130px",
            align: "right",
            sortValue: (惱壍) => 惱壍.beyondGoogle,
            cell: (翠壍) => (翠壍.beyondGoogle > 0 ? <span className="tabular text-accent">{`+${拮壍(翠壍.beyondGoogle)}`}</span> : <span className="text-muted-3" title={翠壍.googleFrom ? `Google still serves this table from ${翠壍.googleFrom}` : undefined}>—</span>),
        },
        { key: "fetched", header: "Last fetched", width: "110px", align: "right", sortValue: (黏壍) => 黏壍.lastFetchedAt, cell: (殾壍) => <span className="text-xs text-muted-3">{殾壍.lastFetchedAt && 咬壍 !== null ? timeAgo(殾壍.lastFetchedAt, 咬壍) : "—"}</span> },
    ];
    const 読壍 = 螽壍.tables.every((垜壍) => 垜壍.rows === 0);
    return (<Card className="flex flex-col gap-4">
      <CardHeader title={`Stored for ${螽壍.account.name}`} sub="Per table · days older than Google still serves are counted under “Beyond Google”"/>
      <TileGrid min={170}>
        <StatTile label="Campaigns" value={拮壍(螽壍.dims.campaigns)}>
          <span className="text-xs text-muted-3">{`${仌壍(螽壍.dims.campaignVersions, "setting version")} · ${仌壍(螽壍.dims.adGroups, "ad group")} · ${仌壍(螽壍.dims.keywords, "keyword")}`}</span>
        </StatTile>
        <StatTile label="Change events" value={拮壍(螽壍.changeEvents.count)}>
          <span className="text-xs text-muted-3">{螽壍.changeEvents.firstDay ? `${formatLong(螽壍.changeEvents.firstDay)} → ${formatLong(螽壍.changeEvents.lastDay ?? 螽壍.changeEvents.firstDay)}` : "None stored yet"}</span>
        </StatTile>
        <StatTile label="Google's estimates" value={拮壍(螽壍.estimates.simulations + 螽壍.estimates.recommendations)}>
          <span className="text-xs text-muted-3">{`${仌壍(螽壍.estimates.simulations, "simulation")} · ${仌壍(螽壍.estimates.recommendations, "recommendation snapshot")}`}</span>
        </StatTile>
      </TileGrid>
      {読壍 ? <InlineEmpty>Nothing stored for this account yet. Sync it, or just use the dashboard: settled days are stored as they are read.</InlineEmpty> : null}
      <DataTable rows={螽壍.tables} columns={玛壍} rowKey={(皋壍) => 皋壍.table} ariaLabel={`Warehouse tables for ${螽壍.account.name}`} density="compact" minWidth={760}/>
    </Card>);
}
function Cmp46({ months: 扩壍, money: 腘壍, accountName: 乇壍 }: {
    months: WarehouseMonth[];
    money: MoneyFmt;
    accountName: string;
}) {
    const [洶壍, 谥壍] = useState(false);
    const 夔壍 = useMemo(() => 扩壍.map((砃壍) => 碈壍(砃壍.month)), [扩壍]);
    const 雲壍 = prefersReducedMotion();
    const 握壍 = (苐壍: ChartTokens) => ({
        ...baseOption(苐壍, 雲壍),
        grid: { left: 52, right: 8, top: 12, bottom: 22 },
        xAxis: categoryAxis(苐壍, 夔壍),
        yAxis: valueAxis(苐壍, "money", 腘壍, { splitNumber: 3 }),
        tooltip: {
            ...baseOption(苐壍, 雲壍).tooltip,
            trigger: "item",
            formatter: (便壍: {
                dataIndex: number;
            }) => {
                const 溮壍 = 扩壍[便壍.dataIndex];
                if (!溮壍)
                    return "";
                return tooltipHtml(碈壍(溮壍.month), [
                    { label: "Spend", value: displayMoney(溮壍.cost, 腘壍), color: 苐壍.accentLine },
                    { label: "Conversions", value: 拮壍(Math.round(溮壍.conversions * 10) / 10) },
                    { label: "ROAS", value: 溮壍.cost > 0 ? `${(溮壍.convValue / 溮壍.cost).toFixed(2)}×` : "—" },
                ]);
            },
        },
        series: [{ type: "bar", data: 扩壍.map((趝壍) => ({ value: 趝壍.cost, itemStyle: { color: 苐壍.accentLine, borderRadius: [4, 4, 0, 0] } })), barMaxWidth: 26, emphasis: { itemStyle: { opacity: 0.85 } } }],
    });
    const 媌壍 = 扩壍[0];
    const 祻壍 = 扩壍[扩壍.length - 1];
    return (<Card className="flex flex-col gap-3">
      <CardHeader title="Spend by month" sub="Straight from the warehouse (v_account_monthly) · last 13 months stored"/>
      {!扩壍.length || !媌壍 || !祻壍 ? (<InlineEmpty>No daily campaign data stored yet.</InlineEmpty>) : (<>
          <div className="relative" style={{ height: 220 }}>
            <EChart className="absolute inset-0" build={握壍} deps={[扩壍, 腘壍, 雲壍]} ariaLabel={`Monthly spend of ${乇壍} stored in the warehouse, ${碈壍(媌壍.month)} to ${碈壍(祻壍.month)}`}/>
          </div>
          <div className="flex justify-end">
            <Button variant="link" className="text-xs" onClick={() => 谥壍((顪壍) => !顪壍)} aria-expanded={洶壍}>
              {洶壍 ? "Hide table" : "View as table"}
            </Button>
          </div>
          {洶壍 ? (<DataTable rows={扩壍} rowKey={(教壍) => 教壍.month} ariaLabel="Monthly totals from the warehouse" density="compact" minWidth={520} columns={[
                    { key: "month", header: "Month", width: "110px", cell: (葈壍) => 碈壍(葈壍.month) },
                    { key: "cost", header: "Spend", width: "1fr", align: "right", cell: (儷壍) => <span className="tabular">{displayMoney(儷壍.cost, 腘壍)}</span> },
                    { key: "clicks", header: "Clicks", width: "1fr", align: "right", cell: (瀦壍) => <span className="tabular">{拮壍(瀦壍.clicks)}</span> },
                    { key: "conv", header: "Conversions", width: "1fr", align: "right", cell: (輕壍) => <span className="tabular">{拮壍(Math.round(輕壍.conversions * 10) / 10)}</span> },
                    { key: "roas", header: "ROAS", width: "90px", align: "right", cell: (射壍) => <span className="tabular">{射壍.cost > 0 ? `${(射壍.convValue / 射壍.cost).toFixed(2)}×` : "—"}</span> },
                ]}/>) : null}
        </>)}
    </Card>);
}
function 竳壍({ runs: 駢壍, timeZone: 曑壍 }: {
    runs: WarehouseRun[];
    timeZone: string;
}) {
    const 藀壍: Column<WarehouseRun>[] = [
        { key: "started", header: "Started", width: "130px", cell: (劯壍) => <span className="font-mono text-meta">{formatDateTime(劯壍.startedAt, 曑壍)}</span> },
        { key: "trigger", header: "Trigger", width: "100px", cell: (熞壍) => <span className="text-xs">{`${闿壍[熞壍.trigger]} · ${熞壍.scope === "all" ? "all" : "1 account"}`}</span> },
        { key: "status", header: "Status", width: "96px", cell: (邍壍) => <Pill tone={堡壍[邍壍.status]}>{眐壍[邍壍.status]}</Pill> },
        { key: "accounts", header: "Accounts", width: "84px", align: "right", cell: (嵼壍) => <span className="tabular">{拮壍(嵼壍.accounts)}</span> },
        { key: "requests", header: "Requests", width: "84px", align: "right", cell: (籫壍) => <span className="tabular" title={籫壍.mode !== "live" ? "No live data: no real API calls" : undefined}>{拮壍(籫壍.requests)}</span> },
        { key: "rows", header: "Rows written", width: "104px", align: "right", cell: (魚壍) => <span className="tabular">{拮壍(魚壍.rowsWritten)}</span> },
        { key: "duration", header: "Took", width: "84px", align: "right", cell: (桉壍) => <span className="text-xs text-muted-3">{嬑壍(桉壍)}</span> },
        { key: "note", header: "Note", width: "minmax(200px,2fr)", cell: (蜸壍) => <span className="line-clamp-2 text-xs text-muted-3" title={蜸壍.error ?? undefined}>{蜸壍.error ?? (蜸壍.budgetExhausted ? "Request budget reached" : "")}</span> },
    ];
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Recent syncs" sub="Hot days first, then days that settled, gaps and older history · one sync at a time"/>
      {駢壍.length ? <DataTable rows={駢壍} columns={藀壍} rowKey={(吧壍) => 吧壍.id} ariaLabel="Recent warehouse syncs" density="compact" minWidth={900}/> : <InlineEmpty>No sync yet. “Sync all accounts” fills the warehouse; reading the dashboard also stores settled days.</InlineEmpty>}
    </Card>);
}
