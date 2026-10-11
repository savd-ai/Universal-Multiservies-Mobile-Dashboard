"use client";
import { useRef } from "react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Pill } from "@/components/ui/status";
import type { CatalogMetric } from "@/lib/api/hooks";
import type { DimensionKey } from "@/lib/domain/schema/dimensions";
import { dimensionAvailability, metricAvailability, plannedTable } from "./compat";
import type { NotebookCtx } from "./notebook-ctx";
import { MAX_METRICS } from "./notebook-state";
import { AddRow, formatGlyph, GroupLabel, OptionChip, SelectedPill } from "./ui";
interface SourceOption {
    value: string;
    abbr: string;
    name: string;
    caption: string;
    mode: "live" | "blank";
}
export function DataStep({ nb: 濡壍 }: {
    nb: NotebookCtx;
}) {
    const { spec: 軐壍, catalog: 宿壍 } = 濡壍;
    const 窮壍 = useRef<(HTMLButtonElement | null)[]>([]);
    const 馝壍: SourceOption[] = [{ value: "google_ads", abbr: "G", name: "Google Ads", caption: "Campaigns, ad groups, keywords and search terms · every breakdown", mode: 濡壍.mode }];
    const 暌壍 = Math.max(0, 馝壍.findIndex((蕻壍) => 蕻壍.value === 軐壍.source));
    const 剪壍 = plannedTable(宿壍, 軐壍);
    const 煙壍 = (遈壍: React.KeyboardEvent) => {
        const 崷壍 = 遈壍.key === "ArrowDown" || 遈壍.key === "ArrowRight" ? 1 : 遈壍.key === "ArrowUp" || 遈壍.key === "ArrowLeft" ? -1 : 0;
        if (!崷壍)
            return;
        遈壍.preventDefault();
        const 簦壍 = (暌壍 + 崷壍 + 馝壍.length) % 馝壍.length;
        const 鬕壍 = 馝壍[簦壍];
        if (鬕壍) {
            濡壍.setSource(鬕壍.value);
            窮壍.current[簦壍]?.focus();
        }
    };
    return (<>
      <div role="radiogroup" aria-label="Data source" onKeyDown={煙壍} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {馝壍.map((栄壍, 蛳壍) => {
            const 叢壍 = 栄壍.value === 軐壍.source;
            return (<button key={栄壍.value} ref={(狑壍) => {
                    窮壍.current[蛳壍] = 狑壍;
                }} type="button" role="radio" aria-checked={叢壍} tabIndex={叢壍 ? 0 : -1} onClick={() => !叢壍 && 濡壍.setSource(栄壍.value)} className={cn("flex items-start gap-3 rounded-mini border p-3 text-left transition-colors", 叢壍 ? "border-accent bg-teal-t" : "border-line bg-fill hover:border-tone/25")}>
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-mini border font-mono text-xs", 叢壍 ? "border-teal/40 text-accent" : "border-tone/12 text-fg")} aria-hidden>
                {栄壍.abbr}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="font-display text-sm leading-tight font-semibold">{栄壍.name}</span>
                  <Pill tone={栄壍.mode === "live" ? "accent" : "muted"}>{栄壍.mode === "live" ? "Live" : "No data"}</Pill>
                </span>
                <span className="text-xs leading-snug text-muted-3">{栄壍.caption}</span>
              </span>
            </button>);
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-3">
        <span className="label-mono">Reads</span>
        {剪壍 ? (<span>
            {剪壍.label} <span className="font-mono text-micro text-faint">{剪壍.id}</span>
          </span>) : (<span className="text-warn">▲ No table can answer this combination</span>)}
        <span className="flex-1"/>
      </div>
    </>);
}
function 釀壍(庯壍: CatalogMetric[]) {
    const 綞壍: {
        name: string;
        items: CatalogMetric[];
    }[] = [
        { name: "Base", items: [] },
        { name: "Ratio", items: [] },
        { name: "Custom", items: [] },
    ];
    for (const 鲍壍 of 庯壍)
        (鲍壍.kind === "custom" ? 綞壍[2] : 鲍壍.kind === "derived" ? 綞壍[1] : 綞壍[0])?.items.push(鲍壍);
    return 綞壍;
}
export function MetricsStep({ nb: 楼壍 }: {
    nb: NotebookCtx;
}) {
    const { spec: 衫壍, catalog: 啚壍, dispatch: 瑉壍, currency: 錸壍 } = 楼壍;
    const 性壍 = 衫壍.metrics.length >= MAX_METRICS;
    return (<>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Selected metrics">
        {衫壍.metrics.length ? (衫壍.metrics.map((编壍, 鸅壍) => {
            const 櫴壍 = 啚壍.metrics.find((解壍) => 解壍.key === 编壍);
            const 囒壍 = metricAvailability(啚壍, 衫壍, 编壍);
            return (<SelectedPill key={编壍} label={櫴壍?.label ?? 编壍} hint={櫴壍 ? formatGlyph(櫴壍.format, 錸壍) : "?"} warn={!囒壍.ok} warnText={囒壍.reason} onRemove={() => 瑉壍({ type: "removeMetric", key: 编壍 })} onMoveLeft={鸅壍 > 0 ? () => 瑉壍({ type: "moveMetric", key: 编壍, to: 鸅壍 - 1 }) : undefined}/>);
        })) : (<span className="text-[13px] text-warn">▲ Pick at least one metric</span>)}
      </div>
      {釀壍(啚壍.metrics).map((痁壍) => 痁壍.items.length || 痁壍.name === "Custom" ? (<div key={痁壍.name} className="flex flex-col gap-2">
            <GroupLabel aside={痁壍.name === "Base" ? <span className="font-mono text-micro text-faint">{`${衫壍.metrics.length}/${MAX_METRICS}`}</span> : undefined}>{痁壍.name}</GroupLabel>
            <div className="flex flex-wrap gap-1.5">
              {痁壍.items.map((钰壍) => {
                const 憟壍 = 衫壍.metrics.includes(钰壍.key);
                const 肎壍 = 憟壍 ? { ok: true } : metricAvailability(啚壍, 衫壍, 钰壍.key);
                const 齽壍 = (<OptionChip key={钰壍.key} label={钰壍.label} hint={formatGlyph(钰壍.format, 錸壍)} active={憟壍} disabledReason={!肎壍.ok ? 肎壍.reason : 性壍 && !憟壍 ? `Up to ${MAX_METRICS} metrics.` : undefined} title={钰壍.formula ? `${钰壍.description} · ${钰壍.formula}` : 钰壍.description} onClick={() => 瑉壍({ type: "toggleMetric", key: 钰壍.key })}/>);
                if (钰壍.kind !== "custom")
                    return 齽壍;
                return (<span key={钰壍.key} className="inline-flex items-center gap-0.5">
                    {齽壍}
                    <IconButton label={`Edit ${钰壍.label}`} onClick={() => 楼壍.editMetric(钰壍.key)} className="size-6 border-transparent text-[12px]">
                      ⋯
                    </IconButton>
                  </span>);
            })}
              {痁壍.name === "Custom" ? <AddRow onClick={() => 楼壍.editMetric()}>New custom metric</AddRow> : null}
            </div>
            {痁壍.name === "Custom" && !痁壍.items.length ? <p className="m-0 text-xs text-muted-3">Formulas over other metrics, e.g. profit = conv_value − cost. They work everywhere a built-in metric does.</p> : null}
          </div>) : null)}
    </>);
}
const 汬壍 = [
    { kind: "time", name: "Time" },
    { kind: "entity", name: "Entity" },
    { kind: "category", name: "Category" },
];
export function GroupByStep({ nb: 譛壍 }: {
    nb: NotebookCtx;
}) {
    const { spec: 塊壍, catalog: 眹壍, dispatch: 阨壍 } = 譛壍;
    const 挗壍 = (舆壍: string) => 眹壍.dimensions.find((仵壍) => 仵壍.key === 舆壍)?.label ?? 舆壍;
    return (<>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Selected breakdowns">
        {塊壍.dimensions.length ? (塊壍.dimensions.map((淤壍, 賓壍) => (<span key={淤壍} className="inline-flex items-center gap-1.5">
              {賓壍 > 0 ? (<span aria-hidden className="text-xs text-faint">
                  ×
                </span>) : null}
              <SelectedPill label={挗壍(淤壍)} onRemove={() => 阨壍({ type: "toggleDimension", key: 淤壍 })} onMoveLeft={賓壍 > 0 ? () => 阨壍({ type: "moveDimension", key: 淤壍, to: 賓壍 - 1 }) : undefined}/>
            </span>))) : (<span className="text-[13px] text-muted-3">No breakdown — one row of totals.</span>)}
      </div>
      {汬壍.map((姂壍) => (<div key={姂壍.kind} className="flex flex-col gap-2">
          <GroupLabel>{姂壍.name}</GroupLabel>
          <div className="flex flex-wrap gap-1.5">
            {眹壍.dimensions
                .filter((碱壍) => 碱壍.kind === 姂壍.kind)
                .map((鞠壍) => {
                const 撏壍 = 塊壍.dimensions.includes(鞠壍.key as DimensionKey);
                const 荾壍 = dimensionAvailability(眹壍, 塊壍, 鞠壍.key);
                return <OptionChip key={鞠壍.key} label={鞠壍.label} active={撏壍} disabledReason={荾壍.ok ? undefined : 荾壍.reason} onClick={() => 阨壍({ type: "toggleDimension", key: 鞠壍.key as DimensionKey })}/>;
            })}
          </div>
        </div>))}
    </>);
}
