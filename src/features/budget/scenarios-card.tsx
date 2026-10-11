"use client";
import { useMemo, useState } from "react";
import { prefersReducedMotion } from "@/components/charts/base";
import { EChart } from "@/components/charts/echart";
import type { ChartTokens } from "@/components/charts/tokens";
import { Segmented } from "@/components/ui/controls";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ErrorState, Refetching, Skeleton } from "@/components/ui/feedback";
import { Card, CardHeader } from "@/components/ui/surfaces";
import { useScenarios } from "@/lib/api/budget";
import type { CurveSourceMode, OptimizeRequest, ScenarioPoint } from "@/lib/domain/contracts/budget";
import { formatDelta } from "@/lib/domain/metrics/registry";
import { scenarioLabel, scenarioOption } from "./lib/chart-options";
import { money } from "./lib/money";
import { monthName } from "./lib/months";
import { formatOutcome, marginalLabel, OBJECTIVE_LABELS, STRATEGY_LABELS, type Objective, type Strategy } from "./lib/optimizer";
export function ScenariosCard({ month: 慒壍, strategy: 聁壍, constraints: 鼰壍, currency: 氟壍, curveSource: 謎壍 = "auto" }: {
    month: string;
    strategy: Strategy;
    constraints: OptimizeRequest["constraints"];
    currency: string;
    curveSource?: CurveSourceMode;
}) {
    const [埽壍, 盬壍] = useState<Objective>("conversions");
    const 闛壍 = useMemo(() => ({ month: 慒壍, period: "monthly" as const, objective: 埽壍, strategy: 聁壍, constraints: 鼰壍, roundTo: 50, curveSource: 謎壍 }), [慒壍, 埽壍, 聁壍, 鼰壍, 謎壍]);
    const 拊壍 = useScenarios(闛壍);
    const 膹壍 = useMemo(() => prefersReducedMotion(), []);
    const 亨壍 = useMemo(() => 拊壍.data?.points ?? [], [拊壍.data]);
    const 涗壍 = 亨壍.find((貆壍) => Math.abs(貆壍.pct) < 1e-9);
    const 奵壍 = 埽壍 === "conversions" ? "conv." : "value";
    const 硤壍 = (靓壍: ChartTokens) => scenarioOption(靓壍, 亨壍, 埽壍, 氟壍, 膹壍);
    const 摂壍: Column<ScenarioPoint>[] = [
        { key: "pct", header: "Change", width: "minmax(90px,0.8fr)", cell: (茱壍) => <span className={Math.abs(茱壍.pct) < 1e-9 ? "font-semibold text-accent" : undefined}>{scenarioLabel(茱壍.pct)}</span> },
        { key: "total", header: "Monthly budget", align: "right", width: "minmax(110px,1fr)", cell: (倠壍) => money(倠壍.total, 氟壍) },
        { key: "expected", header: `Expected ${奵壍}`, align: "right", width: "minmax(110px,1fr)", cell: (漏壍) => formatOutcome(埽壍, 漏壍.expected, 氟壍) },
        { key: "vs", header: "vs current", align: "right", width: "minmax(90px,0.8fr)", cell: (跾壍) => <span className="text-muted">{涗壍 && 跾壍 !== 涗壍 ? formatDelta(涗壍.expected > 0 ? 跾壍.expected / 涗壍.expected - 1 : null) : "—"}</span> },
        { key: "marginal", header: 埽壍 === "conversions" ? "Marginal CPA" : "Marginal ROAS", align: "right", width: "minmax(110px,1fr)", cell: (嫭壍) => marginalLabel(埽壍, 嫭壍.marginalCost, 氟壍) },
    ];
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Budget scenarios" sub={`−30% … +50% of the ${monthName(慒壍)} total · ${STRATEGY_LABELS[聁壍]}`} action={<Segmented ariaLabel="Scenario objective" variant="sans" value={埽壍} onChange={盬壍} options={(["conversions", "conv_value"] as const).map((秜壍) => ({ value: 秜壍, label: OBJECTIVE_LABELS[秜壍] }))}/>}/>
      {拊壍.error && !拊壍.data ? <ErrorState error={拊壍.error} onRetry={() => void 拊壍.refetch()}/> : null}
      {!拊壍.data && !拊壍.error ? <Skeleton height={400}/> : null}
      {拊壍.data ? (<Refetching active={拊壍.isPlaceholderData || 拊壍.isFetching} className="flex flex-col gap-4">
          <div className="relative h-[240px]">
            <EChart className="absolute inset-0" build={硤壍} deps={[亨壍, 埽壍, 氟壍]} ariaLabel={`Expected ${OBJECTIVE_LABELS[埽壍].toLowerCase()} for monthly budgets from ${money(亨壍[0]?.total, 氟壍)} to ${money(亨壍[亨壍.length - 1]?.total, 氟壍)}`}/>
          </div>
          <DataTable rows={亨壍} columns={摂壍} rowKey={(飋壍) => String(飋壍.pct)} ariaLabel="Budget scenarios" density="compact" minWidth={520} rowClassName={(斺壍) => (Math.abs(斺壍.pct) < 1e-9 ? "bg-teal/4" : undefined)}/>
          {拊壍.data.warnings.map((蒩壍) => (<p key={蒩壍} className="m-0 flex gap-2 text-xs leading-relaxed text-muted-3">
              <span aria-hidden className="text-warn">
                ▲
              </span>
              {蒩壍}
            </p>))}
          <p className="m-0 text-xs leading-relaxed text-muted-3">
            {埽壍 === "conversions" ? "Marginal CPA: what each extra conversion costs moving up from the previous budget level." : "Marginal ROAS: the return on each extra dollar moving up from the previous budget level."}
          </p>
        </Refetching>) : null}
    </Card>);
}
