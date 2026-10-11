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
export function CumulativeCard({ report: 引壍, total: 縄壍, projected: 鳳壍, currency: 槢壍, currentYear: 裑壍 }: {
    report: PacingReport;
    total: number;
    projected: number;
    currency: string;
    currentYear: string;
}) {
    const 嗀壍 = useMemo(() => prefersReducedMotion(), []);
    const 璯壍 = useMemo(() => cumulativeSeries(引壍, 縄壍, 鳳壍), [引壍, 縄壍, 鳳壍]);
    const 鎞壍 = 引壍.month.slice(0, 4) === 裑壍 ? monthName(引壍.month) : 引壍.monthLabel;
    const 悍壍 = (罼壍: ChartTokens) => cumulativeOption(罼壍, 璯壍, 槢壍, 嗀壍);
    const 鹫壍 = 引壍.elapsedDays;
    const 歚壍 = `Cumulative spend for ${引壍.monthLabel}: ${money(引壍.totals.mtdSpend, 槢壍)} spent in ${鹫壍} of ${引壍.daysInMonth} days, projected ${money(鳳壍, 槢壍)} against a ${money(縄壍, 槢壍)} budget`;
    return (<Card className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-[18px]">
        <span className="flex-1 font-display text-base font-semibold tracking-title">{`Cumulative spend · ${鎞壍}`}</span>
        <LegendKey kind="line" label="Actual"/>
        <LegendKey kind="dashed" label="Projected"/>
        <LegendKey kind="thin" color="var(--faint)" label="Ideal pace"/>
      </div>
      <div className="relative h-[224px]">
        <EChart className="absolute inset-0" build={悍壍} deps={[璯壍, 槢壍]} ariaLabel={歚壍}/>
      </div>
    </Card>);
}
