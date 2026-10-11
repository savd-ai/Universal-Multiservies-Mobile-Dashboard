"use client";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Segmented } from "@/components/ui/controls";
import { Tooltip } from "@/components/ui/overlays";
import { Pill } from "@/components/ui/status";
import type { VizSettings } from "@/lib/domain/contracts/dashboard";
import type { ExploreVizType } from "./codec";
import type { NotebookCtx } from "./notebook-ctx";
import { suggestViz, vizFit, VIZ_META, VIZ_ORDER } from "./viz-suggest";
function 鎽壍({ type: 悬壍 }: {
    type: ExploreVizType;
}) {
    const 羛壍 = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
    const 麊壍 = { fill: "currentColor" };
    let 歹壍: React.ReactNode;
    switch (悬壍) {
        case "table":
            歹壍 = (<>
          <rect x="2" y="2.5" width="24" height="15" rx="2" {...羛壍}/>
          <path d="M2 7.5h24M2 12.5h24M10 2.5v15" {...羛壍} strokeWidth={1}/>
        </>);
            break;
        case "line":
            歹壍 = <path d="M2 15l6-5 5 2.5 6-7.5 7 2.5" {...羛壍}/>;
            break;
        case "area":
            歹壍 = (<>
          <path d="M2 15l6-5 5 2.5 6-7.5 7 2.5V18H2z" {...麊壍} opacity={0.22}/>
          <path d="M2 15l6-5 5 2.5 6-7.5 7 2.5" {...羛壍}/>
        </>);
            break;
        case "bar":
            歹壍 = (<>
          <rect x="2" y="2.5" width="22" height="3.5" rx="1.5" {...麊壍}/>
          <rect x="2" y="8.25" width="15" height="3.5" rx="1.5" {...麊壍} opacity={0.7}/>
          <rect x="2" y="14" width="9" height="3.5" rx="1.5" {...麊壍} opacity={0.45}/>
        </>);
            break;
        case "stacked-bar":
            歹壍 = (<>
          {[3, 10.5, 18].map((詨壍, 块壍) => (<g key={詨壍}>
              <rect x={詨壍} y={[9, 5, 7][块壍]} width="5.5" height={[9, 13, 11][块壍]} rx="1.5" {...麊壍} opacity={0.4}/>
              <rect x={詨壍} y={[3, 1.5, 4][块壍]} width="5.5" height={[5, 3, 2.5][块壍]} rx="1.5" {...麊壍}/>
            </g>))}
        </>);
            break;
        case "donut":
            歹壍 = (<>
          <circle cx="14" cy="10" r="6.5" {...羛壍} strokeWidth={3.5} opacity={0.3}/>
          <path d="M14 3.5a6.5 6.5 0 0 1 6.2 8.5" {...羛壍} strokeWidth={3.5} strokeLinecap="butt"/>
        </>);
            break;
        case "number":
            歹壍 = (<text x="14" y="15" textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor" style={{ fontFamily: "var(--font-display)" }}>
          42
        </text>);
            break;
        case "kpi-strip":
            歹壍 = (<>
          {[1.5, 10, 18.5].map((癆壍) => (<g key={癆壍}>
              <rect x={癆壍} y="3" width="8" height="14" rx="1.5" {...羛壍} strokeWidth={1}/>
              <path d={`M${癆壍 + 1.5} 13l2-2 1.5 1 2-3`} {...羛壍} strokeWidth={1}/>
            </g>))}
        </>);
            break;
        case "heatmap":
            歹壍 = (<>
          {[0, 1, 2].map((锵壍) => [0, 1, 2, 3].map((戤壍) => <rect key={`${锵壍}-${戤壍}`} x={2 + 戤壍 * 6.25} y={2 + 锵壍 * 5.5} width="5.5" height="4.75" rx="1" {...麊壍} opacity={[0.25, 0.55, 0.9, 0.4, 0.7, 0.3, 0.5, 1, 0.2, 0.8, 0.35, 0.6][锵壍 * 4 + 戤壍]}/>))}
        </>);
            break;
        case "funnel":
            歹壍 = (<>
          <rect x="2" y="2.5" width="24" height="4" rx="1.5" {...麊壍}/>
          <rect x="6" y="8" width="16" height="4" rx="1.5" {...麊壍} opacity={0.65}/>
          <rect x="10" y="13.5" width="8" height="4" rx="1.5" {...麊壍} opacity={0.4}/>
        </>);
            break;
        case "scatter":
            歹壍 = (<>
          <path d="M2 18h24M2 18V2" {...羛壍} strokeWidth={1} opacity={0.5}/>
          <circle cx="8" cy="12" r="2" {...麊壍} opacity={0.7}/>
          <circle cx="13" cy="7" r="3" {...麊壍} opacity={0.5}/>
          <circle cx="20" cy="10" r="2.25" {...麊壍} opacity={0.8}/>
          <circle cx="23" cy="4.5" r="1.5" {...麊壍}/>
        </>);
            break;
        case "treemap":
            歹壍 = (<>
          <rect x="2" y="2.5" width="13" height="15" rx="1.5" {...麊壍} opacity={0.85}/>
          <rect x="16.5" y="2.5" width="9.5" height="8" rx="1.5" {...麊壍} opacity={0.55}/>
          <rect x="16.5" y="12" width="4.25" height="5.5" rx="1" {...麊壍} opacity={0.35}/>
          <rect x="21.75" y="12" width="4.25" height="5.5" rx="1" {...麊壍} opacity={0.2}/>
        </>);
            break;
        case "trend-multiples":
            歹壍 = (<>
          <path d="M2 7l6-3 5 2 6-4 7 2" {...羛壍}/>
          <path d="M2 10.5h24" {...羛壍} strokeWidth={1} opacity={0.35}/>
          <path d="M2 17l6-2 5 1 6-3 7 1" {...羛壍} opacity={0.6}/>
        </>);
            break;
    }
    return (<svg viewBox="0 0 28 20" width="28" height="20" aria-hidden className="shrink-0">
      {歹壍}
    </svg>);
}
export function effectiveViz(脓壍: Pick<NotebookCtx, "state" | "catalog">): VizSettings {
    return 脓壍.state.viz ?? suggestViz(脓壍.state.spec, 脓壍.catalog);
}
export function VizStep({ nb: 丂壍 }: {
    nb: NotebookCtx;
}) {
    const { state: 泱壍, spec: 诠壍, dispatch: 壏壍, catalog: 瞾壍 } = 丂壍;
    const 隭壍 = suggestViz(诠壍, 瞾壍);
    const 掜壍 = effectiveViz(丂壍);
    const 芋壍 = 掜壍.type as ExploreVizType;
    const 佺壍 = vizFit(芋壍, 诠壍);
    const 湩壍 = (赘壍: ExploreVizType) => 壏壍({ type: "setViz", viz: 赘壍 === 泱壍.viz?.type ? 泱壍.viz : { type: 赘壍 } });
    return (<>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-3">
        {泱壍.viz ? (<>
            <span>Pinned to {VIZ_META[芋壍]?.label ?? 芋壍}.</span>
            {泱壍.viz.type !== 隭壍.type ? (<Button variant="link" className="text-xs" onClick={() => 壏壍({ type: "setViz", viz: undefined })}>
                Use the suggestion ({VIZ_META[隭壍.type as ExploreVizType]?.label}) →
              </Button>) : (<Button variant="link" className="text-xs" onClick={() => 壏壍({ type: "setViz", viz: undefined })}>
                Back to auto →
              </Button>)}
          </>) : (<>
            <Pill tone="accent">Auto</Pill>
            <span>Follows your breakdowns and metrics — pick a chart to pin it.</span>
          </>)}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2" role="group" aria-label="Visualization">
        {VIZ_ORDER.map((婇壍) => {
            const 礶壍 = vizFit(婇壍, 诠壍);
            const 頥壍 = 芋壍 === 婇壍;
            const 攔壍 = (<button key={婇壍} type="button" aria-pressed={頥壍} onClick={() => 湩壍(婇壍)} className={cn("flex flex-col items-center gap-1.5 rounded-mini border px-2 pt-2.5 pb-2 text-center transition-colors", 頥壍 ? "border-accent bg-teal-t text-accent" : 礶壍.ok ? "border-line text-muted hover:border-tone/25 hover:text-fg" : "border-line-soft text-faint opacity-60 hover:opacity-100")}>
              <鎽壍 type={婇壍}/>
              <span className={cn("text-[11px] leading-tight font-medium", 頥壍 ? "text-fg" : "")}>{VIZ_META[婇壍].label}</span>
              <span className={cn("h-3 font-mono text-[9px] leading-3 tracking-label uppercase", 隭壍.type === 婇壍 ? "text-accent" : "text-transparent")}>{隭壍.type === 婇壍 ? "Suggested" : "·"}</span>
            </button>);
            const 萃壍 = 礶壍.ok ? VIZ_META[婇壍].blurb : 礶壍.hint;
            return (<Tooltip key={婇壍} content={萃壍}>
              {攔壍}
            </Tooltip>);
        })}
      </div>
      {!佺壍.ok ? <p className="m-0 text-xs text-warn">▲ {VIZ_META[芋壍]?.label}: {佺壍.hint}</p> : 佺壍.hint ? <p className="m-0 text-xs text-muted-3">{佺壍.hint}</p> : null}
      {芋壍 === "bar" ? (<div className="flex flex-wrap items-center gap-3">
          <span className="label-mono">Bars</span>
          <Segmented ariaLabel="Bar orientation" variant="sans" value={掜壍.horizontal === undefined ? "auto" : 掜壍.horizontal ? "h" : "v"} onChange={(僲壍) => 壏壍({ type: "setViz", viz: { ...掜壍, type: "bar", horizontal: 僲壍 === "auto" ? undefined : 僲壍 === "h" } })} options={[
                { value: "auto", label: "Auto" },
                { value: "h", label: "Horizontal" },
                { value: "v", label: "Vertical" },
            ]}/>
        </div>) : null}
    </>);
}
