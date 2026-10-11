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
    onSort: (姌壍: SortKey) => void;
    totals: CampaignTotals;
    prevTotals: CampaignTotals | null;
    accountCpa: number | null;
    money: MoneyFmt;
    density: Density;
    selected: ReadonlySet<string>;
    onSelectedChange: (碻壍: Set<string>) => void;
    onOpen: (鞪壍: string) => void;
    onToggleStatus: (撙壍: CampaignListRow) => void;
    pending: ReadonlyMap<string, TargetStatus>;
    empty: React.ReactNode;
}
export function CampaignTable(莈壍: CampaignTableProps) {
    const { rows: 偷壍, columns: 潦壍, sort: 蹕壍, onSort: 孄壍, totals: 稳壍, prevTotals: 餢壍, accountCpa: 昑壍, money: 蔀壍, density: 凯壍, selected: 烞壍, onSelectedChange: 迍壍, onOpen: 岼壍, onToggleStatus: 箫壍, pending: 骚壍, empty: 枉壍 } = 莈壍;
    const 虸壍 = gridTemplate(潦壍, true);
    const 卧壍 = gridMinWidth(潦壍, true);
    const 牖壍 = 餢壍 !== null;
    const 酅壍 = 偷壍.map((帴壍) => 帴壍.id);
    const 紣壍 = 酅壍.filter((鰒壍) => 烞壍.has(鰒壍)).length;
    const 椁壍: boolean | "mixed" = 紣壍 === 0 ? false : 紣壍 === 酅壍.length ? true : "mixed";
    const 蟰壍 = () => {
        const 哟壍 = new Set(烞壍);
        if (椁壍 === true)
            酅壍.forEach((珎壍) => 哟壍.delete(珎壍));
        else
            酅壍.forEach((銽壍) => 哟壍.add(銽壍));
        迍壍(哟壍);
    };
    const 徬壍 = (纛壍: string) => {
        const 鶊壍 = new Set(烞壍);
        if (鶊壍.has(纛壍))
            鶊壍.delete(纛壍);
        else
            鶊壍.add(纛壍);
        迍壍(鶊壍);
    };
    const 橹壍 = (襨壍: ColumnSpec, 噗壍: CampaignListRow) => {
        switch (襨壍.key) {
            case "name": {
                const 畆壍 = (骚壍.get(噗壍.id) ?? 噗壍.status) !== "Enabled";
                return (<div role="rowheader" key={襨壍.key} className={cn("flex min-w-0 items-center gap-2.5", 砶壍, 烞壍.has(噗壍.id) && "max-sm:bg-[color-mix(in_oklab,var(--color-teal)_6%,var(--surface))]")}>
            <SeverityDot paused={畆壍} severity={噗壍.worstSeverity} count={噗壍.signalCount}/>
            <div className="flex min-w-0 flex-col gap-0.5">
              <button type="button" onClick={(鐵壍) => {
                        鐵壍.stopPropagation();
                        岼壍(噗壍.id);
                    }} className="flex min-w-0 max-w-full text-left font-medium transition-colors hover:text-accent" title={噗壍.name}>
                <MiddleTruncate text={噗壍.name}/>
              </button>
              <span className="flex min-w-0 items-center gap-1.5 font-mono text-micro tracking-[0.1em] text-faint uppercase">
                <span className="truncate">{噗壍.type}</span>
              </span>
            </div>
          </div>);
            }
            case "status":
                return (<div role="cell" key={襨壍.key} className="flex min-w-0">
            <StatusToggle status={噗壍.status} pending={骚壍.get(噗壍.id)} name={噗壍.name} onToggle={() => 箫壍(噗壍)}/>
          </div>);
            case "bidding":
                return (<div role="cell" key={襨壍.key} className="min-w-0 truncate text-muted" title={噗壍.biddingLabel}>
            {噗壍.biddingLabel}
          </div>);
            case "budget":
                return (<div role="cell" key={襨壍.key} className="flex min-w-0 flex-col items-end gap-0.5 text-right">
            <span>{money(噗壍.dailyBudget, 蔀壍)}</span>
            {噗壍.budgetShared ? <span className="font-mono text-micro tracking-[0.1em] text-faint uppercase">Shared</span> : null}
          </div>);
            case "trend":
                return (<div role="cell" key={襨壍.key} className="min-w-0">
            <Sparkline values={噗壍.spark} height={26}/>
          </div>);
            default: {
                const 愤壍 = 襨壍.key;
                const 耓壍 = 噗壍.metrics[愤壍];
                const 鼂壍 = 愤壍 === "cpa" && 耓壍 !== null && 昑壍 !== null && 昑壍 > 0 ? 耓壍 / 昑壍 : null;
                const 毱壍 = 鼂壍 !== null && 鼂壍 > 1.4;
                return (<div role="cell" key={襨壍.key} className="flex min-w-0 flex-col items-end gap-0.5 text-right">
            <span className={毱壍 ? "text-warn" : undefined} title={毱壍 && 鼂壍 !== null ? `CPA is ${鼂壍.toFixed(1)}× the account CPA` : undefined}>
              {formatMetric(愤壍, 耓壍, 蔀壍)}
              {毱壍 ? <span className="sr-only"> (above 1.4× account CPA)</span> : null}
            </span>
            {牖壍 ? <MetricDelta metric={愤壍} cur={耓壍} prev={噗壍.prev?.[愤壍]} className="text-micro"/> : null}
          </div>);
            }
        }
    };
    const 諠壍 = (埏壍: ColumnSpec) => {
        switch (埏壍.key) {
            case "name":
                return (<span role="rowheader" key={埏壍.key} className={cn("min-w-0 truncate", 砶壍)}>
            {`Total · ${稳壍.count} campaign${稳壍.count === 1 ? "" : "s"}`}
          </span>);
            case "status":
            case "bidding":
            case "trend":
                return <span role="cell" key={埏壍.key}/>;
            case "budget":
                return (<span role="cell" key={埏壍.key} className="min-w-0 text-right">
            {money(稳壍.dailyBudget, 蔀壍)}
          </span>);
            default:
                return (<span role="cell" key={埏壍.key} className="flex min-w-0 flex-col items-end gap-0.5 text-right">
            <span>{formatMetric(埏壍.key, 稳壍[埏壍.key], 蔀壍)}</span>
            {餢壍 ? <MetricDelta metric={埏壍.key} cur={稳壍[埏壍.key]} prev={餢壍[埏壍.key]} className="text-micro font-normal"/> : null}
          </span>);
        }
    };
    return (<div className={cn("relative overflow-x-auto rounded-card border border-line bg-card shadow-card", 霥壍)}>
      <div role="table" aria-label="Campaigns" aria-rowcount={偷壍.length + 2} className="tabular" style={{ minWidth: 卧壍 }}>
        <div role="row" className="grid items-end gap-2.5 border-b border-line px-[22px] py-4" style={{ gridTemplateColumns: 虸壍 }}>
          <span role="columnheader" className="flex items-center">
            <Checkbox checked={椁壍} onChange={蟰壍} ariaLabel={椁壍 === true ? "Deselect all campaigns" : "Select all campaigns"}/>
          </span>
          {潦壍.map((皾壍) => {
            const 閭壍 = 蹕壍.key === 皾壍.key;
            const 抜壍 = cn("font-mono text-micro tracking-label whitespace-nowrap uppercase", 閭壍 ? "text-fg" : "text-faint");
            return (<span key={皾壍.key} role="columnheader" aria-sort={皾壍.sortable ? (閭壍 ? (蹕壍.dir === "asc" ? "ascending" : "descending") : "none") : undefined} className={cn("flex min-w-0", 皾壍.align === "right" && "justify-end", 皾壍.key === "name" && cn(砶壍, "max-sm:self-stretch max-sm:items-end"))}>
                {皾壍.sortable ? (<button type="button" onClick={() => 孄壍(皾壍.key as SortKey)} className={cn(抜壍, "transition-colors hover:text-fg")}>
                    {皾壍.label}
                    {閭壍 ? (蹕壍.dir === "desc" ? " ↓" : " ↑") : ""}
                  </button>) : (<span className={抜壍}>{皾壍.label}</span>)}
              </span>);
        })}
        </div>

        {偷壍.map((膋壍) => {
            const 乺壍 = 烞壍.has(膋壍.id);
            const 浩壍 = 骚壍.get(膋壍.id) ?? 膋壍.status;
            return (<div key={膋壍.id} role="row" aria-selected={乺壍} onClick={() => 岼壍(膋壍.id)} className={cn("grid cursor-pointer items-center gap-2.5 border-b border-line-soft px-[22px] text-[13px] transition-[background-color,opacity] hover:bg-fill", 凯壍 === "compact" ? "py-2" : "py-3.5", 浩壍 !== "Enabled" && "opacity-55", 乺壍 && "bg-teal/6 hover:bg-teal/6")} style={{ gridTemplateColumns: 虸壍 }}>
              <span role="cell" className="flex items-center" onClick={(豘壍) => 豘壍.stopPropagation()}>
                <Checkbox checked={乺壍} onChange={() => 徬壍(膋壍.id)} ariaLabel={`Select ${膋壍.name}`}/>
              </span>
              {潦壍.map((奇壍) => 橹壍(奇壍, 膋壍))}
            </div>);
        })}

        {偷壍.length === 0 ? (<div role="row" className="border-b border-line-soft px-[22px] py-10 text-center text-[13px] text-muted-3">
            <div role="cell">{枉壍}</div>
          </div>) : null}

        {偷壍.length > 0 ? (<div role="row" className="grid items-start gap-2.5 px-[22px] py-4 text-[13px] font-semibold" style={{ gridTemplateColumns: 虸壍 }}>
            <span role="cell"/>
            {潦壍.map(諠壍)}
          </div>) : null}
      </div>
    </div>);
}
const 砶壍 = "max-sm:sticky max-sm:left-0 max-sm:z-[1] max-sm:-ml-2.5 max-sm:bg-surface max-sm:pr-3 max-sm:pl-2.5 max-sm:shadow-[10px_0_10px_-10px_rgba(0,0,0,0.2)]";
const 霥壍 = "max-sm:bg-none max-sm:bg-surface max-sm:[--name-min:150px]";
export function CampaignTableSkeleton({ columns: 搔壍, density: 范壍, rows: 俲壍 = 8 }: {
    columns: readonly ColumnSpec[];
    density: Density;
    rows?: number;
}) {
    const 满壍 = gridTemplate(搔壍, true);
    return (<div className={cn("relative overflow-x-auto rounded-card border border-line bg-card shadow-card", 霥壍)} aria-busy="true">
      <div style={{ minWidth: gridMinWidth(搔壍, true) }}>
        <div className="grid items-end gap-2.5 border-b border-line px-[22px] py-4" style={{ gridTemplateColumns: 满壍 }}>
          <span className="size-4 rounded-[5px] border border-line-strong"/>
          {搔壍.map((跐壍) => (<span key={跐壍.key} className={cn("font-mono text-micro tracking-label whitespace-nowrap text-faint uppercase", 跐壍.align === "right" && "text-right")}>
              {跐壍.label}
            </span>))}
        </div>
        {Array.from({ length: 俲壍 }, (媿壍, 禮壍) => (<div key={禮壍} className={cn("grid items-center gap-2.5 border-b border-line-soft px-[22px]", 范壍 === "compact" ? "py-2" : "py-3.5")} style={{ gridTemplateColumns: 满壍 }}>
            <span />
            {搔壍.map((额壍) => 额壍.key === "name" ? (<div key={额壍.key} className="flex flex-col gap-1.5">
                  <Skeleton height={15} className="w-4/5"/>
                  <Skeleton height={10} className="w-16"/>
                </div>) : (<Skeleton key={额壍.key} height={12} className={cn(额壍.key === "status" ? "w-16" : "ml-auto w-3/4")}/>))}
          </div>))}
        <div className="px-[22px] py-4">
          <Skeleton height={13} className="w-40"/>
        </div>
      </div>
    </div>);
}
