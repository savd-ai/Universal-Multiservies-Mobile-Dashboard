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
const 抗壍: Record<FilterKey, string> = { range: "Date range", compare: "Comparison", campaignType: "Campaign type", campaign: "Campaigns", status: "Status", device: "Device", cross: "Cross-filters" };
const 膆壍: Record<VizType, string> = {
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
    onChange: (乵壍: WidgetInstance) => void;
}
export function WidgetConfigDrawer({ instance: 浤壍, onClose: 豓壍, onChange: 奂壍 }: Props) {
    const 砱壍 = 浤壍 ? widgetDef(浤壍.type) : undefined;
    const 霠壍 = useCatalog();
    if (!浤壍 || !砱壍)
        return null;
    const 搏壍 = (苾壍: Partial<WidgetInstance>) => 奂壍({ ...浤壍, ...苾壍 });
    const 俭壍 = (滜壍: Record<string, unknown>) => 搏壍({ config: { ...浤壍.config, ...滜壍 } });
    const 跋壍 = 浤壍.filterOptOut ?? [];
    return (<Drawer open onOpenChange={(媺壍) => !媺壍 && 豓壍()} eyebrow={`${砱壍.category} · ${砱壍.title}`} title="Widget settings" width={480}>
      <div className="flex flex-col gap-5">
        <Field label="Title">{(禩壍) => <Input id={禩壍} variant="field" value={浤壍.title ?? ""} placeholder={砱壍.title} maxLength={120} onChange={(题壍) => 搏壍({ title: 题壍.target.value || undefined })}/>}</Field>
        <Field label="Subtitle">{(文壍) => <Input id={文壍} variant="field" value={浤壍.subtitle ?? ""} placeholder={砱壍.subtitle} maxLength={160} onChange={(葶壍) => 搏壍({ subtitle: 葶壍.target.value || undefined })}/>}</Field>

        {浤壍.type === "question" && 霠壍.data ? <Cmp38 catalog={霠壍.data} config={浤壍.config as {
        query?: WidgetQueryInput;
        viz?: {
            type: VizType;
        };
    }} setConfig={俭壍}/> : null}

        {砱壍.configFields?.map((入壍) => <騐壍 key={入壍.key} field={入壍} value={浤壍.config[入壍.key] ?? (砱壍.defaultConfig as Record<string, unknown>)[入壍.key]} catalog={霠壍.data} onChange={(灔壍) => 俭壍({ [入壍.key]: 灔壍 })}/>)}

        {砱壍.filters.length ? (<div className="flex flex-col gap-2.5">
            <span className="label-mono">Follow dashboard filters</span>
            {砱壍.filters.map((轃壍) => (<label key={轃壍} className="flex items-center gap-2.5 text-[13px]">
                <Checkbox checked={!跋壍.includes(轃壍)} onChange={(尲壍) => 搏壍({ filterOptOut: 尲壍 ? 跋壍.filter((笡壍) => 笡壍 !== 轃壍) : [...跋壍, 轃壍] })} ariaLabel={`Apply ${抗壍[轃壍]}`}/>
                {抗壍[轃壍]}
              </label>))}
          </div>) : (<p className="m-0 text-xs text-muted-3">This widget has its own fixed scope and ignores the dashboard filters.</p>)}
        <div className="flex justify-end">
          <Button variant="accent" onClick={豓壍}>
            Done
          </Button>
        </div>
      </div>
    </Drawer>);
}
function 騐壍({ field: 替壍, value: 藮壍, onChange: 勝壍, catalog: 燌壍 }: {
    field: ConfigField;
    value: unknown;
    onChange: (邻壍: unknown) => void;
    catalog?: Catalog;
}) {
    return (<Field label={替壍.label} hint={替壍.hint}>
      {(嶪壍) => {
            switch (替壍.kind) {
                case "number":
                    return <Input id={嶪壍} variant="field" type="number" min={替壍.min} max={替壍.max} step={替壍.step ?? 1} value={Number(藮壍 ?? 替壍.min)} onChange={(粙壍) => 勝壍(Math.max(替壍.min, Math.min(替壍.max, Number(粙壍.target.value) || 替壍.min)))} className="w-28"/>;
                case "select":
                    return (<Select id={嶪壍} value={String(藮壍 ?? "")} onChange={(鮈壍) => 勝壍(鮈壍.target.value)}>
                {替壍.options.map((桷壍) => (<option key={桷壍.value} value={桷壍.value}>
                    {桷壍.label}
                  </option>))}
              </Select>);
                case "metric":
                    return (<Select id={嶪壍} value={String(藮壍 ?? "")} onChange={(蝦壍) => 勝壍(蝦壍.target.value)}>
                {(燌壍?.metrics ?? []).map((呕壍) => (<option key={呕壍.key} value={呕壍.key}>
                    {呕壍.label}
                  </option>))}
              </Select>);
                case "text":
                    return 替壍.multiline ? <Textarea id={嶪壍} value={String(藮壍 ?? "")} onChange={(獄壍) => 勝壍(獄壍.target.value.slice(0, 4000))} rows={8} className="font-mono text-xs"/> : <Input id={嶪壍} variant="field" value={String(藮壍 ?? "")} onChange={(鈳壍) => 勝壍(鈳壍.target.value)}/>;
            }
        }}
    </Field>);
}
function Cmp38({ catalog: 縑壍, config: 鴀壍, setConfig: 槯壍 }: {
    catalog: Catalog;
    config: {
        query?: WidgetQueryInput;
        viz?: {
            type: VizType;
        };
    };
    setConfig: (裞壍: Record<string, unknown>) => void;
}) {
    const 嗍壍 = useRouter();
    const 璼壍: WidgetQueryInput = 鴀壍.query ?? { source: "google_ads", metrics: ["cost"], dimensions: [] };
    const 鎫壍 = 璼壍.metrics ?? [];
    const 悚壍 = [...(璼壍.dimensions ?? [])];
    const 羉壍 = (鹸壍: Partial<WidgetQueryInput>) => 槯壍({ query: { ...璼壍, ...鹸壍 } });
    const 歧壍 = useMemo(() => {
        const 詖壍: Record<string, typeof 縑壍.metrics> = { Base: [], Ratio: [], Custom: [] };
        for (const 坅壍 of 縑壍.metrics)
            (坅壍.kind === "custom" ? 詖壍.Custom : 坅壍.kind === "derived" ? 詖壍.Ratio : 詖壍.Base)?.push(坅壍);
        return 詖壍;
    }, [縑壍]);
    const 瘴壍 = 璼壍.dateRange && "preset" in 璼壍.dateRange ? 璼壍.dateRange.preset : "";
    return (<div className="flex flex-col gap-4 rounded-mini border border-line bg-fill p-4">
      <span className="label-mono">Query</span>
      <Field label="Visualization">
        {(锣壍) => (<Select id={锣壍} value={鴀壍.viz?.type ?? "table"} onChange={(戒壍) => 槯壍({ viz: { ...(鴀壍.viz ?? {}), type: 戒壍.target.value } })}>
            {VIZ_TYPES.map((脁壍) => (<option key={脁壍} value={脁壍}>
                {膆壍[脁壍]}
              </option>))}
          </Select>)}
      </Field>
      <div className="flex flex-col gap-2">
        <span className="label-mono">Metrics</span>
        {Object.entries(歧壍).map(([鿰壍, 泟壍]) => 泟壍.length ? (<div key={鿰壍} className="flex flex-wrap gap-1.5">
              {泟壍.map((诎壍) => (<Chip key={诎壍.key} active={鎫壍.includes(诎壍.key)} onClick={() => 羉壍({ metrics: 鎫壍.includes(诎壍.key) ? 鎫壍.filter((墽壍) => 墽壍 !== 诎壍.key) : [...鎫壍, 诎壍.key].slice(0, 12) })} title={诎壍.description}>
                  {诎壍.short || 诎壍.label}
                </Chip>))}
            </div>) : null)}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((瞬壍) => (<Field key={瞬壍} label={`Group by ${瞬壍 + 1}`}>
            {(際壍) => (<Select id={際壍} value={悚壍[瞬壍] ?? ""} onChange={(掊壍) => {
                    const 艹壍 = [...悚壍];
                    if (掊壍.target.value)
                        艹壍[瞬壍] = 掊壍.target.value as never;
                    else
                        艹壍.splice(瞬壍, 1);
                    羉壍({ dimensions: 艹壍.filter(Boolean) as never });
                }}>
                <option value="">—</option>
                {縑壍.dimensions.map((佨壍) => (<option key={佨壍.key} value={佨壍.key}>
                    {佨壍.label}
                  </option>))}
              </Select>)}
          </Field>))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date range">
          {(湗壍) => (<Select id={湗壍} value={瘴壍} onChange={(赆壍) => 羉壍({ dateRange: 赆壍.target.value ? { preset: 赆壍.target.value as DatePreset } : undefined })}>
              <option value="">Follow dashboard</option>
              {DATE_PRESETS.map((娵壍) => (<option key={娵壍} value={娵壍}>
                  {PRESET_LABELS[娵壍]}
                </option>))}
            </Select>)}
        </Field>
        <Field label="Limit">{(礤壍) => <Input id={礤壍} variant="field" type="number" min={1} max={10000} value={璼壍.limit ?? ""} placeholder="All" onChange={(頓壍) => 羉壍({ limit: 頓壍.target.value ? Math.max(1, Math.min(10000, Number(頓壍.target.value))) : undefined })}/>}</Field>
      </div>
      <Switch checked={!!璼壍.compare && 璼壍.compare !== "none"} onChange={(攂壍) => 羉壍({ compare: 攂壍 ? "previous_period" : "none" })} label="Compare with the dashboard's comparison period"/>
      <Button variant="ghost" size="xs" className="self-start" onClick={() => 嗍壍.push(exploreHref(璼壍 as never, 鴀壍.viz as never))}>
        Open in Explore →
      </Button>
    </div>);
}
