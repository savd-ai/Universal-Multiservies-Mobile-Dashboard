"use client";
import { useMemo } from "react";
import { prefersReducedMotion } from "@/components/charts/base";
import { EChart } from "@/components/charts/echart";
import type { ChartTokens } from "@/components/charts/tokens";
import { Card } from "@/components/ui/surfaces";
import type { PacingReport } from "@/lib/domain/contracts/budget";
import { LegendKey } from "./budget-ui";
import { cumulativeOption } from "./lib/chart-options";
import { money } from "./lib/money";
import { monthName } from "./lib/months";
import { cumulativeSeries } from "./lib/pacing";
export function CumulativeCard({ report, total, projected, currency, currentYear }: {
    report: PacingReport;
    total: number;
    projected: number;
    currency: string;
    currentYear: string;
}) {
    const reduced = useMemo(() => prefersReducedMotion(), []);
    const s = useMemo(() => cumulativeSeries(report, total, projected), [report, total, projected]);
    const title = report.month.slice(0, 4) === currentYear ? monthName(report.month) : report.monthLabel;
    const build = (t: ChartTokens) => cumulativeOption(t, s, currency, reduced);
    const elapsed = report.elapsedDays;
    const aria = `Cumulative spend for ${report.monthLabel}: ${money(report.totals.mtdSpend, currency)} spent in ${elapsed} of ${report.daysInMonth} days, projected ${money(projected, currency)} against a ${money(total, currency)} budget`;
    return (<Card className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-[18px]">
        <span className="flex-1 font-display text-base font-semibold tracking-title">{`Cumulative spend · ${title}`}</span>
        <LegendKey kind="line" label="Actual"/>
        <LegendKey kind="dashed" label="Projected"/>
        <LegendKey kind="thin" color="var(--faint)" label="Ideal pace"/>
      </div>
      <div className="relative h-[224px]">
        <EChart className="absolute inset-0" build={build} deps={[s, currency]} ariaLabel={aria}/>
      </div>
    </Card>);
}
