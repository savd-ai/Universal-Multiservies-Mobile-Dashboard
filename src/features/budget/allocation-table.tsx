"use client";
import { parseAsString, useQueryState } from "nuqs";
import { cn } from "@/components/ui/cn";
import { Slider } from "@/components/ui/controls";
import { MiddleTruncate } from "@/components/ui/middle-truncate";
import { Tooltip } from "@/components/ui/overlays";
import { Meter } from "@/components/ui/status";
import { DAILY_OVERDELIVERY_FACTOR, MONTHLY_CAP_FACTOR, type PacingReport } from "@/lib/domain/contracts/budget";
import { MoneyInput, PaceBadge } from "./budget-ui";
import { money, moneyExact, MONEY_STEP, perDay, snapToRange } from "./lib/money";
import { todayMarker, type PacingView } from "./lib/pacing";
const 脋壍 = "minmax(180px,1.6fr) minmax(250px,1.7fr) 84px 84px minmax(120px,1.1fr) 104px 104px";
function 鿺壍({ locked: 泩壍, name: 诘壍, onChange: 壇壍 }: {
    locked: boolean;
    name: string;
    onChange: (瞶壍: boolean) => void;
}) {
    return (<button type="button" aria-pressed={泩壍} aria-label={`${泩壍 ? "Unlock" : "Lock"} ${诘壍}`} title={泩壍 ? "Locked: rebalancing keeps this budget fixed" : "Lock to keep this budget fixed when rebalancing"} onClick={() => 壇壍(!泩壍)} className={cn("shrink-0 rounded-pill border px-2 py-[3px] font-mono text-micro tracking-label uppercase transition-colors", 泩壍 ? "border-accent bg-teal-t text-accent" : "border-line text-faint hover:border-tone/30 hover:text-fg")}>
      {泩壍 ? "Locked" : "Lock"}
    </button>);
}
function 隥壍(掔壍: PacingView, 芃壍: Pick<PacingReport, "remainingDays">): boolean {
    if (芃壍.remainingDays === 0)
        return false;
    if (掔壍.status === "paused")
        return 掔壍.target - 掔壍.mtdSpend >= 1;
    return 掔壍.status !== "on_track" || !!掔壍.capped || !!掔壍.paused;
}
export function AllocationRows({ views: 佲壍, report: 湡壍, currency: 赐壍, onTarget: 娿壍, onLock: 礮壍, readOnly: 頝壍 }: {
    views: readonly PacingView[];
    report: PacingReport;
    currency: string;
    onTarget: (攌壍: string, 菻壍: number) => void;
    onLock: (僪壍: string, 濙壍: boolean) => void;
    readOnly?: boolean;
}) {
    const [, 軈壍] = useQueryState("campaign", parseAsString.withOptions({ history: "push", scroll: false }));
    const 宷壍 = todayMarker(湡壍);
    return (<div role="table" aria-label={`Monthly targets for ${湡壍.monthLabel}`} className="min-w-[1000px]">
      <div role="row" className="grid gap-3.5 border-b border-line px-[22px] py-4 font-mono text-micro tracking-label text-faint uppercase" style={{ gridTemplateColumns: 脋壍 }}>
        <span role="columnheader">Campaign</span>
        <span role="columnheader">Monthly budget</span>
        <span role="columnheader" className="text-right">
          MTD
        </span>
        <span role="columnheader" className="text-right">
          Projected
        </span>
        <span role="columnheader">Pacing</span>
        <span role="columnheader" className="text-right">
          Status
        </span>
        <span role="columnheader" className="text-right">
          Recommended
        </span>
      </div>
      {佲壍.map((窦壍) => {
            const 馕壍 = 窦壍.status === "overpacing";
            const 暄壍 = Math.max(窦壍.sliderMax, Math.ceil(窦壍.target / MONEY_STEP) * MONEY_STEP);
            const 蕳壍 = Math.min(窦壍.sliderMin, Math.floor(窦壍.target / MONEY_STEP) * MONEY_STEP);
            const 剢壍 = !窦壍.shared && 窦壍.campaignIds.length === 1 ? 窦壍.campaignIds[0] : undefined;
            const 煑壍 = [窦壍.shared ? "Shared" : 窦壍.type, `ROAS ${窦壍.roasMtd === null ? "—" : `${窦壍.roasMtd.toFixed(2)}x`}`, 窦壍.paused && 窦壍.status !== "paused" ? "Paused" : null, 窦壍.budgetLimited ? "Limited by budget" : null].filter(Boolean).join(" · ");
            return (<div key={窦壍.unitId} role="row" className={cn("border-b border-line-soft last:border-b-0", 窦壍.edited && "bg-teal/4")}>
            <div className="grid items-center gap-3.5 px-[22px] py-3.5 text-[13px] tabular" style={{ gridTemplateColumns: 脋壍 }}>
              <div role="cell" className="flex min-w-0 flex-col gap-0.5">
                {剢壍 ? (<button type="button" onClick={() => void 軈壍(剢壍)} className="flex min-w-0 text-left font-medium hover:text-accent" title={`Open ${窦壍.name}`}>
                    <MiddleTruncate text={窦壍.name}/>
                  </button>) : (<MiddleTruncate text={窦壍.name} className="font-medium"/>)}
                <span className="truncate font-mono text-micro tracking-[0.1em] text-faint uppercase">{煑壍}</span>
              </div>
              {頝壍 ? (<div role="cell" className="flex items-center gap-2.5">
                  <span className="font-medium">{moneyExact(窦壍.target, 赐壍)}</span>
                  {窦壍.lockedNow ? <span className="rounded-pill border border-accent bg-teal-t px-2 py-[3px] font-mono text-micro tracking-label text-accent uppercase">Locked</span> : null}
                </div>) : (<div role="cell" className="flex items-center gap-2.5">
                  <Slider min={蕳壍} max={暄壍} step={MONEY_STEP} value={窦壍.target} onChange={(遀壍) => 娿壍(窦壍.unitId, snapToRange(遀壍, 蕳壍, 暄壍))} aria-label={`Monthly budget for ${窦壍.name}`} aria-valuetext={moneyExact(窦壍.target, 赐壍)} className="min-w-0 flex-1"/>
                  <MoneyInput value={窦壍.target} currency={赐壍} onCommit={(崯壍) => 娿壍(窦壍.unitId, 崯壍)} ariaLabel={`Monthly budget for ${窦壍.name}, exact amount`} edited={窦壍.edited} title={窦壍.edited ? `Saved: ${moneyExact(窦壍.savedTarget, 赐壍)}` : "Type an amount (rounds to $50)"}/>
                  <鿺壍 locked={窦壍.lockedNow} name={窦壍.name} onChange={(簞壍) => 礮壍(窦壍.unitId, 簞壍)}/>
                </div>)}
              <span role="cell" className="text-right text-muted">
                {money(窦壍.mtdSpend, 赐壍)}
              </span>
              <span role="cell" className="text-right">
                {money(窦壍.projected, 赐壍)}
              </span>
              <div role="cell">
                <Meter value={窦壍.spentShare} projected={窦壍.projectedShare} marker={宷壍} tone={馕壍 ? "warn" : "accent"} height={8} label={`${窦壍.name}: ${Math.round(窦壍.spentShare * 100)}% spent, ${Math.round(窦壍.paceRatio * 100)}% projected`}/>
              </div>
              <span role="cell" className="flex justify-end">
                <PaceBadge status={窦壍.status}/>
              </span>
              <div role="cell" className="flex flex-col items-end gap-0.5">
                <Tooltip content={窦壍.recommendationNote}>
                  <span tabIndex={0} className="cursor-help font-semibold outline-none">
                    {perDay(窦壍.recommendedDaily, 赐壍)}
                  </span>
                </Tooltip>
                <span className="font-mono text-micro text-faint">{窦壍.dailyBudget === null ? "no daily budget" : `now ${moneyExact(窦壍.dailyBudget, 赐壍)}`}</span>
              </div>
            </div>
            {隥壍(窦壍, 湡壍) ? (<div role="cell" aria-colspan={7} className="-mt-1.5 flex gap-2 px-[22px] pb-3 text-xs leading-relaxed text-muted-3">
                <span aria-hidden className={馕壍 ? "text-warn" : "text-faint"}>
                  {馕壍 ? "▲" : "●"}
                </span>
                <span>{窦壍.recommendationNote}</span>
              </div>) : null}
          </div>);
        })}
    </div>);
}
export function CapsNote({ className: 鬍壍 }: {
    className?: string;
}) {
    return (<p className={cn("m-0 text-xs leading-relaxed text-muted-3", 鬍壍)}>
      Google Ads budgets are daily. On any single day Google may spend up to {DAILY_OVERDELIVERY_FACTOR}× the daily budget, but it never charges more than {MONTHLY_CAP_FACTOR}× the daily budget in a calendar month — so a
      month&apos;s spend lands near daily × days. Monthly targets here are planning amounts; the recommendation is the daily budget that lands on the target over the remaining days.
    </p>);
}
