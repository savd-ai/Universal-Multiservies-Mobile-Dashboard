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
function 值壍({ title: 漫壍, description: 踚壍, enabled: 嬉壍, onToggle: 秸壍, children: 飧壍, className: 旖壍 }: {
    title: string;
    description: string;
    enabled?: boolean;
    onToggle?: (蓅壍: boolean) => void;
    children: React.ReactNode;
    className?: string;
}) {
    const 冴壍 = 嬉壍 === false;
    return (<Card className={cn("flex flex-col gap-4", 旖壍)}>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h2 className="m-0 font-display text-base font-semibold tracking-title">{漫壍}</h2>
          <p className="text-[13px] leading-relaxed text-muted-3">{踚壍}</p>
        </div>
        {秸壍 ? <Switch checked={!!嬉壍} onChange={秸壍} ariaLabel={`${嬉壍 ? "Turn off" : "Turn on"} ${漫壍}`}/> : null}
      </div>
      <div className={cn("flex flex-col transition-opacity", 冴壍 && "opacity-50")}>{飧壍}</div>
    </Card>);
}
function 炣壍({ label: 辒壍, hint: 岁壍, children: 筰壍 }: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-soft py-3 last:border-b-0">
      <div className="flex min-w-[160px] flex-1 flex-col gap-0.5">
        <span className="text-[13px]">{辒壍}</span>
        {岁壍 ? <span className="text-xs text-muted-3">{岁壍}</span> : null}
      </div>
      <div className="flex items-center gap-2">{筰壍}</div>
    </div>);
}
function 驟壍({ label: 李壍, hint: 蘽壍, value: 匬壍, onChange: 爛壍, min: 鄊壍, max: 巹壍, step: 糨壍, unit: 鯗壍, display: 棆壍 }: {
    label: string;
    hint?: string;
    value: number;
    onChange: (螵壍: number) => void;
    min: number;
    max: number;
    step: number;
    unit?: string;
    display?: string;
}) {
    return (<div className="flex flex-col gap-2 border-b border-line-soft py-3 last:border-b-0">
      <div className="flex justify-between gap-3 text-[13px]">
        <span>{李壍}</span>
        <span className="font-mono text-accent tabular">{棆壍 ?? `${匬壍.toFixed(1)}${鯗壍 ?? ""}`}</span>
      </div>
      <Slider min={鄊壍} max={巹壍} step={糨壍} value={匬壍} onChange={(咤壍) => 爛壍(round1(咤壍))} aria-label={李壍}/>
      {蘽壍 ? <span className="text-xs text-muted-3">{蘽壍}</span> : null}
    </div>);
}
const 玓壍 = "font-display text-lg font-semibold tracking-title";
export function RulesScreen() {
    const 銂壍 = useAnomalySettings();
    const 影壍 = useCampaignOptions();
    const 繠壍 = useUpdateAnomalySettings();
    const [鵏壍, 樾壍] = useState<Draft | null>(null);
    const 褭壍 = 鵏壍 ?? 銂壍.data;
    const 嘜壍 = !!鵏壍 && !!銂壍.data && !sameDetectorSettings(鵏壍, 銂壍.data);
    const 甋壍 = useMemo(() => (鵏壍 ? detectorSettingsErrors(鵏壍) : []), [鵏壍]);
    const 鏺壍 = (惩壍: (翘壍: Draft) => Draft) => {
        const 黇壍 = 鵏壍 ?? 銂壍.data;
        if (黇壍)
            樾壍(惩壍(黇壍));
    };
    const 殶壍 = 褭壍 ? MONITORED_METRICS.filter((誥壍) => 褭壍.zscore.metrics[誥壍]) : [];
    const 垔壍 = 褭壍 ? changeHistoryOf(褭壍) : null;
    const 皃壍 = (镲壍: Partial<ChangeHistorySettings>) => 鏺壍((扡壍) => ({ ...扡壍, changeHistory: { ...changeHistoryOf(扡壍), ...镲壍 } }));
    const 腐壍 = () => {
        if (!鵏壍 || 甋壍.length)
            return;
        繠壍.mutate(detectorPatch(鵏壍) as unknown as Record<string, unknown>, {
            onSuccess: () => {
                樾壍(null);
                toast("Detector settings saved — signals re-evaluate with them now");
            },
            onError: (丿壍) => toast(丿壍.message || "Couldn't save the settings", { tone: "crit" }),
        });
    };
    return (<div className="flex flex-col gap-6">
      <PageHeader />

      {銂壍.error ? <ErrorState error={銂壍.error} onRetry={() => void 銂壍.refetch()}/> : null}

      <section className="flex flex-col gap-4" aria-labelledby="detectors-title">
        <div className="flex flex-col gap-1">
          <h2 id="detectors-title" className={cn("m-0", 玓壍)}>
            Detectors
          </h2>
          <span className="meta">Run on every evaluation · signals merge when several detectors agree</span>
        </div>

        {!褭壍 ? (<div className="grid grid-cols-1 gap-5 wide:grid-cols-2">
            {[0, 1, 2, 3].map((洮壍) => (<Skeleton key={洮壍} height={260} className="rounded-card"/>))}
          </div>) : (<div className="grid grid-cols-1 items-start gap-5 wide:grid-cols-2">
            <值壍 title="Z-score deviation" description={`Compares the average of the last ${褭壍.zscore.recentDays} day${褭壍.zscore.recentDays === 1 ? "" : "s"} with the mean and spread of the baseline. Fires above the threshold; critical at 1.8× the threshold.`} enabled={褭壍.zscore.enabled} onToggle={(谝壍) => 鏺壍((夌壍) => ({ ...夌壍, zscore: { ...夌壍.zscore, enabled: 谝壍 } }))}>
              <驟壍 label="Sensitivity (z-score)" value={褭壍.zscore.threshold} min={1} max={8} step={0.1} unit="σ" hint="Lower = more signals." onChange={(矻壍) => 鏺壍((雪壍) => ({ ...雪壍, zscore: { ...雪壍.zscore, threshold: 矻壍 } }))}/>
              <炣壍 label="Baseline window">
                <Segmented ariaLabel="Z-score baseline window" value={褭壍.zscore.baselineDays} onChange={(揙壍) => 鏺壍((苈壍) => ({ ...苈壍, zscore: { ...苈壍.zscore, baselineDays: 揙壍 } }))} options={([7, 14, 28] as const).map((侷壍) => ({ value: 侷壍, label: `${侷壍}D` }))}/>
              </炣壍>
              <炣壍 label="Recent window" hint="Days averaged and compared with the baseline.">
                <Segmented ariaLabel="Z-score recent window" value={褭壍.zscore.recentDays} onChange={(溦壍) => 鏺壍((趕壍) => ({ ...趕壍, zscore: { ...趕壍.zscore, recentDays: 溦壍 } }))} options={[1, 2, 3, 4, 5, 6, 7].map((媄壍) => ({ value: 媄壍, label: String(媄壍) }))}/>
              </炣壍>
              <div className="flex flex-col gap-2 py-3">
                <span className="text-[13px]">Monitored metrics</span>
                <ToggleChips ariaLabel="Monitored metrics" options={METRIC_TOGGLES.map((祳壍) => ({ value: 祳壍.key, label: `${祳壍.label} ${祳壍.hint}` }))} value={殶壍} onChange={(顢壍: MonitoredMetric[]) => 鏺壍((救壍) => ({ ...救壍, zscore: { ...救壍.zscore, metrics: Object.fromEntries(MONITORED_METRICS.map((葀壍) => [葀壍, 顢壍.includes(葀壍)])) as Record<MonitoredMetric, boolean> } }))}/>
                <span className="text-xs text-muted-3">These also drive the robust and weekday-seasonal detectors.</span>
              </div>
            </值壍>

            <值壍 title="Budget pacing & overdelivery" description="Month: projected month-end spend vs the monthly budget. Run rate: recent average daily spend vs the daily budget (Google may spend up to 2× the daily budget on a single day)." enabled={褭壍.pacing.enabled} onToggle={(儯壍) => 鏺壍((瀞壍) => ({ ...瀞壍, pacing: { ...瀞壍.pacing, enabled: 儯壍 } }))}>
              <炣壍 label="Overpacing warning" hint="Projected month-end above this share of budget.">
                <NumberInput value={toPct(褭壍.pacing.over)} onChange={(輍壍) => 鏺壍((导壍) => ({ ...导壍, pacing: { ...导壍.pacing, over: fromPct(輍壍) } }))} min={100} step={1} suffix="%" ariaLabel="Overpacing warning percent"/>
              </炣壍>
              <炣壍 label="Overpacing critical">
                <NumberInput value={toPct(褭壍.pacing.overCritical)} onChange={(竫壍) => 鏺壍((駚壍) => ({ ...駚壍, pacing: { ...駚壍.pacing, overCritical: fromPct(竫壍) } }))} min={100} step={1} suffix="%" ariaLabel="Overpacing critical percent"/>
              </炣壍>
              <炣壍 label="Underpacing" hint="Shown on the Budget planner below this share.">
                <NumberInput value={toPct(褭壍.pacing.under)} onChange={(曉壍) => 鏺壍((薸壍) => ({ ...薸壍, pacing: { ...薸壍.pacing, under: fromPct(曉壍) } }))} min={1} max={100} step={1} suffix="%" ariaLabel="Underpacing percent"/>
              </炣壍>
              <炣壍 label="Daily run rate · warning" hint="Recent average daily spend ÷ daily budget.">
                <NumberInput value={toPct(褭壍.pacing.dailyOver ?? DAILY_OVER_DEFAULT)} onChange={(劧壍) => 鏺壍((熖壍) => ({ ...熖壍, pacing: { ...熖壍.pacing, dailyOver: fromPct(劧壍) } }))} min={100} max={300} step={5} suffix="%" ariaLabel="Daily run-rate warning percent"/>
              </炣壍>
              <炣壍 label="Daily run rate · critical">
                <NumberInput value={toPct(褭壍.pacing.dailyOverCritical ?? DAILY_OVER_CRITICAL_DEFAULT)} onChange={(邅壍) => 鏺壍((嵴壍) => ({ ...嵴壍, pacing: { ...嵴壍.pacing, dailyOverCritical: fromPct(邅壍) } }))} min={100} max={300} step={5} suffix="%" ariaLabel="Daily run-rate critical percent"/>
              </炣壍>
            </值壍>

            {垔壍 ? (<值壍 title="Change history" description="Reads the Google Ads change log (the last 30 days) to explain signals: the intended effect of your own change — a budget raise, a pause, new negatives, a target change — is marked expected, bid-strategy and target changes start a learning period, a highly relevant change just before a shift is named as the likely cause, and a campaign nobody changed in the 14 days before a shift is flagged as likely external." enabled={垔壍.enabled} onToggle={(籣壍) => 皃壍({ enabled: 籣壍 })} className="wide:col-span-2">
                <div className="grid grid-cols-1 gap-x-8 wide:grid-cols-2">
                  <div className="flex flex-col">
                    <驟壍 label="Cause lookback" value={垔壍.lookbackDays} min={1} max={14} step={1} display={plural(垔壍.lookbackDays, "day")} hint="Changes up to this many days before a shift can explain it; later changes are shown as context only." onChange={(魒壍) => 皃壍({ lookbackDays: Math.round(魒壍) })}/>
                    <驟壍 label="Learning period" value={垔壍.learningDays} min={0} max={21} step={1} display={垔壍.learningDays ? plural(垔壍.learningDays, "day") : "Off"} hint="After a bid-strategy or target change, swings in CPA, CPC, conversion rate, ROAS, conversions and CTR are expected for this long." onChange={(桁壍) => 皃壍({ learningDays: Math.round(桁壍) })}/>
                  </div>
                  <div className="flex flex-col">
                    <炣壍 label="Downgrade expected signals" hint="A shift that is the intended effect of your change becomes info — still listed, shown muted.">
                      <Switch checked={垔壍.downgradeExpected} onChange={(蜰壍) => 皃壍({ downgradeExpected: 蜰壍 })} ariaLabel="Downgrade expected signals"/>
                    </炣壍>
                    <炣壍 label="Cap severity while learning" hint="Efficiency signals stay at warning during the learning period. Spend, pacing, delivery and tracking signals are never downgraded.">
                      <Switch checked={垔壍.capDuringLearning} onChange={(吟壍) => 皃壍({ capDuringLearning: 吟壍 })} ariaLabel="Cap severity while learning"/>
                    </炣壍>
                  </div>
                </div>
              </值壍>) : null}

            <值壍 title="Robust deviation (median · MAD)" description="Like the z-score, but with the median and median absolute deviation of the baseline — a single spike in the baseline can't hide a real shift. Suits noisy campaigns." enabled={褭壍.robust.enabled} onToggle={(猎壍) => 鏺壍((釽壍) => ({ ...釽壍, robust: { ...釽壍.robust, enabled: 猎壍 } }))}>
              <驟壍 label="Threshold" value={褭壍.robust.threshold} min={1} max={10} step={0.5} unit=" MAD" onChange={(廬壍) => 鏺壍((緛壍) => ({ ...緛壍, robust: { ...緛壍.robust, threshold: 廬壍 } }))}/>
              <炣壍 label="Baseline window" hint="7–56 days.">
                <NumberInput value={褭壍.robust.baselineDays} onChange={(鳊壍) => 鏺壍((榹壍) => ({ ...榹壍, robust: { ...榹壍.robust, baselineDays: 鳊壍 } }))} min={7} max={56} step={1} suffix="days" ariaLabel="Robust baseline days"/>
              </炣壍>
            </值壍>

            <值壍 title="Weekday-seasonal" description="Compares the latest day with the same weekday in previous weeks, so weekend dips and Monday surges don't raise false alarms." enabled={褭壍.seasonal.enabled} onToggle={(袨壍) => 鏺壍((喗壍) => ({ ...喗壍, seasonal: { ...喗壍.seasonal, enabled: 袨壍 } }))}>
              <驟壍 label="Threshold" value={褭壍.seasonal.threshold} min={1} max={10} step={0.5} unit="σ" onChange={(璆壍) => 鏺壍((鍵壍) => ({ ...鍵壍, seasonal: { ...鍵壍.seasonal, threshold: 璆壍 } }))}/>
              <炣壍 label="Weeks compared">
                <Segmented ariaLabel="Seasonal weeks" value={褭壍.seasonal.weeks} onChange={(恤壍) => 鏺壍((罓壍) => ({ ...罓壍, seasonal: { ...罓壍.seasonal, weeks: 恤壍 } }))} options={[2, 3, 4, 5, 6, 7, 8].map((鹂壍) => ({ value: 鹂壍, label: String(鹂壍) }))}/>
              </炣壍>
            </值壍>

            <值壍 title="Tracking break" description="Critical when clicks keep coming but conversions drop to zero — usually a broken tag, consent change or feed problem." enabled={褭壍.trackingBreak.enabled} onToggle={(欱壍) => 鏺壍((訠壍) => ({ ...訠壍, trackingBreak: { ...訠壍.trackingBreak, enabled: 欱壍 } }))}>
              <炣壍 label="Baseline conversions per day" hint="Only campaigns that normally convert at least this much.">
                <NumberInput value={褭壍.trackingBreak.minBaselineConvPerDay} onChange={(圏壍) => 鏺壍((痾壍) => ({ ...痾壍, trackingBreak: { ...痾壍.trackingBreak, minBaselineConvPerDay: 圏壍 } }))} min={0} step={0.5} ariaLabel="Minimum baseline conversions per day"/>
              </炣壍>
              <炣壍 label="Clicks per day" hint="A zero-conversion day counts only with at least this many clicks.">
                <NumberInput value={褭壍.trackingBreak.minClicksPerDay} onChange={(铭壍) => 鏺壍((懜壍) => ({ ...懜壍, trackingBreak: { ...懜壍.trackingBreak, minClicksPerDay: 铭壍 } }))} min={0} step={1} ariaLabel="Minimum clicks per day"/>
              </炣壍>
            </值壍>

            <值壍 title="Zero delivery" description="Critical when an enabled campaign that normally serves stops getting impressions (disapprovals, billing, budget or targeting problems)." enabled={褭壍.zeroDelivery.enabled} onToggle={(胋壍) => 鏺壍((龺壍) => ({ ...龺壍, zeroDelivery: { ...龺壍.zeroDelivery, enabled: 胋壍 } }))}>
              <炣壍 label="Baseline impressions per day" hint="Campaigns below this are too small to judge.">
                <NumberInput value={褭壍.zeroDelivery.minBaselineImpr} onChange={(沩壍) => 鏺壍((讘壍) => ({ ...讘壍, zeroDelivery: { ...讘壍.zeroDelivery, minBaselineImpr: 沩壍 } }))} min={0} step={10} ariaLabel="Minimum baseline impressions per day"/>
              </炣壍>
            </值壍>

            <值壍 title="Budget-limited opportunity" description="An opportunity signal for campaigns that lose impression share to budget while their ROAS beats the account average." enabled={褭壍.budgetLimited.enabled} onToggle={(墇壍) => 鏺壍((睶壍) => ({ ...睶壍, budgetLimited: { ...睶壍.budgetLimited, enabled: 墇壍 } }))}>
              <炣壍 label="Lost impression share (budget)" hint="At or above this share.">
                <NumberInput value={toPct(褭壍.budgetLimited.minLostIsBudget)} onChange={(陥壍) => 鏺壍((捔壍) => ({ ...捔壍, budgetLimited: { ...捔壍.budgetLimited, minLostIsBudget: fromPct(陥壍) } }))} min={0} max={100} step={1} suffix="%" ariaLabel="Minimum lost impression share percent"/>
              </炣壍>
              <炣壍 label="ROAS vs account" hint="Campaign ROAS at least this multiple of the account's.">
                <NumberInput value={褭壍.budgetLimited.roasVsAccount} onChange={(艃壍) => 鏺壍((伲壍) => ({ ...伲壍, budgetLimited: { ...伲壍.budgetLimited, roasVsAccount: 艃壍 } }))} min={0} step={0.05} suffix="×" ariaLabel="ROAS multiple versus account"/>
              </炣壍>
            </值壍>

            <值壍 title="Minimum volume guards" description="Deviations are ignored for campaigns below these daily baseline volumes, so tiny campaigns don't flood the feed.">
              <炣壍 label="Impressions per day">
                <NumberInput value={褭壍.minVolume.imprPerDay} onChange={(渡壍) => 鏺壍((贐壍) => ({ ...贐壍, minVolume: { ...贐壍.minVolume, imprPerDay: 渡壍 } }))} min={0} step={10} ariaLabel="Minimum impressions per day"/>
              </炣壍>
              <炣壍 label="Clicks per day" hint="For click and conversion metrics.">
                <NumberInput value={褭壍.minVolume.clicksPerDay} onChange={(姿壍) => 鏺壍((磮壍) => ({ ...磮壍, minVolume: { ...磮壍.minVolume, clicksPerDay: 姿壍 } }))} min={0} step={1} ariaLabel="Minimum clicks per day"/>
              </炣壍>
              <炣壍 label="Conversions per day" hint="For conversion metrics (conversions, CPA, CVR, ROAS).">
                <NumberInput value={褭壍.minVolume.convPerDay} onChange={(韝壍) => 鏺壍((擌壍) => ({ ...擌壍, minVolume: { ...擌壍.minVolume, convPerDay: 韝壍 } }))} min={0} step={0.1} ariaLabel="Minimum conversions per day"/>
              </炣壍>
            </值壍>

            <值壍 title="Excluded campaigns" description="Never monitored by any detector. Paused, removed and ended campaigns are skipped automatically." className="wide:col-span-2">
              <CampaignChecklist campaigns={影壍.data} value={褭壍.excludeCampaignIds} onChange={(莻壍) => 鏺壍((傪壍) => ({ ...傪壍, excludeCampaignIds: 莻壍 }))} label="Excluded campaigns" emptyLabel="No campaigns excluded"/>
            </值壍>
          </div>)}
      </section>

      {嘜壍 ? (<div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-card border border-teal/30 bg-surface px-5 py-3.5 shadow-pop" role="status">
          <span className="min-w-[200px] flex-1 text-[13px] text-muted">{甋壍.length ? 甋壍[0] : "Unsaved detector changes. Saving re-evaluates signals with the new settings."}</span>
          <Button variant="ghost" size="xs" onClick={() => 樾壍(null)} disabled={繠壍.isPending}>
            Discard
          </Button>
          <Button variant="accent" size="xs" onClick={腐壍} loading={繠壍.isPending} disabled={甋壍.length > 0}>
            Save changes
          </Button>
        </div>) : null}

      <ThresholdRulesCard />
    </div>);
}
