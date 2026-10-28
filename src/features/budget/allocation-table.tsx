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
const GRID = "minmax(180px,1.6fr) minmax(250px,1.7fr) 84px 84px minmax(120px,1.1fr) 104px 104px";
function LockToggle({ locked, name, onChange }: {
    locked: boolean;
    name: string;
    onChange: (v: boolean) => void;
}) {
    return (<button type="button" aria-pressed={locked} aria-label={`${locked ? "Unlock" : "Lock"} ${name}`} title={locked ? "Locked: rebalancing keeps this budget fixed" : "Lock to keep this budget fixed when rebalancing"} onClick={() => onChange(!locked)} className={cn("shrink-0 rounded-pill border px-2 py-[3px] font-mono text-micro tracking-label uppercase transition-colors", locked ? "border-accent bg-teal-t text-accent" : "border-line text-faint hover:border-tone/30 hover:text-fg")}>
      {locked ? "Locked" : "Lock"}
    </button>);
}
function needsNote(v: PacingView, report: Pick<PacingReport, "remainingDays">): boolean {
    if (report.remainingDays === 0)
        return false;
    if (v.status === "paused")
        return v.target - v.mtdSpend >= 1;
    return v.status !== "on_track" || !!v.capped || !!v.paused;
}
export function AllocationRows({ views, report, currency, onTarget, onLock, readOnly }: {
    views: readonly PacingView[];
    report: PacingReport;
    currency: string;
    onTarget: (unitId: string, v: number) => void;
    onLock: (unitId: string, locked: boolean) => void;
    readOnly?: boolean;
}) {
    const [, setCampaign] = useQueryState("campaign", parseAsString.withOptions({ history: "push", scroll: false }));
    const marker = todayMarker(report);
    return (<div role="table" aria-label={`Monthly targets for ${report.monthLabel}`} className="min-w-[1000px]">
      <div role="row" className="grid gap-3.5 border-b border-line px-[22px] py-4 font-mono text-micro tracking-label text-faint uppercase" style={{ gridTemplateColumns: GRID }}>
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
      {views.map((v) => {
            const over = v.status === "overpacing";
            const max = Math.max(v.sliderMax, Math.ceil(v.target / MONEY_STEP) * MONEY_STEP);
            const min = Math.min(v.sliderMin, Math.floor(v.target / MONEY_STEP) * MONEY_STEP);
            const campaignId = !v.shared && v.campaignIds.length === 1 ? v.campaignIds[0] : undefined;
            const sub = [v.shared ? "Shared" : v.type, `ROAS ${v.roasMtd === null ? "—" : `${v.roasMtd.toFixed(2)}x`}`, v.paused && v.status !== "paused" ? "Paused" : null, v.budgetLimited ? "Limited by budget" : null].filter(Boolean).join(" · ");
            return (<div key={v.unitId} role="row" className={cn("border-b border-line-soft last:border-b-0", v.edited && "bg-teal/4")}>
            <div className="grid items-center gap-3.5 px-[22px] py-3.5 text-[13px] tabular" style={{ gridTemplateColumns: GRID }}>
              <div role="cell" className="flex min-w-0 flex-col gap-0.5">
                {campaignId ? (<button type="button" onClick={() => void setCampaign(campaignId)} className="flex min-w-0 text-left font-medium hover:text-accent" title={`Open ${v.name}`}>
                    <MiddleTruncate text={v.name}/>
                  </button>) : (<MiddleTruncate text={v.name} className="font-medium"/>)}
                <span className="truncate font-mono text-micro tracking-[0.1em] text-faint uppercase">{sub}</span>
              </div>
              {readOnly ? (<div role="cell" className="flex items-center gap-2.5">
                  <span className="font-medium">{moneyExact(v.target, currency)}</span>
                  {v.lockedNow ? <span className="rounded-pill border border-accent bg-teal-t px-2 py-[3px] font-mono text-micro tracking-label text-accent uppercase">Locked</span> : null}
                </div>) : (<div role="cell" className="flex items-center gap-2.5">
                  <Slider min={min} max={max} step={MONEY_STEP} value={v.target} onChange={(x) => onTarget(v.unitId, snapToRange(x, min, max))} aria-label={`Monthly budget for ${v.name}`} aria-valuetext={moneyExact(v.target, currency)} className="min-w-0 flex-1"/>
                  <MoneyInput value={v.target} currency={currency} onCommit={(x) => onTarget(v.unitId, x)} ariaLabel={`Monthly budget for ${v.name}, exact amount`} edited={v.edited} title={v.edited ? `Saved: ${moneyExact(v.savedTarget, currency)}` : "Type an amount (rounds to $50)"}/>
                  <LockToggle locked={v.lockedNow} name={v.name} onChange={(x) => onLock(v.unitId, x)}/>
                </div>)}
              <span role="cell" className="text-right text-muted">
                {money(v.mtdSpend, currency)}
              </span>
              <span role="cell" className="text-right">
                {money(v.projected, currency)}
              </span>
              <div role="cell">
                <Meter value={v.spentShare} projected={v.projectedShare} marker={marker} tone={over ? "warn" : "accent"} height={8} label={`${v.name}: ${Math.round(v.spentShare * 100)}% spent, ${Math.round(v.paceRatio * 100)}% projected`}/>
              </div>
              <span role="cell" className="flex justify-end">
                <PaceBadge status={v.status}/>
              </span>
              <div role="cell" className="flex flex-col items-end gap-0.5">
                <Tooltip content={v.recommendationNote}>
                  <span tabIndex={0} className="cursor-help font-semibold outline-none">
                    {perDay(v.recommendedDaily, currency)}
                  </span>
                </Tooltip>
                <span className="font-mono text-micro text-faint">{v.dailyBudget === null ? "no daily budget" : `now ${moneyExact(v.dailyBudget, currency)}`}</span>
              </div>
            </div>
            {needsNote(v, report) ? (<div role="cell" aria-colspan={7} className="-mt-1.5 flex gap-2 px-[22px] pb-3 text-xs leading-relaxed text-muted-3">
                <span aria-hidden className={over ? "text-warn" : "text-faint"}>
                  {over ? "▲" : "●"}
                </span>
                <span>{v.recommendationNote}</span>
              </div>) : null}
          </div>);
        })}
    </div>);
}
export function CapsNote({ className }: {
    className?: string;
}) {
    return (<p className={cn("m-0 text-xs leading-relaxed text-muted-3", className)}>
      Google Ads budgets are daily. On any single day Google may spend up to {DAILY_OVERDELIVERY_FACTOR}× the daily budget, but it never charges more than {MONTHLY_CAP_FACTOR}× the daily budget in a calendar month — so a
      month&apos;s spend lands near daily × days. Monthly targets here are planning amounts; the recommendation is the daily budget that lands on the target over the remaining days.
    </p>);
}
