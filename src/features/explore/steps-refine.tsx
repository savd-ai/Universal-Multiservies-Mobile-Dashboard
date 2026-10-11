"use client";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Segmented, Switch } from "@/components/ui/controls";
import { Input, Select } from "@/components/ui/inputs";
import { useDimensionValues } from "@/lib/api/explore";
import { compareRange, resolvePreset, type CompareMode, type DatePreset, type DateRange } from "@/lib/domain/dates";
import { FILTER_OPS, HAVING_OPS, type QueryFilter, type QueryHaving } from "@/lib/domain/query/spec";
import type { DimensionKey } from "@/lib/domain/schema/dimensions";
import { cn } from "@/components/ui/cn";
import { dimensionAvailability, metricAvailability } from "./compat";
import { COMPARE_LABEL, dateRangeLabel, FILTER_OP_LABEL, HAVING_OP_LABEL, havingScale, metricFormat, resolvedRangeLabel, sortKeyLabel } from "./describe";
import type { NotebookCtx } from "./notebook-ctx";
import { isMultiOp, MAX_FILTERS, MAX_HAVING, MAX_SORT, sortableKeys } from "./notebook-state";
import { AddRow, DraftInput, formatGlyph, SelectedPill } from "./ui";
const 偭壍: Record<string, string> = { time: "Time", entity: "Entity", category: "Category" };
function 潜壍({ nb: 蹋壍, index: 嬺壍 }: {
    nb: NotebookCtx;
    index?: number;
}) {
    const { catalog: 稩壍, spec: 餘壍 } = 蹋壍;
    return (<>
      {["time", "entity", "category"].map((昇壍) => (<optgroup key={昇壍} label={偭壍[昇壍]}>
          {稩壍.dimensions
                .filter((蓶壍) => 蓶壍.kind === 昇壍)
                .map((凥壍) => {
                const 烔壍 = dimensionAvailability(稩壍, 餘壍, 凥壍.key, { asFilter: true, ignoreFilter: 嬺壍 });
                const 迃壍 = 嬺壍 !== undefined && 餘壍.filters[嬺壍]?.dim === 凥壍.key;
                return (<option key={凥壍.key} value={凥壍.key} disabled={!烔壍.ok && !迃壍} title={烔壍.reason}>
                  {凥壍.label}
                  {!烔壍.ok && !迃壍 ? " — unavailable" : ""}
                </option>);
            })}
        </optgroup>))}
    </>);
}
export function firstFilterDim(岲壍: NotebookCtx): DimensionKey {
    const 管壍 = 岲壍.spec.source === "google_ads" ? ["campaign_type", "campaign", "device", "country", "campaign_status"] : ["platform", "platform_campaign"];
    for (const 骐壍 of 管壍)
        if (dimensionAvailability(岲壍.catalog, 岲壍.spec, 骐壍, { asFilter: true }).ok)
            return 骐壍 as DimensionKey;
    return (岲壍.catalog.dimensions.find((板壍) => dimensionAvailability(岲壍.catalog, 岲壍.spec, 板壍.key, { asFilter: true }).ok)?.key ?? "date") as DimensionKey;
}
export function FiltersStep({ nb: 虮壍 }: {
    nb: NotebookCtx;
}) {
    const { spec: 卝壍, dispatch: 牌壍 } = 虮壍;
    return (<>
      {卝壍.filters.map((鄻壍, 帪壍) => (<Cmp52 key={`${帪壍}-${鄻壍.dim}`} nb={虮壍} index={帪壍} filter={鄻壍}/>))}
      <AddRow disabled={卝壍.filters.length >= MAX_FILTERS} onClick={() => 牌壍({ type: "addFilter", filter: { dim: firstFilterDim(虮壍), op: "in", value: [] } })}>
        Add filter
      </AddRow>
    </>);
}
function Cmp52({ nb: 鰈壍, index: 棷壍, filter: 蟦壍 }: {
    nb: NotebookCtx;
    index: number;
    filter: QueryFilter;
}) {
    const { catalog: 哕壍, spec: 珄壍, dispatch: 銳壍 } = 鰈壍;
    const 徢壍 = dimensionAvailability(哕壍, 珄壍, 蟦壍.dim, { asFilter: true, ignoreFilter: 棷壍 });
    const 纑壍 = 哕壍.dimensions.find((鶀壍) => 鶀壍.key === 蟦壍.dim);
    const 橯壍 = 纑壍?.label ?? 蟦壍.dim;
    const { values: 襞壍, isLoading: 噍壍 } = useDimensionValues(珄壍.source, 蟦壍.dim, 珄壍.dateRange ?? 鰈壍.pageRange, { enabled: 徢壍.ok, time: 纑壍?.kind === "time" });
    const 甼壍 = (鐫壍: Partial<QueryFilter>) => 銳壍({ type: "updateFilter", index: 棷壍, patch: 鐫壍 });
    const 愚壍 = isMultiOp(蟦壍.op);
    const 耉壍 = (Array.isArray(蟦壍.value) ? 蟦壍.value : [蟦壍.value]).map(String).filter((黸壍) => 黸壍 !== "");
    return (<div className="flex flex-col gap-2.5 rounded-mini border border-tone/8 bg-fill p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Filter dimension" value={蟦壍.dim} onChange={(毧壍) => 甼壍({ dim: 毧壍.target.value as DimensionKey })} className="min-w-0 flex-1 py-2">
          <潜壍 nb={鰈壍} index={棷壍}/>
        </Select>
        <Select aria-label="Filter operator" value={蟦壍.op} onChange={(論壍) => 甼壍({ op: 論壍.target.value as QueryFilter["op"] })} className="py-2">
          {FILTER_OPS.map((埅壍) => (<option key={埅壍} value={埅壍}>
              {FILTER_OP_LABEL[埅壍]}
            </option>))}
        </Select>
        <IconButton label={`Remove the ${橯壍} filter`} onClick={() => 銳壍({ type: "removeFilter", index: 棷壍 })}>
          ×
        </IconButton>
      </div>
      {愚壍 ? (<Cmp53 label={橯壍} values={耉壍} suggestions={襞壍} loading={噍壍 && 徢壍.ok} onChange={(皴壍) => 甼壍({ value: 皴壍 })}/>) : (<藩壍 label={橯壍} op={蟦壍.op} value={typeof 蟦壍.value === "string" || typeof 蟦壍.value === "number" ? String(蟦壍.value) : (耉壍[0] ?? "")} suggestions={襞壍} onChange={(閣壍) => 甼壍({ value: 閣壍 })}/>)}
      {!徢壍.ok ? <p className="m-0 text-xs text-warn">▲ {徢壍.reason}</p> : null}
    </div>);
}
function 抒壍({ items: 膁壍, onPick: 买壍, loading: 浟壍 }: {
    items: string[];
    onPick: (豎壍: string) => void;
    loading?: boolean;
}) {
    if (浟壍)
        return <span className="text-xs text-faint">Loading values…</span>;
    if (!膁壍.length)
        return null;
    return (<div className="flex flex-wrap gap-1.5" role="group" aria-label="Suggested values">
      {膁壍.map((夽壍) => (<button key={夽壍} type="button" onClick={() => 买壍(夽壍)} className="max-w-[220px] truncate rounded-pill border border-dashed border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-teal/40 hover:text-accent" title={夽壍}>
          + {夽壍}
        </button>))}
    </div>);
}
function Cmp53({ label: 霛壍, values: 搊壍, suggestions: 苹壍, loading: 俨壍, onChange: 滗壍 }: {
    label: string;
    values: string[];
    suggestions: string[];
    loading: boolean;
    onChange: (跆壍: string[]) => void;
}) {
    const [媵壍, 禤壍] = useState("");
    const 颓壍 = 媵壍.trim().toLowerCase();
    const 斂壍 = 苹壍.filter((葱壍) => !搊壍.includes(葱壍) && (!颓壍 || 葱壍.toLowerCase().includes(颓壍))).slice(0, 12);
    const 兠壍 = (灏壍: string) => {
        const 輾壍 = 灏壍.trim();
        if (輾壍 && !搊壍.includes(輾壍))
            滗壍([...搊壍, 輾壍]);
        禤壍("");
    };
    return (<div className="flex flex-col gap-2">
      {搊壍.length ? (<div className="flex flex-wrap gap-1.5">
          {搊壍.map((尭壍) => (<SelectedPill key={尭壍} label={尭壍} onRemove={() => 滗壍(搊壍.filter((笜壍) => 笜壍 !== 尭壍))}/>))}
        </div>) : null}
      <Input variant="field" value={媵壍} aria-label={`Add a ${霛壍.toLowerCase()} value`} placeholder={搊壍.length ? "Add another value…" : `Type a ${霛壍.toLowerCase()} and press Enter`} onChange={(騋壍) => 禤壍(騋壍.target.value)} onKeyDown={(曺壍) => {
            if (曺壍.key === "Enter") {
                曺壍.preventDefault();
                兠壍(媵壍);
            }
            else if (曺壍.key === "Backspace" && !媵壍 && 搊壍.length)
                滗壍(搊壍.slice(0, -1));
        }} className="py-2"/>
      <抒壍 items={斂壍} onPick={兠壍} loading={俨壍 && !苹壍.length}/>
    </div>);
}
function 藩壍({ label: 勘壍, op: 燇壍, value: 邶壍, suggestions: 嶥壍, onChange: 粔壍 }: {
    label: string;
    op: QueryFilter["op"];
    value: string;
    suggestions: string[];
    onChange: (鮃壍: string) => void;
}) {
    const 桲壍 = 燇壍 === "eq" || 燇壍 === "neq";
    const 蝡壍 = 邶壍.trim().toLowerCase();
    const 呐壍 = 桲壍 ? 嶥壍.filter((猿壍) => 猿壍 !== 邶壍 && (!蝡壍 || 猿壍.toLowerCase().includes(蝡壍))).slice(0, 8) : [];
    return (<div className="flex flex-col gap-2">
      <DraftInput value={邶壍} onCommit={粔壍} aria-label={`${勘壍} value`} placeholder={桲壍 ? `Pick or type a ${勘壍.toLowerCase()}` : "Text to match (case-insensitive)"} className="py-2"/>
      <抒壍 items={呐壍} onPick={粔壍}/>
    </div>);
}
export function HavingStep({ nb: 鈮壍 }: {
    nb: NotebookCtx;
}) {
    const { spec: 弝壍, dispatch: 縌壍 } = 鈮壍;
    return (<>
      <p className="m-0 text-xs leading-relaxed text-muted-3">Keeps only the rows whose aggregated value passes — e.g. search terms with spend but no conversions.</p>
      {弝壍.having.map((鳻壍, 槪壍) => (<锞壍 key={`${槪壍}-${鳻壍.metric}`} nb={鈮壍} index={槪壍} having={鳻壍}/>))}
      <AddRow disabled={弝壍.having.length >= MAX_HAVING} onClick={() => 縌壍({ type: "addHaving", having: { metric: 弝壍.metrics[0] ?? "cost", op: "gt", value: 0 } })}>
        Add condition
      </AddRow>
    </>);
}
const 裙壍 = (嗈壍: string): number | null => {
    const 璷壍 = Number(嗈壍.replace(/[\s,$%x€£¥₫]/gi, ""));
    return 嗈壍.trim() !== "" && Number.isFinite(璷壍) ? 璷壍 : null;
};
function 鎦壍({ value: 悕壍, scale: 羄壍, onCommit: 鹳壍, label: 止壍 }: {
    value: number;
    scale: number;
    onCommit: (詑壍: number) => void;
    label: string;
}) {
    return (<DraftInput value={String(+(悕壍 * 羄壍).toFixed(6))} onCommit={(址壍) => {
            const 瘯壍 = 裙壍(址壍);
            if (瘯壍 !== null)
                鹳壍(瘯壍 / 羄壍);
        }} inputMode="decimal" aria-label={止壍} className="w-24 py-2 text-right tabular"/>);
}
function 锞壍({ nb: 戍壍, index: 胼壍, having: 鿫壍 }: {
    nb: NotebookCtx;
    index: number;
    having: QueryHaving;
}) {
    const { catalog: 泚壍, spec: 诉壍, dispatch: 墸壍, currency: 瞧壍 } = 戍壍;
    const 隖壍 = { ...诉壍, having: 诉壍.having.filter((掅壍, 艴壍) => 艴壍 !== 胼壍) };
    const 佣壍 = metricFormat(泚壍, 鿫壍.metric);
    const 湒壍 = havingScale(佣壍);
    const 赁壍 = formatGlyph(佣壍, 瞧壍);
    const 娰壍 = metricAvailability(泚壍, 隖壍, 鿫壍.metric);
    const 礟壍 = (頎壍: Partial<QueryHaving>) => 墸壍({ type: "updateHaving", index: 胼壍, patch: 頎壍 });
    const 擽壍 = [
        { name: "Base", items: 泚壍.metrics.filter((菬壍) => 菬壍.kind === "base") },
        { name: "Ratio", items: 泚壍.metrics.filter((僛壍) => 僛壍.kind === "derived") },
        { name: "Custom", items: 泚壍.metrics.filter((濊壍) => 濊壍.kind === "custom") },
    ];
    return (<div className="flex flex-col gap-2 rounded-mini border border-tone/8 bg-fill p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Condition metric" value={鿫壍.metric} onChange={(躹壍) => 礟壍({ metric: 躹壍.target.value })} className="min-w-0 flex-1 py-2">
          {!泚壍.metrics.some((宨壍) => 宨壍.key === 鿫壍.metric) ? <option value={鿫壍.metric}>{鿫壍.metric} (unknown)</option> : null}
          {擽壍.map((窗壍) => 窗壍.items.length ? (<optgroup key={窗壍.name} label={窗壍.name}>
                {窗壍.items.map((馆壍) => {
                const 晵壍 = 馆壍.key === 鿫壍.metric || metricAvailability(泚壍, 隖壍, 馆壍.key).ok;
                return (<option key={馆壍.key} value={馆壍.key} disabled={!晵壍}>
                      {馆壍.label}
                      {晵壍 ? "" : " — unavailable"}
                    </option>);
            })}
              </optgroup>) : null)}
        </Select>
        <Select aria-label="Condition operator" value={鿫壍.op} onChange={(蕤壍) => 礟壍({ op: 蕤壍.target.value as QueryHaving["op"] })} className="py-2">
          {HAVING_OPS.map((剓壍) => (<option key={剓壍} value={剓壍}>
              {HAVING_OP_LABEL[剓壍]}
            </option>))}
        </Select>
        {Array.isArray(鿫壍.value) ? (<>
            <鎦壍 value={鿫壍.value[0]} scale={湒壍} label="From" onCommit={(煂壍) => 礟壍({ value: [煂壍, (鿫壍.value as [
                    number,
                    number
                ])[1]] })}/>
            <span className="text-xs text-muted-3">and</span>
            <鎦壍 value={鿫壍.value[1]} scale={湒壍} label="To" onCommit={(週壍) => 礟壍({ value: [(鿫壍.value as [
                    number,
                    number
                ])[0], 週壍] })}/>
          </>) : (<鎦壍 value={鿫壍.value} scale={湒壍} label="Value" onCommit={(崠壍) => 礟壍({ value: 崠壍 })}/>)}
        <span className="w-6 font-mono text-meta text-faint">{赁壍}</span>
        <IconButton label="Remove condition" onClick={() => 墸壍({ type: "removeHaving", index: 胼壍 })}>
          ×
        </IconButton>
      </div>
      {!娰壍.ok ? <p className="m-0 text-xs text-warn">▲ {娰壍.reason}</p> : null}
    </div>);
}
const 簏壍 = [10, 25, 100, 1000];
export function SortStep({ nb: 髾壍 }: {
    nb: NotebookCtx;
}) {
    const { spec: 柭壍, catalog: 蛜壍, dispatch: 友壍 } = 髾壍;
    const 犺壍 = sortableKeys(柭壍);
    const 醩壍 = 柭壍.sort ?? [];
    const 庘壍 = (綇壍: typeof 醩壍) => 友壍({ type: "setSort", sort: 綇壍 });
    const 鱶壍 = 犺壍.filter((楥壍) => !醩壍.some((衔壍) => 衔壍.key === 楥壍));
    const 啃壍 = 柭壍.dimensions.find((琲壍) => 蛜壍.dimensions.find((錡壍) => 錡壍.key === 琲壍)?.kind === "time");
    const 怐壍 = 啃壍 ? `${sortKeyLabel(蛜壍, 啃壍)} ↑` : 柭壍.metrics[0] ? `${sortKeyLabel(蛜壍, 柭壍.metrics[0])} ↓` : "—";
    return (<>
      <div className="flex flex-col gap-2">
        <span className="label-mono">Sort</span>
        {醩壍.length ? (醩壍.map((绿壍, 鷮壍) => (<div key={绿壍.key} className="flex flex-wrap items-center gap-2">
              <span className="w-5 font-mono text-micro text-faint">{鷮壍 + 1}.</span>
              <Select aria-label={`Sort key ${鷮壍 + 1}`} value={绿壍.key} onChange={(櫝壍) => 庘壍(醩壍.map((觌壍, 嚻壍) => (嚻壍 === 鷮壍 ? { ...觌壍, key: 櫝壍.target.value } : 觌壍)))} className="min-w-0 flex-1 py-2">
                {[绿壍.key, ...鱶壍].map((疪壍) => (<option key={疪壍} value={疪壍}>
                    {sortKeyLabel(蛜壍, 疪壍)}
                  </option>))}
              </Select>
              <Segmented ariaLabel={`Sort direction ${鷮壍 + 1}`} value={绿壍.dir} onChange={(钙壍) => 庘壍(醩壍.map((憈壍, 職壍) => (職壍 === 鷮壍 ? { ...憈壍, dir: 钙壍 } : 憈壍)))} options={[
                { value: "desc", label: "↓ Desc", title: "Descending (high to low, Z to A)" },
                { value: "asc", label: "↑ Asc", title: "Ascending (low to high, A to Z)" },
            ]}/>
              <IconButton label="Remove sort" onClick={() => 庘壍(醩壍.filter((齦壍, 汕壍) => 汕壍 !== 鷮壍))}>
                ×
              </IconButton>
            </div>))) : (<span className="text-xs text-muted-3">Default order: {怐壍}</span>)}
        <AddRow disabled={醩壍.length >= MAX_SORT || !鱶壍.length} onClick={() => 鱶壍[0] && 庘壍([...醩壍, { key: 鱶壍[0], dir: 蛜壍.dimensions.some((譄壍) => 譄壍.key === 鱶壍[0]) ? "asc" : "desc" }])}>
          Add sort
        </AddRow>
      </div>
      <div className="flex flex-col gap-2">
        <span className="label-mono">Row limit</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <DraftInput value={柭壍.limit !== undefined ? String(柭壍.limit) : ""} placeholder="1,000" inputMode="numeric" aria-label="Row limit" className="w-24 py-2 tabular" onCommit={(堳壍) => {
            const 眢壍 = 裙壍(堳壍);
            友壍({ type: "setLimit", limit: 眢壍 === null ? undefined : 眢壍 });
        }}/>
          {簏壍.map((阑壍) => (<button key={阑壍} type="button" aria-pressed={柭壍.limit === 阑壍} onClick={() => 友壍({ type: "setLimit", limit: 柭壍.limit === 阑壍 ? undefined : 阑壍 })} className={cn("rounded-pill border px-3 py-1.5 font-mono text-meta transition-colors", 柭壍.limit === 阑壍 ? "border-accent bg-teal-t text-fg" : "border-line text-muted hover:text-fg")}>
              {阑壍.toLocaleString("en-US")}
            </button>))}
          <span className="text-xs text-faint">max 10,000</span>
        </div>
      </div>
      <Switch checked={柭壍.totals !== false} onChange={(挀壍) => 友壍({ type: "setTotals", totals: 挀壍 })} label="Totals row (ratio of sums over every matching row)"/>
    </>);
}
const 臯壍 = "rounded-pill border px-3 py-1.5 text-xs transition-colors";
function 仞壍(淍壍: NotebookCtx): DateRange | null {
    const 貼壍 = 淍壍.spec.dateRange ?? 淍壍.pageRange;
    if ("start" in 貼壍)
        return 貼壍.start <= 貼壍.end ? { start: 貼壍.start, end: 貼壍.end } : { start: 貼壍.end, end: 貼壍.start };
    return 淍壍.today ? resolvePreset(貼壍.preset, 淍壍.today, 貼壍.includeToday) : null;
}
export function DateStep({ nb: 妫壍 }: {
    nb: NotebookCtx;
}) {
    const { spec: 碚壍, catalog: 鞉壍, dispatch: 摸壍 } = 妫壍;
    const 荧壍 = 碚壍.dateRange && "start" in 碚壍.dateRange ? 碚壍.dateRange : null;
    const 偖壍 = !!荧壍;
    const [潅壍, 踴壍] = useState(false);
    const [嬣壍, 稒壍] = useState<{
        from: string;
        to: string;
    } | null>(null);
    const 餁壍 = 嬣壍?.from ?? 荧壍?.start ?? "";
    const 旰壍 = 嬣壍?.to ?? 荧壍?.end ?? "";
    const 蓟壍 = 碚壍.dateRange && "preset" in 碚壍.dateRange ? 碚壍.dateRange : null;
    const 凎壍 = 仞壍(妫壍);
    const 炽壍 = 凎壍 ? compareRange(凎壍, 碚壍.compare) : null;
    return (<>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Date range">
        <button type="button" aria-pressed={!碚壍.dateRange} onClick={() => 摸壍({ type: "setDateRange", dateRange: undefined })} className={cn(臯壍, !碚壍.dateRange ? "border-accent bg-teal-t text-fg" : "border-line text-muted hover:text-fg")}>
          Page range <span className="font-mono text-micro text-muted-3">· {妫壍.pageRangeLabel}</span>
        </button>
        {鞉壍.presets.map((辬壍) => {
            const 岛壍 = 蓟壍?.preset === 辬壍.key;
            return (<button key={辬壍.key} type="button" aria-pressed={岛壍} onClick={() => 摸壍({ type: "setDateRange", dateRange: { preset: 辬壍.key as DatePreset, ...(蓟壍?.includeToday ? { includeToday: true } : {}) } })} className={cn(臯壍, 岛壍 ? "border-accent bg-teal-t text-fg" : "border-line text-muted hover:text-fg")}>
              {辬壍.label}
            </button>);
        })}
        <button type="button" aria-pressed={偖壍 || 潅壍} onClick={() => 踴壍((箊壍) => !箊壍)} className={cn(臯壍, 偖壍 ? "border-accent bg-teal-t text-fg" : "border-dashed border-line text-muted hover:text-fg")}>
          Custom…
        </button>
      </div>
      {潅壍 || 偖壍 ? (<div className="flex flex-wrap items-center gap-2">
          <Input variant="field" type="date" value={餁壍} max={妫壍.dataThrough} onChange={(驹壍) => 稒壍({ from: 驹壍.target.value, to: 旰壍 })} aria-label="From" className="py-2"/>
          <span className="text-xs text-muted-3">to</span>
          <Input variant="field" type="date" value={旰壍} max={妫壍.dataThrough} onChange={(杨壍) => 稒壍({ from: 餁壍, to: 杨壍.target.value })} aria-label="To" className="py-2"/>
          <Button variant="accent" size="xs" disabled={!餁壍 || !旰壍 || !嬣壍} onClick={() => {
                摸壍({ type: "setDateRange", dateRange: 餁壍 <= 旰壍 ? { start: 餁壍, end: 旰壍 } : { start: 旰壍, end: 餁壍 } });
                稒壍(null);
            }}>
            Apply
          </Button>
        </div>) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-3">
        <span>
          <span className="label-mono mr-2">Dates</span>
          {凎壍 ? resolvedRangeLabel(凎壍, 妫壍.today) : dateRangeLabel(碚壍.dateRange)}
          {!碚壍.dateRange ? " · follows the top bar" : ""}
        </span>
        {蓟壍 ? <Switch checked={!!蓟壍.includeToday} onChange={(虗壍) => 摸壍({ type: "setDateRange", dateRange: { preset: 蓟壍.preset, ...(虗壍 ? { includeToday: true } : {}) } })} label="Include today (partial)"/> : null}
      </div>
      <div className="flex flex-col gap-2">
        <span className="label-mono">Compare</span>
        <Segmented ariaLabel="Compare with" variant="sans" value={碚壍.compare} onChange={(卆壍) => 摸壍({ type: "setCompare", compare: 卆壍 as CompareMode })} options={(["none", "previous_period", "previous_year"] as const).map((爵壍) => ({ value: 爵壍, label: 爵壍 === "none" ? "Off" : 爵壍 === "previous_period" ? "Previous period" : "Previous year" }))} className="self-start"/>
        {炽壍 ? <span className="text-xs text-muted-3">{`${COMPARE_LABEL[碚壍.compare]}: ${resolvedRangeLabel(炽壍, 妫壍.today)} · adds Δ columns and a dashed previous line`}</span> : null}
      </div>
    </>);
}
