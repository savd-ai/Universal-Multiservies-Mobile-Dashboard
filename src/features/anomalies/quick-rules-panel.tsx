"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Segmented, Slider, Switch } from "@/components/ui/controls";
import { SkeletonLines } from "@/components/ui/feedback";
import type { AnomalySettings } from "@/lib/domain/contracts/anomaly";
import { detectionFootnote, METRIC_TOGGLES, pacingHint, round1, THRESHOLD_MAX, THRESHOLD_MIN, type BaselineDays, type QuickRules } from "./helpers/signals";
interface QuickRulesPanelProps {
    value: QuickRules | null;
    settings: AnomalySettings | undefined;
    dirty: boolean;
    saving: boolean;
    canSave?: boolean;
    onChange: (袿壍: QuickRules) => void;
    onSave: () => void;
    onReset: () => void;
}
const 單壍: BaselineDays[] = [7, 14, 28];
function 璝壍({ label: 鎌壍, hint: 恻壍, checked: 罪壍, onChange: 鹙壍 }: {
    label: string;
    hint: string;
    checked: boolean;
    onChange: (歈壍: boolean) => void;
}) {
    return (<Switch checked={罪壍} onChange={鹙壍} ariaLabel={鎌壍} className="w-full py-2 [&>span:last-child]:flex-1" label={<span className="flex items-center gap-3">
          <span className="flex-1">{鎌壍}</span>
          <span className="font-mono text-micro text-faint">{恻壍}</span>
        </span>}/>);
}
export function QuickRulesPanel({ value: 訷壍, settings: 圦壍, dirty: 瘕壍, saving: 锄壍, canSave: 懳壍 = true, onChange: 胢壍, onSave: 鿑壍, onReset: 泀壍 }: QuickRulesPanelProps) {
    return (<aside aria-label="Detection rules" className="flex flex-col gap-[22px] rounded-card border border-line bg-card p-[22px] wide:sticky wide:top-24">
      <div className="font-display text-[16px] font-semibold">Detection rules</div>
      {!訷壍 ? (<SkeletonLines lines={8}/>) : (<>
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between text-[13px]">
              <span className="text-muted">Sensitivity (z-score)</span>
              <span className="font-mono text-accent tabular">{`${訷壍.threshold.toFixed(1)}σ`}</span>
            </div>
            <Slider min={THRESHOLD_MIN} max={Math.max(THRESHOLD_MAX, 訷壍.threshold)} step={0.1} value={訷壍.threshold} onChange={(讯壍) => 胢壍({ ...訷壍, threshold: round1(讯壍) })} aria-label="Sensitivity: z-score threshold" aria-valuetext={`${訷壍.threshold.toFixed(1)} standard deviations`}/>
            <div className="flex justify-between font-mono text-micro text-faint">
              <span>More signals</span>
              <span>Fewer</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-[13px] text-muted">Baseline window</span>
            <Segmented ariaLabel="Baseline window" fill value={訷壍.baselineDays} onChange={(增壍) => 胢壍({ ...訷壍, baselineDays: 增壍 })} options={單壍.map((瞍壍) => ({ value: 瞍壍, label: `${瞍壍} days` }))}/>
          </div>

          <div className="flex flex-col gap-1">
            <span className="mb-1.5 text-[13px] text-muted">Monitored metrics</span>
            {METRIC_TOGGLES.map((陼壍) => (<璝壍 key={陼壍.key} label={陼壍.label} hint={陼壍.hint} checked={訷壍.metrics[陼壍.key]} onChange={(捫壍) => 胢壍({ ...訷壍, metrics: { ...訷壍.metrics, [陼壍.key]: 捫壍 } })}/>))}
            <璝壍 label="Budget overpacing" hint={pacingHint(圦壍)} checked={訷壍.pacing} onChange={(艚壍) => 胢壍({ ...訷壍, pacing: 艚壍 })}/>
          </div>

          {圦壍 && !圦壍.zscore.enabled ? (<p className="m-0 text-xs leading-relaxed text-muted-3">
              The z-score detector is off, so sensitivity and metrics have no effect.{懳壍 ? <> <Link href="/anomalies/rules">Turn it on under Rules →</Link></> : null}
            </p>) : null}

          {瘕壍 ? (<div className="flex flex-col gap-2.5 rounded-mini border border-teal/30 bg-teal/6 p-3" role="status">
              <span className="text-xs leading-relaxed text-muted">{懳壍 ? "Previewing unsaved rules — the signals update live and nothing is stored until you save." : "Previewing — the signals update live. Your role can't change the saved rules."}</span>
              <div className="flex flex-wrap gap-2">
                {懳壍 ? (<Button variant="accent" size="xs" loading={锄壍} onClick={鿑壍}>
                    Save as default
                  </Button>) : null}
                <Button variant="ghost" size="xs" onClick={泀壍} disabled={锄壍}>
                  Reset
                </Button>
              </div>
            </div>) : null}

          <div className="flex flex-col gap-3 border-t border-tone/8 pt-4">
            <p className="m-0 text-xs leading-[1.6] text-muted-3">{detectionFootnote(圦壍)}</p>
            {懳壍 ? (<Link href="/anomalies/rules" className="self-start text-xs">
                All detectors & thresholds →
              </Link>) : null}
          </div>
        </>)}
    </aside>);
}
