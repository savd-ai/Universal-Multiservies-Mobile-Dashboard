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
const 冘壍 = ["conv_value", "conversions"] as const;
const 炇壍: Record<EstimateSource, string> = { google_simulator: "Google", model: "Our model" };
const 轶壍 = 5;
function 履壍({ source: 答壍 }: {
    source: EstimateSource;
}) {
    return <Pill tone={答壍 === "google_simulator" ? "accent" : "muted"}>{炇壍[答壍]}</Pill>;
}
function 驃壍({ items: 朲壍 }: {
    items: readonly string[];
}) {
    if (!朲壍.length)
        return null;
    return (<ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-xs leading-relaxed text-muted-3">
      {朲壍.map((蘡壍) => (<li key={蘡壍} className="flex gap-2">
          <span aria-hidden className="text-warn">
            ▲
          </span>
          {蘡壍}
        </li>))}
    </ul>);
}
function 匐壍({ data: 燿壍 }: {
    data: GoogleEstimatesResponse | undefined;
}) {
    const 郮壍: Column<EstimatePolicyRow>[] = [
        { key: "question", header: "Question", width: "minmax(190px,1.1fr)", cell: (川壍) => <span className="font-medium">{川壍.question}</span> },
        {
            key: "lead",
            header: "Leads",
            width: "minmax(220px,1.2fr)",
            cell: (糌壍) => (<span className="flex flex-col items-start gap-1.5">
          <履壍 source={糌壍.lead}/>
          <span>{糌壍.leadLabel}</span>
        </span>),
        },
        { key: "why", header: "Why", width: "minmax(260px,1.7fr)", cell: (鮻壍) => <span className="text-muted-3">{鮻壍.why}</span> },
    ];
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Google's simulators and our model" sub="Which estimate answers which planning question"/>
      <p className="m-0 max-w-[880px] text-[13px] leading-relaxed text-muted">
        Google Ads has its own forecasting tools. Performance Planner isn&apos;t available through the API, so it can&apos;t appear here. The budget and target simulators are read-only reports that replay a recent week of auctions at other settings. They answer “what if this campaign&apos;s budget or target were different?” better than a model built from spend history. Our models cover what they don&apos;t — month-end pacing, the 30-day trend, shared budgets and moving money between campaigns.
      </p>
      {燿壍?.blank ? (<div className="rounded-mini border border-dashed border-warn/50 px-3.5 py-2.5 text-xs text-muted-3" role="note">
          {燿壍.blank.note}
        </div>) : null}
      <驃壍 items={燿壍?.warnings ?? []}/>
      <DataTable rows={燿壍?.policy ?? ESTIMATE_POLICY} columns={郮壍} rowKey={(梪壍) => 梪壍.id} ariaLabel="Which estimate leads for each planning question" density="compact" minWidth={720}/>
    </Card>);
}
function 螙壍({ campaigns: 咈壍, selected: 獷壍, onPick: 鉦壍 }: {
    campaigns: readonly EstimateCampaignView[];
    selected: string | null;
    onPick: (录壍: string) => void;
}) {
    return (<div role="group" aria-label="Campaigns" className="flex flex-col gap-1">
      {咈壍.map((繄壍) => {
            const 鴳壍 = 繄壍.campaignId === 獷壍;
            return (<button key={繄壍.campaignId} type="button" aria-pressed={鴳壍} onClick={() => 鉦壍(繄壍.campaignId)} className={cn("flex flex-col items-start gap-0.5 rounded-mini border px-3 py-2.5 text-left transition-colors", 鴳壍 ? "border-accent bg-teal-t" : "border-transparent hover:bg-fill")}>
            <MiddleTruncate text={繄壍.name} className="w-full text-[13px] font-medium"/>
            <span className={cn("font-mono text-micro tracking-label uppercase", 繄壍.simulations.length ? "text-accent" : "text-faint")}>{`${繄壍.type} · ${availabilityLabel(繄壍)}`}</span>
          </button>);
        })}
    </div>);
}
function Cmp19({ campaign: 褑壍, sim: 嘀壍, objective: 瓯壍, whatIf: 鏞壍, currency: 惍壍 }: {
    campaign: EstimateCampaignView;
    sim: SimulationView;
    objective: Objective;
    whatIf: number | null;
    currency: string;
}) {
    const 羼壍 = useMemo(() => prefersReducedMotion(), []);
    const 麫壍 = 嘀壍.type === "BUDGET" ? 褑壍.modelCurve : null;
    const 殚壍 = simulatedRange(嘀壍.perDay);
    const 誉壍 = 瓯壍 === "conversions" ? "conversions" : "conversion value";
    const 坸壍 = `${褑壍.name}: Google's ${SIMULATION_LABELS[嘀壍.type].toLowerCase()} simulation${麫壍 ? " and our model" : ""}, ${誉壍} per day from ${settingLabel(嘀壍.type, 殚壍?.[0], 惍壍)} to ${settingLabel(嘀壍.type, 殚壍?.[1], 惍壍)}; current ${settingLabel(嘀壍.type, 嘀壍.current, 惍壍)}`;
    return (<div className="relative h-[260px]">
      <EChart className="absolute inset-0" build={(癧壍: ChartTokens) => simulatorOption(癧壍, { type: 嘀壍.type, objective: 瓯壍, points: 嘀壍.perDay, modelCurve: 麫壍, current: 嘀壍.current, whatIf: 鏞壍, currency: 惍壍 }, 羼壍)} deps={[嘀壍, 瓯壍, 鏞壍, 惍壍, 麫壍]} ariaLabel={坸壍}/>
    </div>);
}
function Cmp20({ sim: 扅壍, objective: 脴壍, currency: 丣壍 }: {
    sim: SimulationView;
    objective: Objective;
    currency: string;
}) {
    const 洒壍 = useMemo(() => pointRows(扅壍), [扅壍]);
    const 谁壍 = 扅壍.type !== "BUDGET";
    const 声壍 = (矟壍: number | null) => (矟壍 === null ? "—" : money(矟壍, 丣壍, { compact: false }));
    const 雎壍: Column<PointRow>[] = [
        {
            key: "value",
            header: 扅壍.type === "BUDGET" ? "Budget / day" : SIMULATION_LABELS[扅壍.type],
            width: "minmax(120px,1.1fr)",
            cell: (掽壍) => (<span className={cn("flex items-center gap-2", 掽壍.current && "font-semibold")}>
          {settingLabel(扅壍.type, 掽壍.value, 丣壍)}
          {掽壍.current ? <Pill tone="accent">Current</Pill> : null}
        </span>),
        },
        ...(谁壍 ? [{ key: "required", header: "Needs budget", align: "right" as const, width: "minmax(100px,1fr)", cell: (芬壍: PointRow) => <span className="text-muted">{芬壍.requiredBudget === null ? "—" : perDay(芬壍.requiredBudget, 丣壍)}</span> }] : []),
        { key: "cost", header: "Cost / day", align: "right", width: "minmax(90px,1fr)", cell: (供壍) => 声壍(供壍.cost) },
        { key: "conversions", header: "Conv. / day", align: "right", width: "minmax(90px,0.9fr)", cell: (溊壍) => <span className={脴壍 === "conversions" ? "font-semibold" : undefined}>{formatOutcome("conversions", 溊壍.conversions, 丣壍)}</span> },
        { key: "cpa", header: "CPA", align: "right", width: "minmax(80px,0.8fr)", cell: (赹壍) => <span className="text-muted">{声壍(赹壍.cpa)}</span> },
        { key: "value_day", header: "Value / day", align: "right", width: "minmax(90px,1fr)", cell: (婨壍) => <span className={脴壍 === "conv_value" ? "font-semibold" : undefined}>{声壍(婨壍.convValue)}</span> },
        { key: "roas", header: "ROAS", align: "right", width: "minmax(70px,0.7fr)", cell: (祗壍) => <span className="text-muted">{祗壍.roas === null ? "—" : `${祗壍.roas.toFixed(2)}x`}</span> },
    ];
    return <DataTable rows={洒壍} columns={雎壍} rowKey={(顆壍) => String(顆壍.value)} ariaLabel={`Google's ${SIMULATION_LABELS[扅壍.type].toLowerCase()} simulation, per day`} density="compact" minWidth={谁壍 ? 720 : 620} rowClassName={(攵壍) => (攵壍.current ? "bg-teal/4" : undefined)}/>;
}
function 萤壍({ decision: 儓壍, currency: 瀂壍 }: {
    decision: BudgetEstimateDecision;
    currency: string;
}) {
    const 軱壍 = agreementLine(儓壍.disagreementPct);
    const 寠壍 = (竏壍: number | null) => (竏壍 === null ? "—" : `${formatOutcome(儓壍.objective, 竏壍, 瀂壍)}/day`);
    return (<div className="flex flex-col gap-2.5 border-t border-tone/8 pt-4">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-micro tracking-label text-faint uppercase">Leads</span>
          <履壍 source={儓壍.lead}/>
        </div>
        <MetaStat label={`Google · ${perDay(儓壍.proposedDaily, 瀂壍)}`} value={寠壍(儓壍.googleOutcome)}/>
        <MetaStat label="Our model" value={寠壍(儓壍.model)}/>
        <MetaStat label="Model vs Google" value={formatDelta(儓壍.disagreementPct)}/>
      </div>
      <p className="m-0 text-[13px] text-muted">{儓壍.reason}</p>
      {軱壍 ? <p className="m-0 text-[13px] font-medium">{軱壍}.</p> : null}
    </div>);
}
function Cmp21({ campaign: 暭壍, data: 薜壍, simKey: 劋壍, onSimKey: 煺壍 }: {
    campaign: EstimateCampaignView;
    data: GoogleEstimatesResponse;
    simKey: SimulationKey | null;
    onSimKey: (適壍: SimulationKey) => void;
}) {
    const 嵘壍 = useChartTokens();
    const 籇壍 = 薜壍.currency;
    const 鬶壍 = 薜壍.objective;
    const [栥壍, 蜔壍] = useState<number | null>(null);
    const 吃壍 = 暭壍.simulations.map((狲壍) => keyOfType(狲壍.type));
    const 釡壍 = 劋壍 && 吃壍.includes(劋壍) ? 劋壍 : (吃壍[0] ?? null);
    const 廐壍 = 暭壍.simulations.find((綿壍) => keyOfType(綿壍.type) === 釡壍) ?? null;
    const 鲮壍 = 暭壍.simulations.find((榝壍) => 榝壍.type === "BUDGET") ?? null;
    const 袌壍 = useMemo(() => 栥壍 === null
        ? 暭壍.decision
        : chooseBudgetEstimate({ campaign: 暭壍, simulation: 鲮壍, modelCurve: 暭壍.modelCurve, proposedDaily: 栥壍, dataThrough: 薜壍.dataThrough, objective: 鬶壍, currency: 籇壍 }), [栥壍, 暭壍, 鲮壍, 薜壍.dataThrough, 鬶壍, 籇壍]);
    const 啻壍 = colorFor("estimate_source", "google_simulator", 1, 嵘壍);
    const 瑪壍 = colorFor("estimate_source", "model", 0, 嵘壍);
    return (<div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-display text-[15px] font-semibold tracking-title">{暭壍.name}</span>
          <span className="font-mono text-micro tracking-label text-faint uppercase">
            {[暭壍.type, 暭壍.dailyBudget ? `Budget ${perDay(暭壍.dailyBudget, 籇壍)}` : "No daily budget", 暭壍.targetCpa ? `tCPA ${settingLabel("TARGET_CPA", 暭壍.targetCpa, 籇壍)}` : null, 暭壍.targetRoas ? `tROAS ${settingLabel("TARGET_ROAS", 暭壍.targetRoas, 籇壍)}` : null].filter(Boolean).join(" · ")}
          </span>
        </div>
        {吃壍.length > 1 ? <Segmented ariaLabel="Simulation" variant="sans" value={釡壍 as SimulationKey} onChange={煺壍} options={吃壍.map((鍙壍) => ({ value: 鍙壍, label: SIMULATION_LABELS[暭壍.simulations.find((恈壍) => keyOfType(恈壍.type) === 鍙壍)?.type ?? "BUDGET"] }))}/> : null}
        <a href={暭壍.deepLink} target="_blank" rel="noreferrer noopener" className="text-xs whitespace-nowrap">
          Open in Google Ads ↗
        </a>
      </div>

      {!廐壍 ? (<MiniCard className="flex flex-col gap-2 text-[13px]">
          <span className="font-medium">No simulations from Google for this campaign</span>
          <span className="text-muted-3">{暭壍.note ?? "Google returned no simulations for this campaign."}</span>
          {暭壍.decision?.model !== null && 暭壍.decision?.model !== undefined && 暭壍.dailyBudget ? (<span className="text-muted">{`Our model: ${formatOutcome(鬶壍, 暭壍.decision.model, 籇壍)} ${鬶壍 === "conversions" ? "conversions" : "value"} a day at ${perDay(暭壍.dailyBudget, 籇壍)}.`}</span>) : null}
          {暭壍.type === "PMax" ? <span className="text-xs text-muted-3">To cross-check a Performance Max budget with Google, use Performance Planner in the Google Ads interface (it isn&apos;t in the API).</span> : null}
        </MiniCard>) : (<>
          {暭壍.note && !鲮壍 ? <p className="m-0 text-xs text-muted-3">{`Budget what-if: ${暭壍.note}`}</p> : null}
          <div className="flex flex-wrap items-center gap-[18px]">
            <LegendKey kind="dot" color={啻壍} label={`Google simulator · ${formatShort(廐壍.start)} – ${formatShort(廐壍.end)}`}/>
            {廐壍.type === "BUDGET" && 暭壍.modelCurve ? <LegendKey kind="dashed" color={瑪壍} label="Our model · last 60 days"/> : null}
            <LegendKey kind="thin" color="var(--faint)" label="Current setting"/>
            {廐壍.stale ? <Pill tone="warn">Stale · ended {formatShort(廐壍.end)}</Pill> : null}
          </div>
          <Cmp19 campaign={暭壍} sim={廐壍} objective={鬶壍} whatIf={廐壍.type === "BUDGET" ? 栥壍 : null} currency={籇壍}/>
          {廐壍.type === "BUDGET" ? (<>
              <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
                <label htmlFor={`whatif-${暭壍.campaignId}`}>Try a daily budget</label>
                <MoneyInput id={`whatif-${暭壍.campaignId}`} value={栥壍 ?? 暭壍.dailyBudget ?? 0} currency={籇壍} step={轶壍} onCommit={(缷壍) => 蜔壍(缷壍 > 0 ? 缷壍 : null)} ariaLabel={`What-if daily budget for ${暭壍.name}`} className="w-[104px] rounded-mini border-line bg-input px-3 py-2 text-left" edited={栥壍 !== null}/>
                {栥壍 !== null ? (<Button variant="link" className="text-xs" onClick={() => 蜔壍(null)}>
                    Back to the current budget
                  </Button>) : null}
              </div>
              {袌壍 ? <萤壍 decision={袌壍} currency={籇壍}/> : null}
            </>) : (<p className="m-0 border-t border-tone/8 pt-4 text-[13px] text-muted">
              We don&apos;t model bid targets, so Google&apos;s target simulator is the estimate here. Each point assumes the daily budget is at least what it needs.
            </p>)}
          <Cmp20 sim={廐壍} objective={鬶壍} currency={籇壍}/>
          <p className="m-0 text-xs leading-relaxed text-muted-3">
            {`Google's points replay ${formatShort(廐壍.start)} – ${formatShort(廐壍.end)}: each is that window's total ÷ ${廐壍.days} days, so it describes the recent past, not a forecast.`}
            {廐壍.type === "BUDGET" ? " Our model is a · spend^b fitted on the last 60 days and assumes the budget gets spent — where Google says extra budget won't be spent, the two part ways." : ""}
          </p>
        </>)}
    </div>);
}
function Cmp22({ data: 欕壍, objective: 訄壍, onObjective: 図壍 }: {
    data: GoogleEstimatesResponse;
    objective: Objective;
    onObjective: (痢壍: Objective) => void;
}) {
    const [铑壍, 懀壍] = useQueryState("sim", parseAsString.withOptions({ history: "replace", scroll: false }));
    const [肯壍, 龞壍] = useQueryState("simtype", parseAsStringLiteral(SIMULATION_KEYS).withOptions({ history: "replace", scroll: false }));
    const 沍壍 = 欕壍.campaigns.find((譼壍) => 譼壍.campaignId === 铑壍) ?? defaultCampaign(欕壍.campaigns);
    return (<Card className="flex flex-col gap-5">
      <CardHeader title="Campaign what-if" sub="Google's simulated points vs our model · per day" action={<Segmented ariaLabel="Outcome" variant="sans" value={訄壍} onChange={図壍} options={(["conversions", "conv_value"] as const).map((填壍) => ({ value: 填壍, label: OBJECTIVE_LABELS[填壍] }))}/>}/>
      {!欕壍.campaigns.length ? (<p className="m-0 text-[13px] text-muted-3">No campaigns in this account yet.</p>) : (<div className="grid grid-cols-1 gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <螙壍 campaigns={欕壍.campaigns} selected={沍壍?.campaignId ?? null} onPick={(睚壍) => {
                void 懀壍(睚壍);
                void 龞壍(null);
            }}/>
          {沍壍 ? <Cmp21 key={沍壍.campaignId} campaign={沍壍} data={欕壍} simKey={肯壍} onSimKey={(陉壍) => void 龞壍(陉壍)}/> : null}
        </div>)}
    </Card>);
}
function 挸壍({ rec: 舧壍, currency: 伖壍 }: {
    rec: RecommendationView;
    currency: string;
}) {
    const 清壍 = weeklyImpactLine(weeklyDelta(舧壍.impact), 伖壍);
    const 賴壍 = 舧壍.liveBudget !== null && 舧壍.currentBudget !== null && Math.abs(舧壍.liveBudget - 舧壍.currentBudget) >= 0.01;
    return (<MiniCard className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <MiddleTruncate text={舧壍.campaignName ?? `Budget ${舧壍.budgetId ?? 舧壍.id}`} className="text-[13px] font-medium"/>
          <span className="font-mono text-micro tracking-label text-faint uppercase">{[舧壍.campaignType, "Campaign budget", 賴壍 ? `Now ${perDay(舧壍.liveBudget, 伖壍)}` : null].filter(Boolean).join(" · ")}</span>
        </div>
        <div className="flex items-baseline gap-2 tabular">
          <span className="text-[13px] text-muted">{perDay(舧壍.currentBudget, 伖壍)}</span>
          <span aria-hidden className="text-faint">
            →
          </span>
          <span className="font-display text-[17px] font-semibold text-accent">{perDay(舧壍.recommendedBudget, 伖壍)}</span>
        </div>
      </div>
      <span className="text-xs text-muted-3">{清壍 ? `Google's estimate per week: ${清壍}` : "Google didn't include an impact estimate."}</span>
      {舧壍.options.length > 1 ? (<div className="flex flex-wrap items-center gap-2" aria-label="Budget options">
          <span className="label-mono">Options</span>
          {舧壍.options.map((姣壍) => {
                const 磒壍 = weeklyDelta(姣壍.impact);
                return (<span key={姣壍.budget} className={cn("rounded-pill border px-2.5 py-1 font-mono text-micro tabular", 姣壍.budget === 舧壍.recommendedBudget ? "border-accent text-fg" : "border-line text-muted")}>
                {`${perDay(姣壍.budget, 伖壍)}${磒壍?.conversions !== null && 磒壍?.conversions !== undefined ? ` · ${磒壍.conversions >= 0 ? "+" : "−"}${Math.abs(磒壍.conversions).toFixed(Math.abs(磒壍.conversions) >= 100 ? 0 : 1)} conv./wk` : ""}`}
              </span>);
            })}
        </div>) : null}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {舧壍.deepLink ? (<a href={舧壍.deepLink} target="_blank" rel="noreferrer noopener" className="text-xs whitespace-nowrap">
            Open in Google Ads ↗
          </a>) : null}
        {舧壍.applied ? <Pill tone="accent">{`Budget at ${perDay(舧壍.liveBudget, 伖壍)}`}</Pill> : null}
      </div>
    </MiniCard>);
}
function 韁壍({ data: 撰壍 }: {
    data: GoogleEstimatesResponse;
}) {
    const 莟壍 = 撰壍.mode === "live";
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Google's budget recommendations" sub={莟壍 ? "Read from Google Ads · apply them in Google Ads" : 撰壍.blank?.reason.startsWith("Demo data") ? "Demo data · generated sample recommendations" : "No live data · recommendations appear once Google Ads is connected"}/>
      {撰壍.recommendations.length ? (撰壍.recommendations.map((傎壍) => <挸壍 key={傎壍.id} rec={傎壍} currency={撰壍.currency}/>)) : (<p className="m-0 text-[13px] text-muted-3">Google has no budget recommendations for this account right now.</p>)}
      <p className="m-0 text-xs leading-relaxed text-muted-3">Recommendations are Google&apos;s: this dashboard only reads them. Applying or dismissing one happens in Google Ads.</p>
    </Card>);
}
export function SimulatorsTab() {
    const [潽壍, 蹬壍] = useQueryState("objective", parseAsStringLiteral(冘壍).withDefault("conv_value").withOptions({ history: "replace", scroll: false }));
    const 孛壍 = useGoogleEstimates(潽壍);
    const 穊壍 = 孛壍.data;
    return (<div className="flex flex-col gap-6">
      <匐壍 data={穊壍}/>
      {孛壍.error && !穊壍 ? <ErrorState error={孛壍.error} onRetry={() => void 孛壍.refetch()}/> : null}
      {!穊壍 && !孛壍.error ? <Skeleton height={460} className="rounded-card"/> : null}
      {穊壍 ? (<Refetching active={孛壍.isPlaceholderData} className="flex flex-col gap-6">
          <Cmp22 data={穊壍} objective={潽壍} onObjective={(餹壍) => void 蹬壍(餹壍)}/>
          <韁壍 data={穊壍}/>
        </Refetching>) : null}
    </div>);
}
