"use client";
import { useMemo, useState } from "react";
import { prefersReducedMotion } from "@/components/charts/base";
import { EChart } from "@/components/charts/echart";
import type { ChartTokens } from "@/components/charts/tokens";
import { Segmented } from "@/components/ui/controls";
import { Select } from "@/components/ui/inputs";
import { Card, CardHeader } from "@/components/ui/surfaces";
import { DAILY_OVERDELIVERY_FACTOR, MONTHLY_CAP_FACTOR, type BudgetPlan } from "@/lib/domain/contracts/budget";
import { formatShort } from "@/lib/domain/dates";
import { flightingOption } from "./lib/chart-options";
import { FLIGHT_LABELS, planFlightPreview } from "./lib/flighting";
import { moneyExact, perDay } from "./lib/money";
import { monthLabel, monthShort } from "./lib/months";
export function FlightingPreview({ plan, month, onMonth, currency }: {
    plan: BudgetPlan;
    month: string;
    onMonth: (m: string) => void;
    currency: string;
}) {
    const [lineId, setLineId] = useState<string>("all");
    const reduced = useMemo(() => prefersReducedMotion(), []);
    const line = plan.lines.find((l) => l.id === lineId);
    const preview = useMemo(() => planFlightPreview(line ? [line] : plan.lines, month), [line, plan.lines, month]);
    const build = (t: ChartTokens) => flightingOption(t, preview, currency, reduced);
    const months = [...plan.months].sort();
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Flighting preview" sub={`${monthLabel(month)} · ${line ? `${line.name} · ${FLIGHT_LABELS[line.flighting.pattern]}` : `all ${plan.lines.length} lines`} · daily schedule`} action={<div className="flex flex-wrap items-center gap-2.5">
            <Select aria-label="Line to preview" value={line ? lineId : "all"} onChange={(e) => setLineId(e.target.value)} className="max-w-[220px] py-2">
              <option value="all">All lines</option>
              {plan.lines.map((l) => (<option key={l.id} value={l.id}>
                  {l.name}
                </option>))}
            </Select>
            {months.length <= 6 ? (<Segmented ariaLabel="Month to preview" value={month} onChange={onMonth} options={months.map((m) => ({ value: m, label: monthShort(m).split(" ")[0] }))}/>) : (<Select aria-label="Month to preview" value={month} onChange={(e) => onMonth(e.target.value)} className="py-2">
                {months.map((m) => (<option key={m} value={m}>
                    {monthShort(m)}
                  </option>))}
              </Select>)}
          </div>}/>
      <div className="relative h-[180px]">
        <EChart className="absolute inset-0" build={build} deps={[preview, currency]} ariaLabel={`Daily schedule for ${monthLabel(month)}: ${moneyExact(preview.total, currency)} over ${preview.days.length} days, peak ${preview.peak ? perDay(preview.peak.amount, currency) : "—"}`}/>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1.5 font-mono text-meta tracking-meta text-faint uppercase">
        <span>{`Month ${moneyExact(preview.total, currency)}`}</span>
        <span>{`First week ${Math.round(preview.firstWeekShare * 100)}% · last week ${Math.round(preview.lastWeekShare * 100)}%`}</span>
        {preview.peak ? <span>{`Peak ${formatShort(preview.peak.date)} ${perDay(preview.peak.amount, currency)}`}</span> : null}
      </div>
      <p className="m-0 text-xs leading-relaxed text-muted-3">
        Flighting means a different daily budget per day. Google may spend up to {DAILY_OVERDELIVERY_FACTOR}× a day&apos;s budget, and charges at most {MONTHLY_CAP_FACTOR}× the average daily budget in a month — schedule
        changes in Google Ads or with automated rules.
      </p>
    </Card>);
}
