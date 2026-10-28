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
function VizGlyph({ type: value }: {
    type: ExploreVizType;
}) {
    const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
    const f = { fill: "currentColor" };
    let body: React.ReactNode;
    switch (value) {
        case "table":
            body = (<>
          <rect x="2" y="2.5" width="24" height="15" rx="2" {...s}/>
          <path d="M2 7.5h24M2 12.5h24M10 2.5v15" {...s} strokeWidth={1}/>
        </>);
            break;
        case "line":
            body = <path d="M2 15l6-5 5 2.5 6-7.5 7 2.5" {...s}/>;
            break;
        case "area":
            body = (<>
          <path d="M2 15l6-5 5 2.5 6-7.5 7 2.5V18H2z" {...f} opacity={0.22}/>
          <path d="M2 15l6-5 5 2.5 6-7.5 7 2.5" {...s}/>
        </>);
            break;
        case "bar":
            body = (<>
          <rect x="2" y="2.5" width="22" height="3.5" rx="1.5" {...f}/>
          <rect x="2" y="8.25" width="15" height="3.5" rx="1.5" {...f} opacity={0.7}/>
          <rect x="2" y="14" width="9" height="3.5" rx="1.5" {...f} opacity={0.45}/>
        </>);
            break;
        case "stacked-bar":
            body = (<>
          {[3, 10.5, 18].map((x, i) => (<g key={x}>
              <rect x={x} y={[9, 5, 7][i]} width="5.5" height={[9, 13, 11][i]} rx="1.5" {...f} opacity={0.4}/>
              <rect x={x} y={[3, 1.5, 4][i]} width="5.5" height={[5, 3, 2.5][i]} rx="1.5" {...f}/>
            </g>))}
        </>);
            break;
        case "donut":
            body = (<>
          <circle cx="14" cy="10" r="6.5" {...s} strokeWidth={3.5} opacity={0.3}/>
          <path d="M14 3.5a6.5 6.5 0 0 1 6.2 8.5" {...s} strokeWidth={3.5} strokeLinecap="butt"/>
        </>);
            break;
        case "number":
            body = (<text x="14" y="15" textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor" style={{ fontFamily: "var(--font-display)" }}>
          42
        </text>);
            break;
        case "kpi-strip":
            body = (<>
          {[1.5, 10, 18.5].map((x) => (<g key={x}>
              <rect x={x} y="3" width="8" height="14" rx="1.5" {...s} strokeWidth={1}/>
              <path d={`M${x + 1.5} 13l2-2 1.5 1 2-3`} {...s} strokeWidth={1}/>
            </g>))}
        </>);
            break;
        case "heatmap":
            body = (<>
          {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <rect key={`${r}-${c}`} x={2 + c * 6.25} y={2 + r * 5.5} width="5.5" height="4.75" rx="1" {...f} opacity={[0.25, 0.55, 0.9, 0.4, 0.7, 0.3, 0.5, 1, 0.2, 0.8, 0.35, 0.6][r * 4 + c]}/>))}
        </>);
            break;
        case "funnel":
            body = (<>
          <rect x="2" y="2.5" width="24" height="4" rx="1.5" {...f}/>
          <rect x="6" y="8" width="16" height="4" rx="1.5" {...f} opacity={0.65}/>
          <rect x="10" y="13.5" width="8" height="4" rx="1.5" {...f} opacity={0.4}/>
        </>);
            break;
        case "scatter":
            body = (<>
          <path d="M2 18h24M2 18V2" {...s} strokeWidth={1} opacity={0.5}/>
          <circle cx="8" cy="12" r="2" {...f} opacity={0.7}/>
          <circle cx="13" cy="7" r="3" {...f} opacity={0.5}/>
          <circle cx="20" cy="10" r="2.25" {...f} opacity={0.8}/>
          <circle cx="23" cy="4.5" r="1.5" {...f}/>
        </>);
            break;
        case "treemap":
            body = (<>
          <rect x="2" y="2.5" width="13" height="15" rx="1.5" {...f} opacity={0.85}/>
          <rect x="16.5" y="2.5" width="9.5" height="8" rx="1.5" {...f} opacity={0.55}/>
          <rect x="16.5" y="12" width="4.25" height="5.5" rx="1" {...f} opacity={0.35}/>
          <rect x="21.75" y="12" width="4.25" height="5.5" rx="1" {...f} opacity={0.2}/>
        </>);
            break;
        case "trend-multiples":
            body = (<>
          <path d="M2 7l6-3 5 2 6-4 7 2" {...s}/>
          <path d="M2 10.5h24" {...s} strokeWidth={1} opacity={0.35}/>
          <path d="M2 17l6-2 5 1 6-3 7 1" {...s} opacity={0.6}/>
        </>);
            break;
    }
    return (<svg viewBox="0 0 28 20" width="28" height="20" aria-hidden className="shrink-0">
      {body}
    </svg>);
}
export function effectiveViz(nb: Pick<NotebookCtx, "state" | "catalog">): VizSettings {
    return nb.state.viz ?? suggestViz(nb.state.spec, nb.catalog);
}
export function VizStep({ nb }: {
    nb: NotebookCtx;
}) {
    const { state, spec, dispatch, catalog } = nb;
    const suggested = suggestViz(spec, catalog);
    const current = effectiveViz(nb);
    const currentType = current.type as ExploreVizType;
    const fit = vizFit(currentType, spec);
    const pick = (exploreVizType: ExploreVizType) => dispatch({ type: "setViz", viz: exploreVizType === state.viz?.type ? state.viz : { type: exploreVizType } });
    return (<>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-3">
        {state.viz ? (<>
            <span>Pinned to {VIZ_META[currentType]?.label ?? currentType}.</span>
            {state.viz.type !== suggested.type ? (<Button variant="link" className="text-xs" onClick={() => dispatch({ type: "setViz", viz: undefined })}>
                Use the suggestion ({VIZ_META[suggested.type as ExploreVizType]?.label}) →
              </Button>) : (<Button variant="link" className="text-xs" onClick={() => dispatch({ type: "setViz", viz: undefined })}>
                Back to auto →
              </Button>)}
          </>) : (<>
            <Pill tone="accent">Auto</Pill>
            <span>Follows your breakdowns and metrics — pick a chart to pin it.</span>
          </>)}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2" role="group" aria-label="Visualization">
        {VIZ_ORDER.map((vIZ_ORDERItem) => {
            const f = vizFit(vIZ_ORDERItem, spec);
            const on = currentType === vIZ_ORDERItem;
            const tile = (<button key={vIZ_ORDERItem} type="button" aria-pressed={on} onClick={() => pick(vIZ_ORDERItem)} className={cn("flex flex-col items-center gap-1.5 rounded-mini border px-2 pt-2.5 pb-2 text-center transition-colors", on ? "border-accent bg-teal-t text-accent" : f.ok ? "border-line text-muted hover:border-tone/25 hover:text-fg" : "border-line-soft text-faint opacity-60 hover:opacity-100")}>
              <VizGlyph type={vIZ_ORDERItem}/>
              <span className={cn("text-[11px] leading-tight font-medium", on ? "text-fg" : "")}>{VIZ_META[vIZ_ORDERItem].label}</span>
              <span className={cn("h-3 font-mono text-[9px] leading-3 tracking-label uppercase", suggested.type === vIZ_ORDERItem ? "text-accent" : "text-transparent")}>{suggested.type === vIZ_ORDERItem ? "Suggested" : "·"}</span>
            </button>);
            const tip = f.ok ? VIZ_META[vIZ_ORDERItem].blurb : f.hint;
            return (<Tooltip key={vIZ_ORDERItem} content={tip}>
              {tile}
            </Tooltip>);
        })}
      </div>
      {!fit.ok ? <p className="m-0 text-xs text-warn">▲ {VIZ_META[currentType]?.label}: {fit.hint}</p> : fit.hint ? <p className="m-0 text-xs text-muted-3">{fit.hint}</p> : null}
      {currentType === "bar" ? (<div className="flex flex-wrap items-center gap-3">
          <span className="label-mono">Bars</span>
          <Segmented ariaLabel="Bar orientation" variant="sans" value={current.horizontal === undefined ? "auto" : current.horizontal ? "h" : "v"} onChange={(v) => dispatch({ type: "setViz", viz: { ...current, type: "bar", horizontal: v === "auto" ? undefined : v === "h" } })} options={[
                { value: "auto", label: "Auto" },
                { value: "h", label: "Horizontal" },
                { value: "v", label: "Vertical" },
            ]}/>
        </div>) : null}
    </>);
}
