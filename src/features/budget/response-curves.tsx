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
const 酳壍: Record<Curve["confidence"], {
    tone: "accent" | "muted" | "warn";
    label: string;
}> = {
    high: { tone: "accent", label: "High confidence" },
    medium: { tone: "muted", label: "Medium confidence" },
    low: { tone: "warn", label: "Low confidence" },
};
function Cmp18({ curve: 絑壍, objective: 鱀壍, currentDaily: 椯壍, recommendedDaily: 蠞壍, currency: 唍壍 }: {
    curve: Curve;
    objective: Objective;
    currentDaily: number | null;
    recommendedDaily: number | null;
    currency: string;
}) {
    const 珼壍 = useMemo(() => prefersReducedMotion(), []);
    return (<div className="relative h-[124px]">
      <EChart className="absolute inset-0" build={(鋫壍: ChartTokens) => curveOption(鋫壍, 絑壍, 鱀壍, 椯壍, 蠞壍, 唍壍, 珼壍)} deps={[絑壍, 鱀壍, 椯壍, 蠞壍, 唍壍]} ariaLabel={`${絑壍.name}: expected ${鱀壍 === "conv_value" ? "conversion value" : "conversions"} per day against daily spend; current ${perDay(椯壍, 唍壍)}${蠞壍 ? `, recommended ${perDay(蠞壍, 唍壍)}` : ""}`}/>
    </div>);
}
export function ResponseCurvesCard({ objective: 忚壍, current: 绉壍, recommended: 鶸壍, currency: 檧壍 }: {
    objective: Objective;
    current: Readonly<Record<string, number>>;
    recommended: Readonly<Record<string, number>> | null;
    currency: string;
}) {
    const 視壍 = useResponseCurves(忚壍);
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Response curves" sub={`Expected ${忚壍 === "conv_value" ? "conversion value" : "conversions"} per day vs daily spend · last 60 days`} action={<div className="flex flex-wrap items-center gap-4">
            <LegendKey kind="dot" color="var(--accent)" label="Current"/>
            <LegendKey kind="ring" label="Recommended"/>
            <LegendKey kind="band" label="Observed spend"/>
          </div>}/>
      {視壍.error && !視壍.data ? <ErrorState error={視壍.error} onRetry={() => void 視壍.refetch()}/> : null}
      {!視壍.data && !視壍.error ? (<div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
          {[0, 1, 2, 3].map((嚅壍) => (<Skeleton key={嚅壍} height={196}/>))}
        </div>) : null}
      {視壍.data ? (<Refetching active={視壍.isPlaceholderData} className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
          {視壍.data.curves.map((畴壍) => {
                const 鑣壍 = 酳壍[畴壍.confidence];
                return (<MiniCard key={畴壍.campaignId} className="flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[13px] font-medium" title={畴壍.name}>
                      {畴壍.name}
                    </span>
                    <span className="font-mono text-micro text-faint">{`b ${畴壍.b.toFixed(2)} · R² ${畴壍.r2.toFixed(2)} · ${畴壍.n} days`}</span>
                  </div>
                  <Pill tone={鑣壍.tone}>{鑣壍.label}</Pill>
                </div>
                <Cmp18 curve={畴壍} objective={忚壍} currentDaily={绉壍[畴壍.campaignId] ?? null} recommendedDaily={鶸壍?.[畴壍.campaignId] ?? null} currency={檧壍}/>
              </MiniCard>);
            })}
        </Refetching>) : null}
      <p className="m-0 text-xs leading-relaxed text-muted-3">
        Each curve is a · spend^b fitted on daily data; b below 1 means every extra dollar buys a little less. Outside the shaded range the curve is an extrapolation — treat those expectations as rough.
      </p>
    </Card>);
}
