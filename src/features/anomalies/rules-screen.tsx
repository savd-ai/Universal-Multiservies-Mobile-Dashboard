"use client";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Segmented, Slider, Switch } from "@/components/ui/controls";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Card } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useAnomalySettings, useCampaignOptions, useUpdateAnomalySettings } from "@/lib/api/anomalies-ui";
import { plural } from "@/lib/domain/anomaly/recommendations";
import { MONITORED_METRICS, type AnomalySettings, type MonitoredMetric } from "@/lib/domain/contracts/anomaly";
import { METRIC_TOGGLES, round1 } from "./helpers/signals";
import { changeHistoryOf, DAILY_OVER_CRITICAL_DEFAULT, DAILY_OVER_DEFAULT, detectorPatch, detectorSettingsErrors, fromPct, sameDetectorSettings, toPct, type ChangeHistorySettings } from "./helpers/settings";
import { CampaignChecklist, NumberInput, ToggleChips } from "./shared";
import { ThresholdRulesCard } from "./threshold-rules";
type Draft = AnomalySettings;
function DetectorCard({ title, description, enabled, onToggle, children, className }: {
    title: string;
    description: string;
    enabled?: boolean;
    onToggle?: (v: boolean) => void;
    children: React.ReactNode;
    className?: string;
}) {
    const off = enabled === false;
    return (<Card className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h2 className="m-0 font-display text-base font-semibold tracking-title">{title}</h2>
          <p className="text-[13px] leading-relaxed text-muted-3">{description}</p>
        </div>
        {onToggle ? <Switch checked={!!enabled} onChange={onToggle} ariaLabel={`${enabled ? "Turn off" : "Turn on"} ${title}`}/> : null}
      </div>
      <div className={cn("flex flex-col transition-opacity", off && "opacity-50")}>{children}</div>
    </Card>);
}
function Row({ label, hint, children }: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-soft py-3 last:border-b-0">
      <div className="flex min-w-[160px] flex-1 flex-col gap-0.5">
        <span className="text-[13px]">{label}</span>
        {hint ? <span className="text-xs text-muted-3">{hint}</span> : null}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>);
}
function SliderRow({ label, hint, value, onChange, min, max, step, unit, display }: {
    label: string;
    hint?: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step: number;
    unit?: string;
    display?: string;
}) {
    return (<div className="flex flex-col gap-2 border-b border-line-soft py-3 last:border-b-0">
      <div className="flex justify-between gap-3 text-[13px]">
        <span>{label}</span>
        <span className="font-mono text-accent tabular">{display ?? `${value.toFixed(1)}${unit ?? ""}`}</span>
      </div>
      <Slider min={min} max={max} step={step} value={value} onChange={(v) => onChange(round1(v))} aria-label={label}/>
      {hint ? <span className="text-xs text-muted-3">{hint}</span> : null}
    </div>);
}
const SECTION_TITLE = "font-display text-lg font-semibold tracking-title";
export function RulesScreen() {
    const settings = useAnomalySettings();
    const campaigns = useCampaignOptions();
    const update = useUpdateAnomalySettings();
    const [draft, setDraft] = useState<Draft | null>(null);
    const s = draft ?? settings.data;
    const dirty = !!draft && !!settings.data && !sameDetectorSettings(draft, settings.data);
    const errors = useMemo(() => (draft ? detectorSettingsErrors(draft) : []), [draft]);
    const edit = (fn: (d: Draft) => Draft) => {
        const base = draft ?? settings.data;
        if (base)
            setDraft(fn(base));
    };
    const zMetrics = s ? MONITORED_METRICS.filter((m) => s.zscore.metrics[m]) : [];
    const history = s ? changeHistoryOf(s) : null;
    const editHistory = (patch: Partial<ChangeHistorySettings>) => edit((d) => ({ ...d, changeHistory: { ...changeHistoryOf(d), ...patch } }));
    const saveAll = () => {
        if (!draft || errors.length)
            return;
        update.mutate(detectorPatch(draft) as unknown as Record<string, unknown>, {
            onSuccess: () => {
                setDraft(null);
                toast("Detector settings saved — signals re-evaluate with them now");
            },
            onError: (e) => toast(e.message || "Couldn't save the settings", { tone: "crit" }),
        });
    };
    return (<div className="flex flex-col gap-6">
      <PageHeader />

      {settings.error ? <ErrorState error={settings.error} onRetry={() => void settings.refetch()}/> : null}

      <section className="flex flex-col gap-4" aria-labelledby="detectors-title">
        <div className="flex flex-col gap-1">
          <h2 id="detectors-title" className={cn("m-0", SECTION_TITLE)}>
            Detectors
          </h2>
          <span className="meta">Run on every evaluation · signals merge when several detectors agree</span>
        </div>

        {!s ? (<div className="grid grid-cols-1 gap-5 wide:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (<Skeleton key={i} height={260} className="rounded-card"/>))}
          </div>) : (<div className="grid grid-cols-1 items-start gap-5 wide:grid-cols-2">
            <DetectorCard title="Z-score deviation" description={`Compares the average of the last ${s.zscore.recentDays} day${s.zscore.recentDays === 1 ? "" : "s"} with the mean and spread of the baseline. Fires above the threshold; critical at 1.8× the threshold.`} enabled={s.zscore.enabled} onToggle={(v) => edit((d) => ({ ...d, zscore: { ...d.zscore, enabled: v } }))}>
              <SliderRow label="Sensitivity (z-score)" value={s.zscore.threshold} min={1} max={8} step={0.1} unit="σ" hint="Lower = more signals." onChange={(v) => edit((d) => ({ ...d, zscore: { ...d.zscore, threshold: v } }))}/>
              <Row label="Baseline window">
                <Segmented ariaLabel="Z-score baseline window" value={s.zscore.baselineDays} onChange={(v) => edit((d) => ({ ...d, zscore: { ...d.zscore, baselineDays: v } }))} options={([7, 14, 28] as const).map((n) => ({ value: n, label: `${n}D` }))}/>
              </Row>
              <Row label="Recent window" hint="Days averaged and compared with the baseline.">
                <Segmented ariaLabel="Z-score recent window" value={s.zscore.recentDays} onChange={(v) => edit((d) => ({ ...d, zscore: { ...d.zscore, recentDays: v } }))} options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: String(n) }))}/>
              </Row>
              <div className="flex flex-col gap-2 py-3">
                <span className="text-[13px]">Monitored metrics</span>
                <ToggleChips ariaLabel="Monitored metrics" options={METRIC_TOGGLES.map((m) => ({ value: m.key, label: `${m.label} ${m.hint}` }))} value={zMetrics} onChange={(on: MonitoredMetric[]) => edit((d) => ({ ...d, zscore: { ...d.zscore, metrics: Object.fromEntries(MONITORED_METRICS.map((m) => [m, on.includes(m)])) as Record<MonitoredMetric, boolean> } }))}/>
                <span className="text-xs text-muted-3">These also drive the robust and weekday-seasonal detectors.</span>
              </div>
            </DetectorCard>

            <DetectorCard title="Budget pacing & overdelivery" description="Month: projected month-end spend vs the monthly budget. Run rate: recent average daily spend vs the daily budget (Google may spend up to 2× the daily budget on a single day)." enabled={s.pacing.enabled} onToggle={(v) => edit((d) => ({ ...d, pacing: { ...d.pacing, enabled: v } }))}>
              <Row label="Overpacing warning" hint="Projected month-end above this share of budget.">
                <NumberInput value={toPct(s.pacing.over)} onChange={(v) => edit((d) => ({ ...d, pacing: { ...d.pacing, over: fromPct(v) } }))} min={100} step={1} suffix="%" ariaLabel="Overpacing warning percent"/>
              </Row>
              <Row label="Overpacing critical">
                <NumberInput value={toPct(s.pacing.overCritical)} onChange={(v) => edit((d) => ({ ...d, pacing: { ...d.pacing, overCritical: fromPct(v) } }))} min={100} step={1} suffix="%" ariaLabel="Overpacing critical percent"/>
              </Row>
              <Row label="Underpacing" hint="Shown on the Budget planner below this share.">
                <NumberInput value={toPct(s.pacing.under)} onChange={(v) => edit((d) => ({ ...d, pacing: { ...d.pacing, under: fromPct(v) } }))} min={1} max={100} step={1} suffix="%" ariaLabel="Underpacing percent"/>
              </Row>
              <Row label="Daily run rate · warning" hint="Recent average daily spend ÷ daily budget.">
                <NumberInput value={toPct(s.pacing.dailyOver ?? DAILY_OVER_DEFAULT)} onChange={(v) => edit((d) => ({ ...d, pacing: { ...d.pacing, dailyOver: fromPct(v) } }))} min={100} max={300} step={5} suffix="%" ariaLabel="Daily run-rate warning percent"/>
              </Row>
              <Row label="Daily run rate · critical">
                <NumberInput value={toPct(s.pacing.dailyOverCritical ?? DAILY_OVER_CRITICAL_DEFAULT)} onChange={(v) => edit((d) => ({ ...d, pacing: { ...d.pacing, dailyOverCritical: fromPct(v) } }))} min={100} max={300} step={5} suffix="%" ariaLabel="Daily run-rate critical percent"/>
              </Row>
            </DetectorCard>

            {history ? (<DetectorCard title="Change history" description="Reads the Google Ads change log (the last 30 days) to explain signals: the intended effect of your own change — a budget raise, a pause, new negatives, a target change — is marked expected, bid-strategy and target changes start a learning period, a highly relevant change just before a shift is named as the likely cause, and a campaign nobody changed in the 14 days before a shift is flagged as likely external." enabled={history.enabled} onToggle={(v) => editHistory({ enabled: v })} className="wide:col-span-2">
                <div className="grid grid-cols-1 gap-x-8 wide:grid-cols-2">
                  <div className="flex flex-col">
                    <SliderRow label="Cause lookback" value={history.lookbackDays} min={1} max={14} step={1} display={plural(history.lookbackDays, "day")} hint="Changes up to this many days before a shift can explain it; later changes are shown as context only." onChange={(v) => editHistory({ lookbackDays: Math.round(v) })}/>
                    <SliderRow label="Learning period" value={history.learningDays} min={0} max={21} step={1} display={history.learningDays ? plural(history.learningDays, "day") : "Off"} hint="After a bid-strategy or target change, swings in CPA, CPC, conversion rate, ROAS, conversions and CTR are expected for this long." onChange={(v) => editHistory({ learningDays: Math.round(v) })}/>
                  </div>
                  <div className="flex flex-col">
                    <Row label="Downgrade expected signals" hint="A shift that is the intended effect of your change becomes info — still listed, shown muted.">
                      <Switch checked={history.downgradeExpected} onChange={(v) => editHistory({ downgradeExpected: v })} ariaLabel="Downgrade expected signals"/>
                    </Row>
                    <Row label="Cap severity while learning" hint="Efficiency signals stay at warning during the learning period. Spend, pacing, delivery and tracking signals are never downgraded.">
                      <Switch checked={history.capDuringLearning} onChange={(v) => editHistory({ capDuringLearning: v })} ariaLabel="Cap severity while learning"/>
                    </Row>
                  </div>
                </div>
              </DetectorCard>) : null}

            <DetectorCard title="Robust deviation (median · MAD)" description="Like the z-score, but with the median and median absolute deviation of the baseline — a single spike in the baseline can't hide a real shift. Suits noisy campaigns." enabled={s.robust.enabled} onToggle={(v) => edit((d) => ({ ...d, robust: { ...d.robust, enabled: v } }))}>
              <SliderRow label="Threshold" value={s.robust.threshold} min={1} max={10} step={0.5} unit=" MAD" onChange={(v) => edit((d) => ({ ...d, robust: { ...d.robust, threshold: v } }))}/>
              <Row label="Baseline window" hint="7–56 days.">
                <NumberInput value={s.robust.baselineDays} onChange={(v) => edit((d) => ({ ...d, robust: { ...d.robust, baselineDays: v } }))} min={7} max={56} step={1} suffix="days" ariaLabel="Robust baseline days"/>
              </Row>
            </DetectorCard>

            <DetectorCard title="Weekday-seasonal" description="Compares the latest day with the same weekday in previous weeks, so weekend dips and Monday surges don't raise false alarms." enabled={s.seasonal.enabled} onToggle={(v) => edit((d) => ({ ...d, seasonal: { ...d.seasonal, enabled: v } }))}>
              <SliderRow label="Threshold" value={s.seasonal.threshold} min={1} max={10} step={0.5} unit="σ" onChange={(v) => edit((d) => ({ ...d, seasonal: { ...d.seasonal, threshold: v } }))}/>
              <Row label="Weeks compared">
                <Segmented ariaLabel="Seasonal weeks" value={s.seasonal.weeks} onChange={(v) => edit((d) => ({ ...d, seasonal: { ...d.seasonal, weeks: v } }))} options={[2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: n, label: String(n) }))}/>
              </Row>
            </DetectorCard>

            <DetectorCard title="Tracking break" description="Critical when clicks keep coming but conversions drop to zero — usually a broken tag, consent change or feed problem." enabled={s.trackingBreak.enabled} onToggle={(v) => edit((d) => ({ ...d, trackingBreak: { ...d.trackingBreak, enabled: v } }))}>
              <Row label="Baseline conversions per day" hint="Only campaigns that normally convert at least this much.">
                <NumberInput value={s.trackingBreak.minBaselineConvPerDay} onChange={(v) => edit((d) => ({ ...d, trackingBreak: { ...d.trackingBreak, minBaselineConvPerDay: v } }))} min={0} step={0.5} ariaLabel="Minimum baseline conversions per day"/>
              </Row>
              <Row label="Clicks per day" hint="A zero-conversion day counts only with at least this many clicks.">
                <NumberInput value={s.trackingBreak.minClicksPerDay} onChange={(v) => edit((d) => ({ ...d, trackingBreak: { ...d.trackingBreak, minClicksPerDay: v } }))} min={0} step={1} ariaLabel="Minimum clicks per day"/>
              </Row>
            </DetectorCard>

            <DetectorCard title="Zero delivery" description="Critical when an enabled campaign that normally serves stops getting impressions (disapprovals, billing, budget or targeting problems)." enabled={s.zeroDelivery.enabled} onToggle={(v) => edit((d) => ({ ...d, zeroDelivery: { ...d.zeroDelivery, enabled: v } }))}>
              <Row label="Baseline impressions per day" hint="Campaigns below this are too small to judge.">
                <NumberInput value={s.zeroDelivery.minBaselineImpr} onChange={(v) => edit((d) => ({ ...d, zeroDelivery: { ...d.zeroDelivery, minBaselineImpr: v } }))} min={0} step={10} ariaLabel="Minimum baseline impressions per day"/>
              </Row>
            </DetectorCard>

            <DetectorCard title="Budget-limited opportunity" description="An opportunity signal for campaigns that lose impression share to budget while their ROAS beats the account average." enabled={s.budgetLimited.enabled} onToggle={(v) => edit((d) => ({ ...d, budgetLimited: { ...d.budgetLimited, enabled: v } }))}>
              <Row label="Lost impression share (budget)" hint="At or above this share.">
                <NumberInput value={toPct(s.budgetLimited.minLostIsBudget)} onChange={(v) => edit((d) => ({ ...d, budgetLimited: { ...d.budgetLimited, minLostIsBudget: fromPct(v) } }))} min={0} max={100} step={1} suffix="%" ariaLabel="Minimum lost impression share percent"/>
              </Row>
              <Row label="ROAS vs account" hint="Campaign ROAS at least this multiple of the account's.">
                <NumberInput value={s.budgetLimited.roasVsAccount} onChange={(v) => edit((d) => ({ ...d, budgetLimited: { ...d.budgetLimited, roasVsAccount: v } }))} min={0} step={0.05} suffix="×" ariaLabel="ROAS multiple versus account"/>
              </Row>
            </DetectorCard>

            <DetectorCard title="Minimum volume guards" description="Deviations are ignored for campaigns below these daily baseline volumes, so tiny campaigns don't flood the feed.">
              <Row label="Impressions per day">
                <NumberInput value={s.minVolume.imprPerDay} onChange={(v) => edit((d) => ({ ...d, minVolume: { ...d.minVolume, imprPerDay: v } }))} min={0} step={10} ariaLabel="Minimum impressions per day"/>
              </Row>
              <Row label="Clicks per day" hint="For click and conversion metrics.">
                <NumberInput value={s.minVolume.clicksPerDay} onChange={(v) => edit((d) => ({ ...d, minVolume: { ...d.minVolume, clicksPerDay: v } }))} min={0} step={1} ariaLabel="Minimum clicks per day"/>
              </Row>
              <Row label="Conversions per day" hint="For conversion metrics (conversions, CPA, CVR, ROAS).">
                <NumberInput value={s.minVolume.convPerDay} onChange={(v) => edit((d) => ({ ...d, minVolume: { ...d.minVolume, convPerDay: v } }))} min={0} step={0.1} ariaLabel="Minimum conversions per day"/>
              </Row>
            </DetectorCard>

            <DetectorCard title="Excluded campaigns" description="Never monitored by any detector. Paused, removed and ended campaigns are skipped automatically." className="wide:col-span-2">
              <CampaignChecklist campaigns={campaigns.data} value={s.excludeCampaignIds} onChange={(ids) => edit((d) => ({ ...d, excludeCampaignIds: ids }))} label="Excluded campaigns" emptyLabel="No campaigns excluded"/>
            </DetectorCard>
          </div>)}
      </section>

      {dirty ? (<div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-card border border-teal/30 bg-surface px-5 py-3.5 shadow-pop" role="status">
          <span className="min-w-[200px] flex-1 text-[13px] text-muted">{errors.length ? errors[0] : "Unsaved detector changes. Saving re-evaluates signals with the new settings."}</span>
          <Button variant="ghost" size="xs" onClick={() => setDraft(null)} disabled={update.isPending}>
            Discard
          </Button>
          <Button variant="accent" size="xs" onClick={saveAll} loading={update.isPending} disabled={errors.length > 0}>
            Save changes
          </Button>
        </div>) : null}

      <ThresholdRulesCard />
    </div>);
}
