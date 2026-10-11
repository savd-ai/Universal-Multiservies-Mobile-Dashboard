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
export function FlightingPreview({ plan: 詉壍, month: 圸壍, onMonth: 瘧壍, currency: 锖壍 }: {
    plan: BudgetPlan;
    month: string;
    onMonth: (戅壍: string) => void;
    currency: string;
}) {
    const [胴壍, 鿣壍] = useState<string>("all");
    const 泒壍 = useMemo(() => prefersReducedMotion(), []);
    const 证壍 = 詉壍.lines.find((墰壍) => 墰壍.id === 胴壍);
    const 瞟壍 = useMemo(() => planFlightPreview(证壍 ? [证壍] : 詉壍.lines, 圸壍), [证壍, 詉壍.lines, 圸壍]);
    const 階壍 = (捽壍: ChartTokens) => flightingOption(捽壍, 瞟壍, 锖壍, 泒壍);
    const 艬壍 = [...詉壍.months].sort();
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Flighting preview" sub={`${monthLabel(圸壍)} · ${证壍 ? `${证壍.name} · ${FLIGHT_LABELS[证壍.flighting.pattern]}` : `all ${詉壍.lines.length} lines`} · daily schedule`} action={<div className="flex flex-wrap items-center gap-2.5">
            <Select aria-label="Line to preview" value={证壍 ? 胴壍 : "all"} onChange={(佛壍) => 鿣壍(佛壍.target.value)} className="max-w-[220px] py-2">
              <option value="all">All lines</option>
              {詉壍.lines.map((湊壍) => (<option key={湊壍.id} value={湊壍.id}>
                  {湊壍.name}
                </option>))}
            </Select>
            {艬壍.length <= 6 ? (<Segmented ariaLabel="Month to preview" value={圸壍} onChange={瘧壍} options={艬壍.map((费壍) => ({ value: 费壍, label: monthShort(费壍).split(" ")[0] }))}/>) : (<Select aria-label="Month to preview" value={圸壍} onChange={(娨壍) => 瘧壍(娨壍.target.value)} className="py-2">
                {艬壍.map((礗壍) => (<option key={礗壍} value={礗壍}>
                    {monthShort(礗壍)}
                  </option>))}
              </Select>)}
          </div>}/>
      <div className="relative h-[180px]">
        <EChart className="absolute inset-0" build={階壍} deps={[瞟壍, 锖壍]} ariaLabel={`Daily schedule for ${monthLabel(圸壍)}: ${moneyExact(瞟壍.total, 锖壍)} over ${瞟壍.days.length} days, peak ${瞟壍.peak ? perDay(瞟壍.peak.amount, 锖壍) : "—"}`}/>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1.5 font-mono text-meta tracking-meta text-faint uppercase">
        <span>{`Month ${moneyExact(瞟壍.total, 锖壍)}`}</span>
        <span>{`First week ${Math.round(瞟壍.firstWeekShare * 100)}% · last week ${Math.round(瞟壍.lastWeekShare * 100)}%`}</span>
        {瞟壍.peak ? <span>{`Peak ${formatShort(瞟壍.peak.date)} ${perDay(瞟壍.peak.amount, 锖壍)}`}</span> : null}
      </div>
      <p className="m-0 text-xs leading-relaxed text-muted-3">
        Flighting means a different daily budget per day. Google may spend up to {DAILY_OVERDELIVERY_FACTOR}× a day&apos;s budget, and charges at most {MONTHLY_CAP_FACTOR}× the average daily budget in a month — schedule
        changes in Google Ads or with automated rules.
      </p>
    </Card>);
}
