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
export function DataStep({ nb }: {
    nb: NotebookCtx;
}) {
    const { spec, catalog } = nb;
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    const options: SourceOption[] = [{ value: "google_ads", abbr: "G", name: "Google Ads", caption: "Campaigns, ad groups, keywords and search terms · every breakdown", mode: nb.mode }];
    const idx = Math.max(0, options.findIndex((o) => o.value === spec.source));
    const table = plannedTable(catalog, spec);
    const onKey = (e: React.KeyboardEvent) => {
        const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
        if (!step)
            return;
        e.preventDefault();
        const next = (idx + step + options.length) % options.length;
        const opt = options[next];
        if (opt) {
            nb.setSource(opt.value);
            refs.current[next]?.focus();
        }
    };
    return (<>
      <div role="radiogroup" aria-label="Data source" onKeyDown={onKey} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((o, i) => {
            const on = o.value === spec.source;
            return (<button key={o.value} ref={(el) => {
                    refs.current[i] = el;
                }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => !on && nb.setSource(o.value)} className={cn("flex items-start gap-3 rounded-mini border p-3 text-left transition-colors", on ? "border-accent bg-teal-t" : "border-line bg-fill hover:border-tone/25")}>
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-mini border font-mono text-xs", on ? "border-teal/40 text-accent" : "border-tone/12 text-fg")} aria-hidden>
                {o.abbr}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="font-display text-sm leading-tight font-semibold">{o.name}</span>
                  <Pill tone={o.mode === "live" ? "accent" : "muted"}>{o.mode === "live" ? "Live" : "Demo"}</Pill>
                </span>
                <span className="text-xs leading-snug text-muted-3">{o.caption}</span>
              </span>
            </button>);
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-3">
        <span className="label-mono">Reads</span>
        {table ? (<span>
            {table.label} <span className="font-mono text-micro text-faint">{table.id}</span>
          </span>) : (<span className="text-warn">▲ No table can answer this combination</span>)}
        <span className="flex-1"/>
      </div>
    </>);
}
function metricGroups(metrics: CatalogMetric[]) {
    const groups: {
        name: string;
        items: CatalogMetric[];
    }[] = [
        { name: "Base", items: [] },
        { name: "Ratio", items: [] },
        { name: "Custom", items: [] },
    ];
    for (const m of metrics)
        (m.kind === "custom" ? groups[2] : m.kind === "derived" ? groups[1] : groups[0])?.items.push(m);
    return groups;
}
export function MetricsStep({ nb }: {
    nb: NotebookCtx;
}) {
    const { spec, catalog, dispatch, currency } = nb;
    const full = spec.metrics.length >= MAX_METRICS;
    return (<>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Selected metrics">
        {spec.metrics.length ? (spec.metrics.map((k, i) => {
            const meta = catalog.metrics.find((m) => m.key === k);
            const avail = metricAvailability(catalog, spec, k);
            return (<SelectedPill key={k} label={meta?.label ?? k} hint={meta ? formatGlyph(meta.format, currency) : "?"} warn={!avail.ok} warnText={avail.reason} onRemove={() => dispatch({ type: "removeMetric", key: k })} onMoveLeft={i > 0 ? () => dispatch({ type: "moveMetric", key: k, to: i - 1 }) : undefined}/>);
        })) : (<span className="text-[13px] text-warn">▲ Pick at least one metric</span>)}
      </div>
      {metricGroups(catalog.metrics).map((g) => g.items.length || g.name === "Custom" ? (<div key={g.name} className="flex flex-col gap-2">
            <GroupLabel aside={g.name === "Base" ? <span className="font-mono text-micro text-faint">{`${spec.metrics.length}/${MAX_METRICS}`}</span> : undefined}>{g.name}</GroupLabel>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((m) => {
                const active = spec.metrics.includes(m.key);
                const avail = active ? { ok: true } : metricAvailability(catalog, spec, m.key);
                const chip = (<OptionChip key={m.key} label={m.label} hint={formatGlyph(m.format, currency)} active={active} disabledReason={!avail.ok ? avail.reason : full && !active ? `Up to ${MAX_METRICS} metrics.` : undefined} title={m.formula ? `${m.description} · ${m.formula}` : m.description} onClick={() => dispatch({ type: "toggleMetric", key: m.key })}/>);
                if (m.kind !== "custom")
                    return chip;
                return (<span key={m.key} className="inline-flex items-center gap-0.5">
                    {chip}
                    <IconButton label={`Edit ${m.label}`} onClick={() => nb.editMetric(m.key)} className="size-6 border-transparent text-[12px]">
                      ⋯
                    </IconButton>
                  </span>);
            })}
              {g.name === "Custom" ? <AddRow onClick={() => nb.editMetric()}>New custom metric</AddRow> : null}
            </div>
            {g.name === "Custom" && !g.items.length ? <p className="m-0 text-xs text-muted-3">Formulas over other metrics, e.g. profit = conv_value − cost. They work everywhere a built-in metric does.</p> : null}
          </div>) : null)}
    </>);
}
const KIND_GROUPS = [
    { kind: "time", name: "Time" },
    { kind: "entity", name: "Entity" },
    { kind: "category", name: "Category" },
];
export function GroupByStep({ nb }: {
    nb: NotebookCtx;
}) {
    const { spec, catalog, dispatch } = nb;
    const label = (k: string) => catalog.dimensions.find((d) => d.key === k)?.label ?? k;
    return (<>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Selected breakdowns">
        {spec.dimensions.length ? (spec.dimensions.map((d, i) => (<span key={d} className="inline-flex items-center gap-1.5">
              {i > 0 ? (<span aria-hidden className="text-xs text-faint">
                  ×
                </span>) : null}
              <SelectedPill label={label(d)} onRemove={() => dispatch({ type: "toggleDimension", key: d })} onMoveLeft={i > 0 ? () => dispatch({ type: "moveDimension", key: d, to: i - 1 }) : undefined}/>
            </span>))) : (<span className="text-[13px] text-muted-3">No breakdown — one row of totals.</span>)}
      </div>
      {KIND_GROUPS.map((g) => (<div key={g.kind} className="flex flex-col gap-2">
          <GroupLabel>{g.name}</GroupLabel>
          <div className="flex flex-wrap gap-1.5">
            {catalog.dimensions
                .filter((d) => d.kind === g.kind)
                .map((d) => {
                const active = spec.dimensions.includes(d.key as DimensionKey);
                const avail = dimensionAvailability(catalog, spec, d.key);
                return <OptionChip key={d.key} label={d.label} active={active} disabledReason={avail.ok ? undefined : avail.reason} onClick={() => dispatch({ type: "toggleDimension", key: d.key as DimensionKey })}/>;
            })}
          </div>
        </div>))}
    </>);
}
