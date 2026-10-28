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
    onChange: (next: QuickRules) => void;
    onSave: () => void;
    onReset: () => void;
}
const BASELINES: BaselineDays[] = [7, 14, 28];
function MetricRow({ label, hint, checked, onChange }: {
    label: string;
    hint: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}) {
    return (<Switch checked={checked} onChange={onChange} ariaLabel={label} className="w-full py-2 [&>span:last-child]:flex-1" label={<span className="flex items-center gap-3">
          <span className="flex-1">{label}</span>
          <span className="font-mono text-micro text-faint">{hint}</span>
        </span>}/>);
}
export function QuickRulesPanel({ value, settings, dirty, saving, canSave = true, onChange, onSave, onReset }: QuickRulesPanelProps) {
    return (<aside aria-label="Detection rules" className="flex flex-col gap-[22px] rounded-card border border-line bg-card p-[22px] wide:sticky wide:top-24">
      <div className="font-display text-[16px] font-semibold">Detection rules</div>
      {!value ? (<SkeletonLines lines={8}/>) : (<>
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between text-[13px]">
              <span className="text-muted">Sensitivity (z-score)</span>
              <span className="font-mono text-accent tabular">{`${value.threshold.toFixed(1)}σ`}</span>
            </div>
            <Slider min={THRESHOLD_MIN} max={Math.max(THRESHOLD_MAX, value.threshold)} step={0.1} value={value.threshold} onChange={(v) => onChange({ ...value, threshold: round1(v) })} aria-label="Sensitivity: z-score threshold" aria-valuetext={`${value.threshold.toFixed(1)} standard deviations`}/>
            <div className="flex justify-between font-mono text-micro text-faint">
              <span>More signals</span>
              <span>Fewer</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-[13px] text-muted">Baseline window</span>
            <Segmented ariaLabel="Baseline window" fill value={value.baselineDays} onChange={(v) => onChange({ ...value, baselineDays: v })} options={BASELINES.map((n) => ({ value: n, label: `${n} days` }))}/>
          </div>

          <div className="flex flex-col gap-1">
            <span className="mb-1.5 text-[13px] text-muted">Monitored metrics</span>
            {METRIC_TOGGLES.map((m) => (<MetricRow key={m.key} label={m.label} hint={m.hint} checked={value.metrics[m.key]} onChange={(on) => onChange({ ...value, metrics: { ...value.metrics, [m.key]: on } })}/>))}
            <MetricRow label="Budget overpacing" hint={pacingHint(settings)} checked={value.pacing} onChange={(on) => onChange({ ...value, pacing: on })}/>
          </div>

          {settings && !settings.zscore.enabled ? (<p className="m-0 text-xs leading-relaxed text-muted-3">
              The z-score detector is off, so sensitivity and metrics have no effect.{canSave ? <> <Link href="/anomalies/rules">Turn it on under Rules →</Link></> : null}
            </p>) : null}

          {dirty ? (<div className="flex flex-col gap-2.5 rounded-mini border border-teal/30 bg-teal/6 p-3" role="status">
              <span className="text-xs leading-relaxed text-muted">{canSave ? "Previewing unsaved rules — the signals update live and nothing is stored until you save." : "Previewing — the signals update live. Your role can't change the saved rules."}</span>
              <div className="flex flex-wrap gap-2">
                {canSave ? (<Button variant="accent" size="xs" loading={saving} onClick={onSave}>
                    Save as default
                  </Button>) : null}
                <Button variant="ghost" size="xs" onClick={onReset} disabled={saving}>
                  Reset
                </Button>
              </div>
            </div>) : null}

          <div className="flex flex-col gap-3 border-t border-tone/8 pt-4">
            <p className="m-0 text-xs leading-[1.6] text-muted-3">{detectionFootnote(settings)}</p>
            {canSave ? (<Link href="/anomalies/rules" className="self-start text-xs">
                All detectors & thresholds →
              </Link>) : null}
          </div>
        </>)}
    </aside>);
}
