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
export function ScenariosCard({ month, strategy, constraints, currency, curveSource = "auto" }: {
    month: string;
    strategy: Strategy;
    constraints: OptimizeRequest["constraints"];
    currency: string;
    curveSource?: CurveSourceMode;
}) {
    const [objective, setObjective] = useState<Objective>("conversions");
    const body = useMemo(() => ({ month, period: "monthly" as const, objective, strategy, constraints, roundTo: 50, curveSource }), [month, objective, strategy, constraints, curveSource]);
    const q = useScenarios(body);
    const reduced = useMemo(() => prefersReducedMotion(), []);
    const points = useMemo(() => q.data?.points ?? [], [q.data]);
    const base = points.find((p) => Math.abs(p.pct) < 1e-9);
    const unit = objective === "conversions" ? "conv." : "value";
    const build = (t: ChartTokens) => scenarioOption(t, points, objective, currency, reduced);
    const columns: Column<ScenarioPoint>[] = [
        { key: "pct", header: "Change", width: "minmax(90px,0.8fr)", cell: (p) => <span className={Math.abs(p.pct) < 1e-9 ? "font-semibold text-accent" : undefined}>{scenarioLabel(p.pct)}</span> },
        { key: "total", header: "Monthly budget", align: "right", width: "minmax(110px,1fr)", cell: (p) => money(p.total, currency) },
        { key: "expected", header: `Expected ${unit}`, align: "right", width: "minmax(110px,1fr)", cell: (p) => formatOutcome(objective, p.expected, currency) },
        { key: "vs", header: "vs current", align: "right", width: "minmax(90px,0.8fr)", cell: (p) => <span className="text-muted">{base && p !== base ? formatDelta(base.expected > 0 ? p.expected / base.expected - 1 : null) : "—"}</span> },
        { key: "marginal", header: objective === "conversions" ? "Marginal CPA" : "Marginal ROAS", align: "right", width: "minmax(110px,1fr)", cell: (p) => marginalLabel(objective, p.marginalCost, currency) },
    ];
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Budget scenarios" sub={`−30% … +50% of the ${monthName(month)} total · ${STRATEGY_LABELS[strategy]}`} action={<Segmented ariaLabel="Scenario objective" variant="sans" value={objective} onChange={setObjective} options={(["conversions", "conv_value"] as const).map((o) => ({ value: o, label: OBJECTIVE_LABELS[o] }))}/>}/>
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.refetch()}/> : null}
      {!q.data && !q.error ? <Skeleton height={400}/> : null}
      {q.data ? (<Refetching active={q.isPlaceholderData || q.isFetching} className="flex flex-col gap-4">
          <div className="relative h-[240px]">
            <EChart className="absolute inset-0" build={build} deps={[points, objective, currency]} ariaLabel={`Expected ${OBJECTIVE_LABELS[objective].toLowerCase()} for monthly budgets from ${money(points[0]?.total, currency)} to ${money(points[points.length - 1]?.total, currency)}`}/>
          </div>
          <DataTable rows={points} columns={columns} rowKey={(p) => String(p.pct)} ariaLabel="Budget scenarios" density="compact" minWidth={520} rowClassName={(p) => (Math.abs(p.pct) < 1e-9 ? "bg-teal/4" : undefined)}/>
          {q.data.warnings.map((w) => (<p key={w} className="m-0 flex gap-2 text-xs leading-relaxed text-muted-3">
              <span aria-hidden className="text-warn">
                ▲
              </span>
              {w}
            </p>))}
          <p className="m-0 text-xs leading-relaxed text-muted-3">
            {objective === "conversions" ? "Marginal CPA: what each extra conversion costs moving up from the previous budget level." : "Marginal ROAS: the return on each extra dollar moving up from the previous budget level."}
          </p>
        </Refetching>) : null}
    </Card>);
}
