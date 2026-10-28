"use client";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { prefersReducedMotion } from "@/components/charts/base";
import { EChart } from "@/components/charts/echart";
import { colorFor } from "@/components/charts/palette";
import { useChartTokens, type ChartTokens } from "@/components/charts/tokens";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Segmented } from "@/components/ui/controls";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ErrorState, Refetching, Skeleton } from "@/components/ui/feedback";
import { MiddleTruncate } from "@/components/ui/middle-truncate";
import { Pill } from "@/components/ui/status";
import { Card, CardHeader, MetaStat, MiniCard } from "@/components/ui/surfaces";
import { useGoogleEstimates } from "@/lib/api/budget";
import { agreementLine, chooseBudgetEstimate, ESTIMATE_POLICY, SIMULATION_LABELS, simulatedRange } from "@/lib/domain/budget/google";
import type { BudgetEstimateDecision, EstimateCampaignView, EstimatePolicyRow, EstimateSource, GoogleEstimatesResponse, RecommendationView, SimulationView } from "@/lib/domain/contracts/estimates";
import { formatShort } from "@/lib/domain/dates";
import { formatDelta } from "@/lib/domain/metrics/registry";
import { LegendKey, MoneyInput } from "./budget-ui";
import { simulatorOption } from "./lib/chart-options";
import { money, perDay } from "./lib/money";
import { formatOutcome, OBJECTIVE_LABELS, type Objective } from "./lib/optimizer";
import { availabilityLabel, defaultCampaign, keyOfType, pointRows, settingLabel, SIMULATION_KEYS, weeklyDelta, weeklyImpactLine, type PointRow, type SimulationKey } from "./lib/simulators";
const OBJECTIVES = ["conv_value", "conversions"] as const;
const SOURCE_LABEL: Record<EstimateSource, string> = { google_simulator: "Google", model: "Our model" };
const WHAT_IF_STEP = 5;
function SourcePill({ source }: {
    source: EstimateSource;
}) {
    return <Pill tone={source === "google_simulator" ? "accent" : "muted"}>{SOURCE_LABEL[source]}</Pill>;
}
function Warnings({ items }: {
    items: readonly string[];
}) {
    if (!items.length)
        return null;
    return (<ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-xs leading-relaxed text-muted-3">
      {items.map((w) => (<li key={w} className="flex gap-2">
          <span aria-hidden className="text-warn">
            ▲
          </span>
          {w}
        </li>))}
    </ul>);
}
function PolicyCard({ data }: {
    data: GoogleEstimatesResponse | undefined;
}) {
    const columns: Column<EstimatePolicyRow>[] = [
        { key: "question", header: "Question", width: "minmax(190px,1.1fr)", cell: (r) => <span className="font-medium">{r.question}</span> },
        {
            key: "lead",
            header: "Leads",
            width: "minmax(220px,1.2fr)",
            cell: (r) => (<span className="flex flex-col items-start gap-1.5">
          <SourcePill source={r.lead}/>
          <span>{r.leadLabel}</span>
        </span>),
        },
        { key: "why", header: "Why", width: "minmax(260px,1.7fr)", cell: (r) => <span className="text-muted-3">{r.why}</span> },
    ];
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Google's simulators and our model" sub="Which estimate answers which planning question"/>
      <p className="m-0 max-w-[880px] text-[13px] leading-relaxed text-muted">
        Google Ads has its own forecasting tools. Performance Planner isn&apos;t available through the API, so it can&apos;t appear here. The budget and target simulators are read-only reports that replay a recent week of auctions at other settings. They answer “what if this campaign&apos;s budget or target were different?” better than a model built from spend history. Our models cover what they don&apos;t — month-end pacing, the 30-day trend, shared budgets and moving money between campaigns.
      </p>
      {data?.blank ? (<div className="rounded-mini border border-dashed border-warn/50 px-3.5 py-2.5 text-xs text-muted-3" role="note">
          {data.blank.note}
        </div>) : null}
      <Warnings items={data?.warnings ?? []}/>
      <DataTable rows={data?.policy ?? ESTIMATE_POLICY} columns={columns} rowKey={(r) => r.id} ariaLabel="Which estimate leads for each planning question" density="compact" minWidth={720}/>
    </Card>);
}
function CampaignPicker({ campaigns, selected, onPick }: {
    campaigns: readonly EstimateCampaignView[];
    selected: string | null;
    onPick: (id: string) => void;
}) {
    return (<div role="group" aria-label="Campaigns" className="flex flex-col gap-1">
      {campaigns.map((c) => {
            const on = c.campaignId === selected;
            return (<button key={c.campaignId} type="button" aria-pressed={on} onClick={() => onPick(c.campaignId)} className={cn("flex flex-col items-start gap-0.5 rounded-mini border px-3 py-2.5 text-left transition-colors", on ? "border-accent bg-teal-t" : "border-transparent hover:bg-fill")}>
            <MiddleTruncate text={c.name} className="w-full text-[13px] font-medium"/>
            <span className={cn("font-mono text-micro tracking-label uppercase", c.simulations.length ? "text-accent" : "text-faint")}>{`${c.type} · ${availabilityLabel(c)}`}</span>
          </button>);
        })}
    </div>);
}
function SimulatorChart({ campaign, sim, objective, whatIf, currency }: {
    campaign: EstimateCampaignView;
    sim: SimulationView;
    objective: Objective;
    whatIf: number | null;
    currency: string;
}) {
    const reduced = useMemo(() => prefersReducedMotion(), []);
    const modelCurve = sim.type === "BUDGET" ? campaign.modelCurve : null;
    const range = simulatedRange(sim.perDay);
    const outcome = objective === "conversions" ? "conversions" : "conversion value";
    const ariaLabel = `${campaign.name}: Google's ${SIMULATION_LABELS[sim.type].toLowerCase()} simulation${modelCurve ? " and our model" : ""}, ${outcome} per day from ${settingLabel(sim.type, range?.[0], currency)} to ${settingLabel(sim.type, range?.[1], currency)}; current ${settingLabel(sim.type, sim.current, currency)}`;
    return (<div className="relative h-[260px]">
      <EChart className="absolute inset-0" build={(t: ChartTokens) => simulatorOption(t, { type: sim.type, objective, points: sim.perDay, modelCurve, current: sim.current, whatIf, currency }, reduced)} deps={[sim, objective, whatIf, currency, modelCurve]} ariaLabel={ariaLabel}/>
    </div>);
}
function PointsTable({ sim, objective, currency }: {
    sim: SimulationView;
    objective: Objective;
    currency: string;
}) {
    const rows = useMemo(() => pointRows(sim), [sim]);
    const target = sim.type !== "BUDGET";
    const fmt = (v: number | null) => (v === null ? "—" : money(v, currency, { compact: false }));
    const columns: Column<PointRow>[] = [
        {
            key: "value",
            header: sim.type === "BUDGET" ? "Budget / day" : SIMULATION_LABELS[sim.type],
            width: "minmax(120px,1.1fr)",
            cell: (r) => (<span className={cn("flex items-center gap-2", r.current && "font-semibold")}>
          {settingLabel(sim.type, r.value, currency)}
          {r.current ? <Pill tone="accent">Current</Pill> : null}
        </span>),
        },
        ...(target ? [{ key: "required", header: "Needs budget", align: "right" as const, width: "minmax(100px,1fr)", cell: (r: PointRow) => <span className="text-muted">{r.requiredBudget === null ? "—" : perDay(r.requiredBudget, currency)}</span> }] : []),
        { key: "cost", header: "Cost / day", align: "right", width: "minmax(90px,1fr)", cell: (r) => fmt(r.cost) },
        { key: "conversions", header: "Conv. / day", align: "right", width: "minmax(90px,0.9fr)", cell: (r) => <span className={objective === "conversions" ? "font-semibold" : undefined}>{formatOutcome("conversions", r.conversions, currency)}</span> },
        { key: "cpa", header: "CPA", align: "right", width: "minmax(80px,0.8fr)", cell: (r) => <span className="text-muted">{fmt(r.cpa)}</span> },
        { key: "value_day", header: "Value / day", align: "right", width: "minmax(90px,1fr)", cell: (r) => <span className={objective === "conv_value" ? "font-semibold" : undefined}>{fmt(r.convValue)}</span> },
        { key: "roas", header: "ROAS", align: "right", width: "minmax(70px,0.7fr)", cell: (r) => <span className="text-muted">{r.roas === null ? "—" : `${r.roas.toFixed(2)}x`}</span> },
    ];
    return <DataTable rows={rows} columns={columns} rowKey={(r) => String(r.value)} ariaLabel={`Google's ${SIMULATION_LABELS[sim.type].toLowerCase()} simulation, per day`} density="compact" minWidth={target ? 720 : 620} rowClassName={(r) => (r.current ? "bg-teal/4" : undefined)}/>;
}
function DecisionSummary({ decision, currency }: {
    decision: BudgetEstimateDecision;
    currency: string;
}) {
    const agreement = agreementLine(decision.disagreementPct);
    const outcome = (v: number | null) => (v === null ? "—" : `${formatOutcome(decision.objective, v, currency)}/day`);
    return (<div className="flex flex-col gap-2.5 border-t border-tone/8 pt-4">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-micro tracking-label text-faint uppercase">Leads</span>
          <SourcePill source={decision.lead}/>
        </div>
        <MetaStat label={`Google · ${perDay(decision.proposedDaily, currency)}`} value={outcome(decision.googleOutcome)}/>
        <MetaStat label="Our model" value={outcome(decision.model)}/>
        <MetaStat label="Model vs Google" value={formatDelta(decision.disagreementPct)}/>
      </div>
      <p className="m-0 text-[13px] text-muted">{decision.reason}</p>
      {agreement ? <p className="m-0 text-[13px] font-medium">{agreement}.</p> : null}
    </div>);
}
function CampaignDetail({ campaign, data, simKey, onSimKey }: {
    campaign: EstimateCampaignView;
    data: GoogleEstimatesResponse;
    simKey: SimulationKey | null;
    onSimKey: (k: SimulationKey) => void;
}) {
    const tokens = useChartTokens();
    const currency = data.currency;
    const objective = data.objective;
    const [whatIf, setWhatIf] = useState<number | null>(null);
    const keys = campaign.simulations.map((s) => keyOfType(s.type));
    const key = simKey && keys.includes(simKey) ? simKey : (keys[0] ?? null);
    const sim = campaign.simulations.find((s) => keyOfType(s.type) === key) ?? null;
    const budgetSim = campaign.simulations.find((s) => s.type === "BUDGET") ?? null;
    const decision = useMemo(() => whatIf === null
        ? campaign.decision
        : chooseBudgetEstimate({ campaign, simulation: budgetSim, modelCurve: campaign.modelCurve, proposedDaily: whatIf, dataThrough: data.dataThrough, objective, currency }), [whatIf, campaign, budgetSim, data.dataThrough, objective, currency]);
    const googleColor = colorFor("estimate_source", "google_simulator", 1, tokens);
    const modelColor = colorFor("estimate_source", "model", 0, tokens);
    return (<div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-display text-[15px] font-semibold tracking-title">{campaign.name}</span>
          <span className="font-mono text-micro tracking-label text-faint uppercase">
            {[campaign.type, campaign.dailyBudget ? `Budget ${perDay(campaign.dailyBudget, currency)}` : "No daily budget", campaign.targetCpa ? `tCPA ${settingLabel("TARGET_CPA", campaign.targetCpa, currency)}` : null, campaign.targetRoas ? `tROAS ${settingLabel("TARGET_ROAS", campaign.targetRoas, currency)}` : null].filter(Boolean).join(" · ")}
          </span>
        </div>
        {keys.length > 1 ? <Segmented ariaLabel="Simulation" variant="sans" value={key as SimulationKey} onChange={onSimKey} options={keys.map((k) => ({ value: k, label: SIMULATION_LABELS[campaign.simulations.find((s) => keyOfType(s.type) === k)?.type ?? "BUDGET"] }))}/> : null}
        <a href={campaign.deepLink} target="_blank" rel="noreferrer noopener" className="text-xs whitespace-nowrap">
          Open in Google Ads ↗
        </a>
      </div>

      {!sim ? (<MiniCard className="flex flex-col gap-2 text-[13px]">
          <span className="font-medium">No simulations from Google for this campaign</span>
          <span className="text-muted-3">{campaign.note ?? "Google returned no simulations for this campaign."}</span>
          {campaign.decision?.model !== null && campaign.decision?.model !== undefined && campaign.dailyBudget ? (<span className="text-muted">{`Our model: ${formatOutcome(objective, campaign.decision.model, currency)} ${objective === "conversions" ? "conversions" : "value"} a day at ${perDay(campaign.dailyBudget, currency)}.`}</span>) : null}
          {campaign.type === "PMax" ? <span className="text-xs text-muted-3">To cross-check a Performance Max budget with Google, use Performance Planner in the Google Ads interface (it isn&apos;t in the API).</span> : null}
        </MiniCard>) : (<>
          {campaign.note && !budgetSim ? <p className="m-0 text-xs text-muted-3">{`Budget what-if: ${campaign.note}`}</p> : null}
          <div className="flex flex-wrap items-center gap-[18px]">
            <LegendKey kind="dot" color={googleColor} label={`Google simulator · ${formatShort(sim.start)} – ${formatShort(sim.end)}`}/>
            {sim.type === "BUDGET" && campaign.modelCurve ? <LegendKey kind="dashed" color={modelColor} label="Our model · last 60 days"/> : null}
            <LegendKey kind="thin" color="var(--faint)" label="Current setting"/>
            {sim.stale ? <Pill tone="warn">Stale · ended {formatShort(sim.end)}</Pill> : null}
          </div>
          <SimulatorChart campaign={campaign} sim={sim} objective={objective} whatIf={sim.type === "BUDGET" ? whatIf : null} currency={currency}/>
          {sim.type === "BUDGET" ? (<>
              <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
                <label htmlFor={`whatif-${campaign.campaignId}`}>Try a daily budget</label>
                <MoneyInput id={`whatif-${campaign.campaignId}`} value={whatIf ?? campaign.dailyBudget ?? 0} currency={currency} step={WHAT_IF_STEP} onCommit={(v) => setWhatIf(v > 0 ? v : null)} ariaLabel={`What-if daily budget for ${campaign.name}`} className="w-[104px] rounded-mini border-line bg-input px-3 py-2 text-left" edited={whatIf !== null}/>
                {whatIf !== null ? (<Button variant="link" className="text-xs" onClick={() => setWhatIf(null)}>
                    Back to the current budget
                  </Button>) : null}
              </div>
              {decision ? <DecisionSummary decision={decision} currency={currency}/> : null}
            </>) : (<p className="m-0 border-t border-tone/8 pt-4 text-[13px] text-muted">
              We don&apos;t model bid targets, so Google&apos;s target simulator is the estimate here. Each point assumes the daily budget is at least what it needs.
            </p>)}
          <PointsTable sim={sim} objective={objective} currency={currency}/>
          <p className="m-0 text-xs leading-relaxed text-muted-3">
            {`Google's points replay ${formatShort(sim.start)} – ${formatShort(sim.end)}: each is that window's total ÷ ${sim.days} days, so it describes the recent past, not a forecast.`}
            {sim.type === "BUDGET" ? " Our model is a · spend^b fitted on the last 60 days and assumes the budget gets spent — where Google says extra budget won't be spent, the two part ways." : ""}
          </p>
        </>)}
    </div>);
}
function WhatIfCard({ data, objective, onObjective }: {
    data: GoogleEstimatesResponse;
    objective: Objective;
    onObjective: (o: Objective) => void;
}) {
    const [picked, setPicked] = useQueryState("sim", parseAsString.withOptions({ history: "replace", scroll: false }));
    const [simKey, setSimKey] = useQueryState("simtype", parseAsStringLiteral(SIMULATION_KEYS).withOptions({ history: "replace", scroll: false }));
    const campaign = data.campaigns.find((c) => c.campaignId === picked) ?? defaultCampaign(data.campaigns);
    return (<Card className="flex flex-col gap-5">
      <CardHeader title="Campaign what-if" sub="Google's simulated points vs our model · per day" action={<Segmented ariaLabel="Outcome" variant="sans" value={objective} onChange={onObjective} options={(["conversions", "conv_value"] as const).map((o) => ({ value: o, label: OBJECTIVE_LABELS[o] }))}/>}/>
      {!data.campaigns.length ? (<p className="m-0 text-[13px] text-muted-3">No campaigns in this account yet.</p>) : (<div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <CampaignPicker campaigns={data.campaigns} selected={campaign?.campaignId ?? null} onPick={(id) => {
                void setPicked(id);
                void setSimKey(null);
            }}/>
          {campaign ? <CampaignDetail key={campaign.campaignId} campaign={campaign} data={data} simKey={simKey} onSimKey={(k) => void setSimKey(k)}/> : null}
        </div>)}
    </Card>);
}
function RecommendationRow({ rec, currency }: {
    rec: RecommendationView;
    currency: string;
}) {
    const impact = weeklyImpactLine(weeklyDelta(rec.impact), currency);
    const liveDiffers = rec.liveBudget !== null && rec.currentBudget !== null && Math.abs(rec.liveBudget - rec.currentBudget) >= 0.01;
    return (<MiniCard className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <MiddleTruncate text={rec.campaignName ?? `Budget ${rec.budgetId ?? rec.id}`} className="text-[13px] font-medium"/>
          <span className="font-mono text-micro tracking-label text-faint uppercase">{[rec.campaignType, "Campaign budget", liveDiffers ? `Now ${perDay(rec.liveBudget, currency)}` : null].filter(Boolean).join(" · ")}</span>
        </div>
        <div className="flex items-baseline gap-2 tabular">
          <span className="text-[13px] text-muted">{perDay(rec.currentBudget, currency)}</span>
          <span aria-hidden className="text-faint">
            →
          </span>
          <span className="font-display text-[17px] font-semibold text-accent">{perDay(rec.recommendedBudget, currency)}</span>
        </div>
      </div>
      <span className="text-xs text-muted-3">{impact ? `Google's estimate per week: ${impact}` : "Google didn't include an impact estimate."}</span>
      {rec.options.length > 1 ? (<div className="flex flex-wrap items-center gap-2" aria-label="Budget options">
          <span className="label-mono">Options</span>
          {rec.options.map((o) => {
                const d = weeklyDelta(o.impact);
                return (<span key={o.budget} className={cn("rounded-pill border px-2.5 py-1 font-mono text-micro tabular", o.budget === rec.recommendedBudget ? "border-accent text-fg" : "border-line text-muted")}>
                {`${perDay(o.budget, currency)}${d?.conversions !== null && d?.conversions !== undefined ? ` · ${d.conversions >= 0 ? "+" : "−"}${Math.abs(d.conversions).toFixed(Math.abs(d.conversions) >= 100 ? 0 : 1)} conv./wk` : ""}`}
              </span>);
            })}
        </div>) : null}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {rec.deepLink ? (<a href={rec.deepLink} target="_blank" rel="noreferrer noopener" className="text-xs whitespace-nowrap">
            Open in Google Ads ↗
          </a>) : null}
        {rec.applied ? <Pill tone="accent">{`Budget at ${perDay(rec.liveBudget, currency)}`}</Pill> : null}
      </div>
    </MiniCard>);
}
function RecommendationsCard({ data }: {
    data: GoogleEstimatesResponse;
}) {
    const live = data.mode === "live";
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Google's budget recommendations" sub={live ? "Read from Google Ads · apply them in Google Ads" : data.blank?.reason.startsWith("Demo data") ? "Demo data · generated sample recommendations" : "No live data · recommendations appear once Google Ads is connected"}/>
      {data.recommendations.length ? (data.recommendations.map((r) => <RecommendationRow key={r.id} rec={r} currency={data.currency}/>)) : (<p className="m-0 text-[13px] text-muted-3">Google has no budget recommendations for this account right now.</p>)}
      <p className="m-0 text-xs leading-relaxed text-muted-3">Recommendations are Google&apos;s: this dashboard only reads them. Applying or dismissing one happens in Google Ads.</p>
    </Card>);
}
export function SimulatorsTab() {
    const [objective, setObjective] = useQueryState("objective", parseAsStringLiteral(OBJECTIVES).withDefault("conv_value").withOptions({ history: "replace", scroll: false }));
    const q = useGoogleEstimates(objective);
    const data = q.data;
    return (<div className="flex flex-col gap-6">
      <PolicyCard data={data}/>
      {q.error && !data ? <ErrorState error={q.error} onRetry={() => void q.refetch()}/> : null}
      {!data && !q.error ? <Skeleton height={460} className="rounded-card"/> : null}
      {data ? (<Refetching active={q.isPlaceholderData} className="flex flex-col gap-6">
          <WhatIfCard data={data} objective={objective} onObjective={(o) => void setObjective(o)}/>
          <RecommendationsCard data={data}/>
        </Refetching>) : null}
    </div>);
}
