"use client";
import { useMemo } from "react";
import { prefersReducedMotion } from "@/components/charts/base";
import { EChart } from "@/components/charts/echart";
import type { ChartTokens } from "@/components/charts/tokens";
import { ErrorState, Refetching, Skeleton } from "@/components/ui/feedback";
import { Pill } from "@/components/ui/status";
import { Card, CardHeader, MiniCard } from "@/components/ui/surfaces";
import { useResponseCurves } from "@/lib/api/budget";
import type { CurvesResponse } from "@/lib/domain/contracts/budget";
import { LegendKey } from "./budget-ui";
import { curveOption } from "./lib/chart-options";
import { perDay } from "./lib/money";
import type { Objective } from "./lib/optimizer";
type Curve = CurvesResponse["curves"][number];
const CONFIDENCE: Record<Curve["confidence"], {
    tone: "accent" | "muted" | "warn";
    label: string;
}> = {
    high: { tone: "accent", label: "High confidence" },
    medium: { tone: "muted", label: "Medium confidence" },
    low: { tone: "warn", label: "Low confidence" },
};
function CurveChart({ curve, objective, currentDaily, recommendedDaily, currency }: {
    curve: Curve;
    objective: Objective;
    currentDaily: number | null;
    recommendedDaily: number | null;
    currency: string;
}) {
    const reduced = useMemo(() => prefersReducedMotion(), []);
    return (<div className="relative h-[124px]">
      <EChart className="absolute inset-0" build={(t: ChartTokens) => curveOption(t, curve, objective, currentDaily, recommendedDaily, currency, reduced)} deps={[curve, objective, currentDaily, recommendedDaily, currency]} ariaLabel={`${curve.name}: expected ${objective === "conv_value" ? "conversion value" : "conversions"} per day against daily spend; current ${perDay(currentDaily, currency)}${recommendedDaily ? `, recommended ${perDay(recommendedDaily, currency)}` : ""}`}/>
    </div>);
}
export function ResponseCurvesCard({ objective, current, recommended, currency }: {
    objective: Objective;
    current: Readonly<Record<string, number>>;
    recommended: Readonly<Record<string, number>> | null;
    currency: string;
}) {
    const q = useResponseCurves(objective);
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Response curves" sub={`Expected ${objective === "conv_value" ? "conversion value" : "conversions"} per day vs daily spend · last 60 days`} action={<div className="flex flex-wrap items-center gap-4">
            <LegendKey kind="dot" color="var(--accent)" label="Current"/>
            <LegendKey kind="ring" label="Recommended"/>
            <LegendKey kind="band" label="Observed spend"/>
          </div>}/>
      {q.error && !q.data ? <ErrorState error={q.error} onRetry={() => void q.refetch()}/> : null}
      {!q.data && !q.error ? (<div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
          {[0, 1, 2, 3].map((i) => (<Skeleton key={i} height={196}/>))}
        </div>) : null}
      {q.data ? (<Refetching active={q.isPlaceholderData} className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
          {q.data.curves.map((c) => {
                const conf = CONFIDENCE[c.confidence];
                return (<MiniCard key={c.campaignId} className="flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[13px] font-medium" title={c.name}>
                      {c.name}
                    </span>
                    <span className="font-mono text-micro text-faint">{`b ${c.b.toFixed(2)} · R² ${c.r2.toFixed(2)} · ${c.n} days`}</span>
                  </div>
                  <Pill tone={conf.tone}>{conf.label}</Pill>
                </div>
                <CurveChart curve={c} objective={objective} currentDaily={current[c.campaignId] ?? null} recommendedDaily={recommended?.[c.campaignId] ?? null} currency={currency}/>
              </MiniCard>);
            })}
        </Refetching>) : null}
      <p className="m-0 text-xs leading-relaxed text-muted-3">
        Each curve is a · spend^b fitted on daily data; b below 1 means every extra dollar buys a little less. Outside the shaded range the curve is an extrapolation — treat those expectations as rough.
      </p>
    </Card>);
}
