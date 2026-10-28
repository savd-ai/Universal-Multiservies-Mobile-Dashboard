"use client";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Chip, Switch } from "@/components/ui/controls";
import { Field, Input, Select, Textarea } from "@/components/ui/inputs";
import { Drawer } from "@/components/ui/overlays";
import { useCatalog, type Catalog } from "@/lib/api/hooks";
import { VIZ_TYPES, type FilterKey, type VizType, type WidgetInstance, type WidgetQueryInput } from "@/lib/domain/contracts/dashboard";
import { DATE_PRESETS, PRESET_LABELS, type DatePreset } from "@/lib/domain/dates";
import { widgetDef } from "@/features/widgets/registry";
import { exploreHref } from "@/features/widgets/question/shared";
import type { ConfigField } from "@/features/widgets/types";
const FILTER_LABEL: Record<FilterKey, string> = { range: "Date range", compare: "Comparison", campaignType: "Campaign type", campaign: "Campaigns", status: "Status", device: "Device", cross: "Cross-filters" };
const VIZ_LABEL: Record<VizType, string> = {
    number: "Number",
    "kpi-strip": "KPI strip",
    line: "Line",
    area: "Area",
    bar: "Bar",
    "stacked-bar": "Stacked bars",
    "trend-multiples": "Trend (small multiples)",
    donut: "Donut",
    table: "Table",
    pivot: "Pivot table",
    gauge: "Gauge",
    funnel: "Funnel",
    scatter: "Scatter / bubble",
    heatmap: "Heatmap",
    treemap: "Treemap",
    "geo-table": "Geo table",
    "progress-goal": "Progress to goal",
};
interface Props {
    instance: WidgetInstance | null;
    onClose: () => void;
    onChange: (next: WidgetInstance) => void;
}
export function WidgetConfigDrawer({ instance, onClose, onChange }: Props) {
    const def = instance ? widgetDef(instance.type) : undefined;
    const catalog = useCatalog();
    if (!instance || !def)
        return null;
    const handler = (patch: Partial<WidgetInstance>) => onChange({ ...instance, ...patch });
    const setConfig = (patch: Record<string, unknown>) => handler({ config: { ...instance.config, ...patch } });
    const optOut = instance.filterOptOut ?? [];
    return (<Drawer open onOpenChange={(o) => !o && onClose()} eyebrow={`${def.category} · ${def.title}`} title="Widget settings" width={480}>
      <div className="flex flex-col gap-5">
        <Field label="Title">{(id) => <Input id={id} variant="field" value={instance.title ?? ""} placeholder={def.title} maxLength={120} onChange={(e) => handler({ title: e.target.value || undefined })}/>}</Field>
        <Field label="Subtitle">{(id) => <Input id={id} variant="field" value={instance.subtitle ?? ""} placeholder={def.subtitle} maxLength={160} onChange={(e) => handler({ subtitle: e.target.value || undefined })}/>}</Field>

        {instance.type === "question" && catalog.data ? <QuestionEditor catalog={catalog.data} config={instance.config as {
        query?: WidgetQueryInput;
        viz?: {
            type: VizType;
        };
    }} setConfig={setConfig}/> : null}

        {def.configFields?.map((f) => <ConfigInput key={f.key} field={f} value={instance.config[f.key] ?? (def.defaultConfig as Record<string, unknown>)[f.key]} catalog={catalog.data} onChange={(v) => setConfig({ [f.key]: v })}/>)}

        {def.filters.length ? (<div className="flex flex-col gap-2.5">
            <span className="label-mono">Follow dashboard filters</span>
            {def.filters.map((k) => (<label key={k} className="flex items-center gap-2.5 text-[13px]">
                <Checkbox checked={!optOut.includes(k)} onChange={(on) => handler({ filterOptOut: on ? optOut.filter((x) => x !== k) : [...optOut, k] })} ariaLabel={`Apply ${FILTER_LABEL[k]}`}/>
                {FILTER_LABEL[k]}
              </label>))}
          </div>) : (<p className="m-0 text-xs text-muted-3">This widget has its own fixed scope and ignores the dashboard filters.</p>)}
        <div className="flex justify-end">
          <Button variant="accent" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Drawer>);
}
function ConfigInput({ field, value, onChange, catalog }: {
    field: ConfigField;
    value: unknown;
    onChange: (v: unknown) => void;
    catalog?: Catalog;
}) {
    return (<Field label={field.label} hint={field.hint}>
      {(id) => {
            switch (field.kind) {
                case "number":
                    return <Input id={id} variant="field" type="number" min={field.min} max={field.max} step={field.step ?? 1} value={Number(value ?? field.min)} onChange={(e) => onChange(Math.max(field.min, Math.min(field.max, Number(e.target.value) || field.min)))} className="w-28"/>;
                case "select":
                    return (<Select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
                {field.options.map((o) => (<option key={o.value} value={o.value}>
                    {o.label}
                  </option>))}
              </Select>);
                case "metric":
                    return (<Select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
                {(catalog?.metrics ?? []).map((m) => (<option key={m.key} value={m.key}>
                    {m.label}
                  </option>))}
              </Select>);
                case "text":
                    return field.multiline ? <Textarea id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value.slice(0, 4000))} rows={8} className="font-mono text-xs"/> : <Input id={id} variant="field" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}/>;
            }
        }}
    </Field>);
}
function QuestionEditor({ catalog, config, setConfig }: {
    catalog: Catalog;
    config: {
        query?: WidgetQueryInput;
        viz?: {
            type: VizType;
        };
    };
    setConfig: (patch: Record<string, unknown>) => void;
}) {
    const router = useRouter();
    const query: WidgetQueryInput = config.query ?? { source: "google_ads", metrics: ["cost"], dimensions: [] };
    const metrics = query.metrics ?? [];
    const dims = [...(query.dimensions ?? [])];
    const setQuery = (patch: Partial<WidgetQueryInput>) => setConfig({ query: { ...query, ...patch } });
    const groups = useMemo(() => {
        const g: Record<string, typeof catalog.metrics> = { Base: [], Ratio: [], Custom: [] };
        for (const m of catalog.metrics)
            (m.kind === "custom" ? g.Custom : m.kind === "derived" ? g.Ratio : g.Base)?.push(m);
        return g;
    }, [catalog]);
    const pinned = query.dateRange && "preset" in query.dateRange ? query.dateRange.preset : "";
    return (<div className="flex flex-col gap-4 rounded-mini border border-line bg-fill p-4">
      <span className="label-mono">Query</span>
      <Field label="Visualization">
        {(id) => (<Select id={id} value={config.viz?.type ?? "table"} onChange={(e) => setConfig({ viz: { ...(config.viz ?? {}), type: e.target.value } })}>
            {VIZ_TYPES.map((v) => (<option key={v} value={v}>
                {VIZ_LABEL[v]}
              </option>))}
          </Select>)}
      </Field>
      <div className="flex flex-col gap-2">
        <span className="label-mono">Metrics</span>
        {Object.entries(groups).map(([name, list]) => list.length ? (<div key={name} className="flex flex-wrap gap-1.5">
              {list.map((m) => (<Chip key={m.key} active={metrics.includes(m.key)} onClick={() => setQuery({ metrics: metrics.includes(m.key) ? metrics.filter((x) => x !== m.key) : [...metrics, m.key].slice(0, 12) })} title={m.description}>
                  {m.short || m.label}
                </Chip>))}
            </div>) : null)}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (<Field key={i} label={`Group by ${i + 1}`}>
            {(id) => (<Select id={id} value={dims[i] ?? ""} onChange={(e) => {
                    const next = [...dims];
                    if (e.target.value)
                        next[i] = e.target.value as never;
                    else
                        next.splice(i, 1);
                    setQuery({ dimensions: next.filter(Boolean) as never });
                }}>
                <option value="">—</option>
                {catalog.dimensions.map((d) => (<option key={d.key} value={d.key}>
                    {d.label}
                  </option>))}
              </Select>)}
          </Field>))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date range">
          {(id) => (<Select id={id} value={pinned} onChange={(e) => setQuery({ dateRange: e.target.value ? { preset: e.target.value as DatePreset } : undefined })}>
              <option value="">Follow dashboard</option>
              {DATE_PRESETS.map((p) => (<option key={p} value={p}>
                  {PRESET_LABELS[p]}
                </option>))}
            </Select>)}
        </Field>
        <Field label="Limit">{(id) => <Input id={id} variant="field" type="number" min={1} max={10000} value={query.limit ?? ""} placeholder="All" onChange={(e) => setQuery({ limit: e.target.value ? Math.max(1, Math.min(10000, Number(e.target.value))) : undefined })}/>}</Field>
      </div>
      <Switch checked={!!query.compare && query.compare !== "none"} onChange={(on) => setQuery({ compare: on ? "previous_period" : "none" })} label="Compare with the dashboard's comparison period"/>
      <Button variant="ghost" size="xs" className="self-start" onClick={() => router.push(exploreHref(query as never, config.viz as never))}>
        Open in Explore →
      </Button>
    </div>);
}
