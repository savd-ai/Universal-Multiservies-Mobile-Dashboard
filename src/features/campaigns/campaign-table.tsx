"use client";
import { cn } from "@/components/ui/cn";
import { Checkbox } from "@/components/ui/controls";
import { Skeleton } from "@/components/ui/feedback";
import { MiddleTruncate } from "@/components/ui/middle-truncate";
import { Sparkline } from "@/components/ui/spark";
import type { CampaignListRow } from "@/lib/domain/contracts/actions";
import { MetricDelta, SeverityDot, StatusToggle } from "./campaign-bits";
import { formatMetric, gridMinWidth, gridTemplate, money, type CampaignTotals, type ColumnSpec, type MoneyFmt, type SortDir, type SortKey } from "./campaign-utils";
import type { TargetStatus } from "./use-campaign-writes";
export type Density = "comfortable" | "compact";
interface CampaignTableProps {
    rows: readonly CampaignListRow[];
    columns: readonly ColumnSpec[];
    sort: {
        key: SortKey;
        dir: SortDir;
    };
    onSort: (key: SortKey) => void;
    totals: CampaignTotals;
    prevTotals: CampaignTotals | null;
    accountCpa: number | null;
    money: MoneyFmt;
    density: Density;
    selected: ReadonlySet<string>;
    onSelectedChange: (next: Set<string>) => void;
    onOpen: (id: string) => void;
    onToggleStatus: (row: CampaignListRow) => void;
    pending: ReadonlyMap<string, TargetStatus>;
    empty: React.ReactNode;
}
export function CampaignTable(props: CampaignTableProps) {
    const { rows, columns, sort, onSort, totals, prevTotals, accountCpa, money: m, density, selected, onSelectedChange, onOpen, onToggleStatus, pending, empty } = props;
    const template = gridTemplate(columns, true);
    const minWidth = gridMinWidth(columns, true);
    const compare = prevTotals !== null;
    const ids = rows.map((r) => r.id);
    const selCount = ids.filter((id) => selected.has(id)).length;
    const allState: boolean | "mixed" = selCount === 0 ? false : selCount === ids.length ? true : "mixed";
    const toggleAll = () => {
        const next = new Set(selected);
        if (allState === true)
            ids.forEach((id) => next.delete(id));
        else
            ids.forEach((id) => next.add(id));
        onSelectedChange(next);
    };
    const toggle = (id: string) => {
        const next = new Set(selected);
        if (next.has(id))
            next.delete(id);
        else
            next.add(id);
        onSelectedChange(next);
    };
    const cell = (c: ColumnSpec, r: CampaignListRow) => {
        switch (c.key) {
            case "name": {
                const paused = (pending.get(r.id) ?? r.status) !== "Enabled";
                return (<div role="rowheader" key={c.key} className={cn("flex min-w-0 items-center gap-2.5", STICKY_NAME, selected.has(r.id) && "max-sm:bg-[color-mix(in_oklab,var(--color-teal)_6%,var(--surface))]")}>
            <SeverityDot paused={paused} severity={r.worstSeverity} count={r.signalCount}/>
            <div className="flex min-w-0 flex-col gap-0.5">
              <button type="button" onClick={(e) => {
                        e.stopPropagation();
                        onOpen(r.id);
                    }} className="flex min-w-0 max-w-full text-left font-medium transition-colors hover:text-accent" title={r.name}>
                <MiddleTruncate text={r.name}/>
              </button>
              <span className="flex min-w-0 items-center gap-1.5 font-mono text-micro tracking-[0.1em] text-faint uppercase">
                <span className="truncate">{r.type}</span>
              </span>
            </div>
          </div>);
            }
            case "status":
                return (<div role="cell" key={c.key} className="flex min-w-0">
            <StatusToggle status={r.status} pending={pending.get(r.id)} name={r.name} onToggle={() => onToggleStatus(r)}/>
          </div>);
            case "bidding":
                return (<div role="cell" key={c.key} className="min-w-0 truncate text-muted" title={r.biddingLabel}>
            {r.biddingLabel}
          </div>);
            case "budget":
                return (<div role="cell" key={c.key} className="flex min-w-0 flex-col items-end gap-0.5 text-right">
            <span>{money(r.dailyBudget, m)}</span>
            {r.budgetShared ? <span className="font-mono text-micro tracking-[0.1em] text-faint uppercase">Shared</span> : null}
          </div>);
            case "trend":
                return (<div role="cell" key={c.key} className="min-w-0">
            <Sparkline values={r.spark} height={26}/>
          </div>);
            default: {
                const key = c.key;
                const v = r.metrics[key];
                const vsAccount = key === "cpa" && v !== null && accountCpa !== null && accountCpa > 0 ? v / accountCpa : null;
                const warn = vsAccount !== null && vsAccount > 1.4;
                return (<div role="cell" key={c.key} className="flex min-w-0 flex-col items-end gap-0.5 text-right">
            <span className={warn ? "text-warn" : undefined} title={warn && vsAccount !== null ? `CPA is ${vsAccount.toFixed(1)}× the account CPA` : undefined}>
              {formatMetric(key, v, m)}
              {warn ? <span className="sr-only"> (above 1.4× account CPA)</span> : null}
            </span>
            {compare ? <MetricDelta metric={key} cur={v} prev={r.prev?.[key]} className="text-micro"/> : null}
          </div>);
            }
        }
    };
    const totalCell = (c: ColumnSpec) => {
        switch (c.key) {
            case "name":
                return (<span role="rowheader" key={c.key} className={cn("min-w-0 truncate", STICKY_NAME)}>
            {`Total · ${totals.count} campaign${totals.count === 1 ? "" : "s"}`}
          </span>);
            case "status":
            case "bidding":
            case "trend":
                return <span role="cell" key={c.key}/>;
            case "budget":
                return (<span role="cell" key={c.key} className="min-w-0 text-right">
            {money(totals.dailyBudget, m)}
          </span>);
            default:
                return (<span role="cell" key={c.key} className="flex min-w-0 flex-col items-end gap-0.5 text-right">
            <span>{formatMetric(c.key, totals[c.key], m)}</span>
            {prevTotals ? <MetricDelta metric={c.key} cur={totals[c.key]} prev={prevTotals[c.key]} className="text-micro font-normal"/> : null}
          </span>);
        }
    };
    return (<div className={cn("relative overflow-x-auto rounded-card border border-line bg-card shadow-card", PHONE_CARD)}>
      <div role="table" aria-label="Campaigns" aria-rowcount={rows.length + 2} className="tabular" style={{ minWidth }}>
        <div role="row" className="grid items-end gap-2.5 border-b border-line px-[22px] py-4" style={{ gridTemplateColumns: template }}>
          <span role="columnheader" className="flex items-center">
            <Checkbox checked={allState} onChange={toggleAll} ariaLabel={allState === true ? "Deselect all campaigns" : "Select all campaigns"}/>
          </span>
          {columns.map((c) => {
            const active = sort.key === c.key;
            const cls = cn("font-mono text-micro tracking-label whitespace-nowrap uppercase", active ? "text-fg" : "text-faint");
            return (<span key={c.key} role="columnheader" aria-sort={c.sortable ? (active ? (sort.dir === "asc" ? "ascending" : "descending") : "none") : undefined} className={cn("flex min-w-0", c.align === "right" && "justify-end", c.key === "name" && cn(STICKY_NAME, "max-sm:self-stretch max-sm:items-end"))}>
                {c.sortable ? (<button type="button" onClick={() => onSort(c.key as SortKey)} className={cn(cls, "transition-colors hover:text-fg")}>
                    {c.label}
                    {active ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}
                  </button>) : (<span className={cls}>{c.label}</span>)}
              </span>);
        })}
        </div>

        {rows.map((r) => {
            const isSel = selected.has(r.id);
            const shown = pending.get(r.id) ?? r.status;
            return (<div key={r.id} role="row" aria-selected={isSel} onClick={() => onOpen(r.id)} className={cn("grid cursor-pointer items-center gap-2.5 border-b border-line-soft px-[22px] text-[13px] transition-[background-color,opacity] hover:bg-fill", density === "compact" ? "py-2" : "py-3.5", shown !== "Enabled" && "opacity-55", isSel && "bg-teal/6 hover:bg-teal/6")} style={{ gridTemplateColumns: template }}>
              <span role="cell" className="flex items-center" onClick={(e) => e.stopPropagation()}>
                <Checkbox checked={isSel} onChange={() => toggle(r.id)} ariaLabel={`Select ${r.name}`}/>
              </span>
              {columns.map((c) => cell(c, r))}
            </div>);
        })}

        {rows.length === 0 ? (<div role="row" className="border-b border-line-soft px-[22px] py-10 text-center text-[13px] text-muted-3">
            <div role="cell">{empty}</div>
          </div>) : null}

        {rows.length > 0 ? (<div role="row" className="grid items-start gap-2.5 px-[22px] py-4 text-[13px] font-semibold" style={{ gridTemplateColumns: template }}>
            <span role="cell"/>
            {columns.map(totalCell)}
          </div>) : null}
      </div>
    </div>);
}
const STICKY_NAME = "max-sm:sticky max-sm:left-0 max-sm:z-[1] max-sm:-ml-2.5 max-sm:bg-surface max-sm:pr-3 max-sm:pl-2.5 max-sm:shadow-[10px_0_10px_-10px_rgba(0,0,0,0.2)]";
const PHONE_CARD = "max-sm:bg-none max-sm:bg-surface max-sm:[--name-min:150px]";
export function CampaignTableSkeleton({ columns, density, rows = 8 }: {
    columns: readonly ColumnSpec[];
    density: Density;
    rows?: number;
}) {
    const template = gridTemplate(columns, true);
    return (<div className={cn("relative overflow-x-auto rounded-card border border-line bg-card shadow-card", PHONE_CARD)} aria-busy="true">
      <div style={{ minWidth: gridMinWidth(columns, true) }}>
        <div className="grid items-end gap-2.5 border-b border-line px-[22px] py-4" style={{ gridTemplateColumns: template }}>
          <span className="size-4 rounded-[5px] border border-line-strong"/>
          {columns.map((c) => (<span key={c.key} className={cn("font-mono text-micro tracking-label whitespace-nowrap text-faint uppercase", c.align === "right" && "text-right")}>
              {c.label}
            </span>))}
        </div>
        {Array.from({ length: rows }, (_, i) => (<div key={i} className={cn("grid items-center gap-2.5 border-b border-line-soft px-[22px]", density === "compact" ? "py-2" : "py-3.5")} style={{ gridTemplateColumns: template }}>
            <span />
            {columns.map((c) => c.key === "name" ? (<div key={c.key} className="flex flex-col gap-1.5">
                  <Skeleton height={15} className="w-4/5"/>
                  <Skeleton height={10} className="w-16"/>
                </div>) : (<Skeleton key={c.key} height={12} className={cn(c.key === "status" ? "w-16" : "ml-auto w-3/4")}/>))}
          </div>))}
        <div className="px-[22px] py-4">
          <Skeleton height={13} className="w-40"/>
        </div>
      </div>
    </div>);
}
