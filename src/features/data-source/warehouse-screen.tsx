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
import { HistoryCard } from "./history-card";
import { useNow } from "./use-now";
const DESCRIPTION = "Google Ads data is kept in a local SQLite database, so history outlives Google's limits (30 days of change history, 92 days hourly, 12 months of search terms, 37 months daily) and settled days are read locally instead of asking Google again.";
const RUN_TONE: Record<SyncStatus, Tone> = { ok: "accent", partial: "warn", failed: "crit", running: "muted" };
const RUN_LABEL: Record<SyncStatus, string> = { ok: "OK", partial: "Partial", failed: "Failed", running: "Running" };
const TRIGGER_LABEL: Record<WarehouseRun["trigger"], string> = { manual: "Sync now", schedule: "Timer", cron: "Cron", cli: "CLI" };
const num = (n: number) => n.toLocaleString("en-US");
const count = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
const monthLabel = (m: string) => new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
function shortPath(p: string | null): string {
    if (!p)
        return "—";
    const parts = p.split(/[\\/]/).filter(Boolean);
    return p.length > 34 && parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : p;
}
function bytes(n: number | null): string {
    if (n === null)
        return "In memory";
    if (n < 1024 * 1024)
        return `${Math.max(1, Math.round(n / 1024))} KB`;
    return `${(n / 1048576).toFixed(1)} MB`;
}
function duration(r: WarehouseRun): string {
    if (!r.finishedAt)
        return "—";
    const s = Math.max(0, Math.round((Date.parse(r.finishedAt) - Date.parse(r.startedAt)) / 1000));
    return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}
export function WarehouseScreen() {
    const status = useStatus();
    const accountId = status.data?.account.id ?? "";
    const wh = useWarehouse(accountId);
    const sync = useWarehouseSync(accountId);
    const w = wh.data;
    const busy = !!w?.running || sync.isPending;
    const start = (scope: "account" | "all") => sync.mutate({ scope }, {
        onSuccess: (r) => toast(r.started ? (scope === "all" ? "Syncing every account in the background" : "Syncing this account in the background") : (r.reason ?? "Nothing to sync"), { tone: r.started ? "default" : "warn" }),
        onError: (e) => toast(e.message || "Sync failed to start", { tone: "crit" }),
    });
    const header = (<PageHeader description={DESCRIPTION} actions={<>
          <Button variant="outline" onClick={() => start("account")} loading={sync.isPending && sync.variables?.scope === "account"} disabled={busy || !w?.available}>
            Sync this account
          </Button>
          <Button variant="brand" onClick={() => start("all")} loading={sync.isPending && sync.variables?.scope === "all"} disabled={busy || !w?.available}>
            Sync all accounts
          </Button>
        </>}/>);
    if (wh.error && !w) {
        return (<div className="flex flex-col gap-6">
        {header}
        <ErrorState error={wh.error} onRetry={() => void wh.refetch()}/>
      </div>);
    }
    if (!w || !status.data) {
        return (<div className="flex flex-col gap-6">
        {header}
        <Skeleton height={190} className="rounded-card"/>
        <Skeleton height={380} className="rounded-card"/>
      </div>);
    }
    const money = moneyFromStatus(status.data);
    return (<div className="flex flex-col gap-6">
      {header}
      <StorageCard w={w}/>
      <HistoryCard accountId={accountId}/>
      {w.available ? (<>
          <CoverageCard w={w}/>
          <MonthsCard months={w.months} money={money} accountName={w.account.name}/>
          <RunsCard runs={w.runs} timeZone={status.data.account.timezone}/>
        </>) : null}
    </div>);
}
function StorageCard({ w }: {
    w: WarehouseStatus;
}) {
    const now = useNow();
    const state = !w.enabled ? { label: "Off", tone: "faint" as Tone } : w.available ? { label: "On", tone: "accent" as Tone } : { label: "Unavailable", tone: "crit" as Tone };
    return (<Card accent={w.available} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Dot tone={state.tone} halo={w.available} size={9}/>
        <span className="font-display text-2xl font-semibold tracking-[-0.02em]">SQLite warehouse</span>
        <Pill tone={state.tone}>{state.label}</Pill>
        <Pill tone={w.mode === "live" ? "accent" : "warn"}>{w.mode === "live" ? "Live data" : "No live data"}</Pill>
        {w.running ? <Pill tone="muted">{`Syncing · started ${now !== null ? timeAgo(w.running.startedAt, now) : ""}`}</Pill> : null}
      </div>
      {w.reason ? <p className="m-0 max-w-[80ch] text-[14px] leading-relaxed text-muted">{w.reason}</p> : null}
      {w.available ? (<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetaStat label="File" value={<span className="block truncate font-mono text-[13px]" title={w.file ?? ""}>{shortPath(w.file)}</span>}/>
          <MetaStat label="Size" value={<span className="text-[15px]">{bytes(w.sizeBytes)}</span>}/>
          <MetaStat label="Schema" value={<span className="font-mono text-[14px]">{`v${w.schemaVersion} · SQLite ${w.sqliteVersion ?? "?"}`}</span>}/>
          <MetaStat label="Accounts stored" value={<span className="text-[15px]">{num(w.accountsStored)}</span>}/>
        </div>) : null}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-line pt-4 text-xs text-muted-3">
        <span>{`Settled days read locally: ${w.reads ? "on" : "off (store only)"}`}</span>
        <span>{w.scheduler.enabled ? `Sync timer: every ${w.scheduler.intervalMinutes} min${w.scheduler.lastTickAt && now !== null ? ` · last ${timeAgo(w.scheduler.lastTickAt, now)}` : ""}` : "Sync timer: off (WAREHOUSE_SYNC_ENABLED)"}</span>
        <span>{`Backfill ${num(w.backfillDays)} days`}</span>
        <span>{`Up to ${num(w.maxRequests)} API requests per sync`}</span>
        <span>{w.retentionDays ? `Facts kept ${num(w.retentionDays)} days` : "Facts kept forever"}</span>
        <span>{`Last ${w.restatementDays} days refreshed (conversions restate)`}</span>
      </div>
      {w.note ? <p className="m-0 text-xs leading-relaxed text-muted-3">{w.note}</p> : null}
    </Card>);
}
function CoverageCard({ w }: {
    w: WarehouseStatus;
}) {
    const now = useNow();
    const columns: Column<WarehouseTableCoverage>[] = [
        {
            key: "table",
            header: "Table",
            width: "minmax(210px,2fr)",
            cell: (t) => (<span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">{t.label}</span>
          <span className="truncate font-mono text-micro text-faint">{t.sqlTable}</span>
        </span>),
        },
        { key: "rows", header: "Rows", width: "90px", align: "right", sortValue: (t) => t.rows, cell: (t) => <span className="tabular">{num(t.rows)}</span> },
        { key: "from", header: "From", width: "110px", sortValue: (t) => t.firstDay, cell: (t) => <span className="font-mono text-meta">{t.firstDay ?? "—"}</span> },
        { key: "to", header: "To", width: "110px", sortValue: (t) => t.lastDay, cell: (t) => <span className="font-mono text-meta">{t.lastDay ?? "—"}</span> },
        {
            key: "periods",
            header: "Stored",
            width: "120px",
            align: "right",
            sortValue: (t) => t.periods,
            cell: (t) => <span className="tabular" title={`${num(t.settledPeriods)} settled`}>{t.table === "search_term_daily" ? count(t.periods, "month") : count(t.periods, "day")}</span>,
        },
        {
            key: "beyond",
            header: "Beyond Google",
            width: "130px",
            align: "right",
            sortValue: (t) => t.beyondGoogle,
            cell: (t) => (t.beyondGoogle > 0 ? <span className="tabular text-accent">{`+${num(t.beyondGoogle)}`}</span> : <span className="text-muted-3" title={t.googleFrom ? `Google still serves this table from ${t.googleFrom}` : undefined}>—</span>),
        },
        { key: "fetched", header: "Last fetched", width: "110px", align: "right", sortValue: (t) => t.lastFetchedAt, cell: (t) => <span className="text-xs text-muted-3">{t.lastFetchedAt && now !== null ? timeAgo(t.lastFetchedAt, now) : "—"}</span> },
    ];
    const empty = w.tables.every((t) => t.rows === 0);
    return (<Card className="flex flex-col gap-4">
      <CardHeader title={`Stored for ${w.account.name}`} sub="Per table · days older than Google still serves are counted under “Beyond Google”"/>
      <TileGrid min={170}>
        <StatTile label="Campaigns" value={num(w.dims.campaigns)}>
          <span className="text-xs text-muted-3">{`${count(w.dims.campaignVersions, "setting version")} · ${count(w.dims.adGroups, "ad group")} · ${count(w.dims.keywords, "keyword")}`}</span>
        </StatTile>
        <StatTile label="Change events" value={num(w.changeEvents.count)}>
          <span className="text-xs text-muted-3">{w.changeEvents.firstDay ? `${formatLong(w.changeEvents.firstDay)} → ${formatLong(w.changeEvents.lastDay ?? w.changeEvents.firstDay)}` : "None stored yet"}</span>
        </StatTile>
        <StatTile label="Google's estimates" value={num(w.estimates.simulations + w.estimates.recommendations)}>
          <span className="text-xs text-muted-3">{`${count(w.estimates.simulations, "simulation")} · ${count(w.estimates.recommendations, "recommendation snapshot")}`}</span>
        </StatTile>
      </TileGrid>
      {empty ? <InlineEmpty>Nothing stored for this account yet. Sync it, or just use the dashboard: settled days are stored as they are read.</InlineEmpty> : null}
      <DataTable rows={w.tables} columns={columns} rowKey={(t) => t.table} ariaLabel={`Warehouse tables for ${w.account.name}`} density="compact" minWidth={760}/>
    </Card>);
}
function MonthsCard({ months, money, accountName }: {
    months: WarehouseMonth[];
    money: MoneyFmt;
    accountName: string;
}) {
    const [table, setTable] = useState(false);
    const labels = useMemo(() => months.map((m) => monthLabel(m.month)), [months]);
    const reduced = prefersReducedMotion();
    const build = (t: ChartTokens) => ({
        ...baseOption(t, reduced),
        grid: { left: 52, right: 8, top: 12, bottom: 22 },
        xAxis: categoryAxis(t, labels),
        yAxis: valueAxis(t, "money", money, { splitNumber: 3 }),
        tooltip: {
            ...baseOption(t, reduced).tooltip,
            trigger: "item",
            formatter: (p: {
                dataIndex: number;
            }) => {
                const m = months[p.dataIndex];
                if (!m)
                    return "";
                return tooltipHtml(monthLabel(m.month), [
                    { label: "Spend", value: displayMoney(m.cost, money), color: t.accentLine },
                    { label: "Conversions", value: num(Math.round(m.conversions * 10) / 10) },
                    { label: "ROAS", value: m.cost > 0 ? `${(m.convValue / m.cost).toFixed(2)}×` : "—" },
                ]);
            },
        },
        series: [{ type: "bar", data: months.map((m) => ({ value: m.cost, itemStyle: { color: t.accentLine, borderRadius: [4, 4, 0, 0] } })), barMaxWidth: 26, emphasis: { itemStyle: { opacity: 0.85 } } }],
    });
    const first = months[0];
    const last = months[months.length - 1];
    return (<Card className="flex flex-col gap-3">
      <CardHeader title="Spend by month" sub="Straight from the warehouse (v_account_monthly) · last 13 months stored"/>
      {!months.length || !first || !last ? (<InlineEmpty>No daily campaign data stored yet.</InlineEmpty>) : (<>
          <div className="relative" style={{ height: 220 }}>
            <EChart className="absolute inset-0" build={build} deps={[months, money, reduced]} ariaLabel={`Monthly spend of ${accountName} stored in the warehouse, ${monthLabel(first.month)} to ${monthLabel(last.month)}`}/>
          </div>
          <div className="flex justify-end">
            <Button variant="link" className="text-xs" onClick={() => setTable((v) => !v)} aria-expanded={table}>
              {table ? "Hide table" : "View as table"}
            </Button>
          </div>
          {table ? (<DataTable rows={months} rowKey={(m) => m.month} ariaLabel="Monthly totals from the warehouse" density="compact" minWidth={520} columns={[
                    { key: "month", header: "Month", width: "110px", cell: (m) => monthLabel(m.month) },
                    { key: "cost", header: "Spend", width: "1fr", align: "right", cell: (m) => <span className="tabular">{displayMoney(m.cost, money)}</span> },
                    { key: "clicks", header: "Clicks", width: "1fr", align: "right", cell: (m) => <span className="tabular">{num(m.clicks)}</span> },
                    { key: "conv", header: "Conversions", width: "1fr", align: "right", cell: (m) => <span className="tabular">{num(Math.round(m.conversions * 10) / 10)}</span> },
                    { key: "roas", header: "ROAS", width: "90px", align: "right", cell: (m) => <span className="tabular">{m.cost > 0 ? `${(m.convValue / m.cost).toFixed(2)}×` : "—"}</span> },
                ]}/>) : null}
        </>)}
    </Card>);
}
function RunsCard({ runs, timeZone }: {
    runs: WarehouseRun[];
    timeZone: string;
}) {
    const columns: Column<WarehouseRun>[] = [
        { key: "started", header: "Started", width: "130px", cell: (r) => <span className="font-mono text-meta">{formatDateTime(r.startedAt, timeZone)}</span> },
        { key: "trigger", header: "Trigger", width: "100px", cell: (r) => <span className="text-xs">{`${TRIGGER_LABEL[r.trigger]} · ${r.scope === "all" ? "all" : "1 account"}`}</span> },
        { key: "status", header: "Status", width: "96px", cell: (r) => <Pill tone={RUN_TONE[r.status]}>{RUN_LABEL[r.status]}</Pill> },
        { key: "accounts", header: "Accounts", width: "84px", align: "right", cell: (r) => <span className="tabular">{num(r.accounts)}</span> },
        { key: "requests", header: "Requests", width: "84px", align: "right", cell: (r) => <span className="tabular" title={r.mode !== "live" ? "No live data: no real API calls" : undefined}>{num(r.requests)}</span> },
        { key: "rows", header: "Rows written", width: "104px", align: "right", cell: (r) => <span className="tabular">{num(r.rowsWritten)}</span> },
        { key: "duration", header: "Took", width: "84px", align: "right", cell: (r) => <span className="text-xs text-muted-3">{duration(r)}</span> },
        { key: "note", header: "Note", width: "minmax(200px,2fr)", cell: (r) => <span className="line-clamp-2 text-xs text-muted-3" title={r.error ?? undefined}>{r.error ?? (r.budgetExhausted ? "Request budget reached" : "")}</span> },
    ];
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Recent syncs" sub="Hot days first, then days that settled, gaps and older history · one sync at a time"/>
      {runs.length ? <DataTable rows={runs} columns={columns} rowKey={(r) => r.id} ariaLabel="Recent warehouse syncs" density="compact" minWidth={900}/> : <InlineEmpty>No sync yet. “Sync all accounts” fills the warehouse; reading the dashboard also stores settled days.</InlineEmpty>}
    </Card>);
}
