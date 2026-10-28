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
const KIND_NAME: Record<string, string> = { time: "Time", entity: "Entity", category: "Category" };
function DimensionOptions({ nb, index }: {
    nb: NotebookCtx;
    index?: number;
}) {
    const { catalog, spec } = nb;
    return (<>
      {["time", "entity", "category"].map((kind) => (<optgroup key={kind} label={KIND_NAME[kind]}>
          {catalog.dimensions
                .filter((d) => d.kind === kind)
                .map((d) => {
                const avail = dimensionAvailability(catalog, spec, d.key, { asFilter: true, ignoreFilter: index });
                const current = index !== undefined && spec.filters[index]?.dim === d.key;
                return (<option key={d.key} value={d.key} disabled={!avail.ok && !current} title={avail.reason}>
                  {d.label}
                  {!avail.ok && !current ? " — unavailable" : ""}
                </option>);
            })}
        </optgroup>))}
    </>);
}
export function firstFilterDim(nb: NotebookCtx): DimensionKey {
    const prefer = nb.spec.source === "google_ads" ? ["campaign_type", "campaign", "device", "country", "campaign_status"] : ["platform", "platform_campaign"];
    for (const d of prefer)
        if (dimensionAvailability(nb.catalog, nb.spec, d, { asFilter: true }).ok)
            return d as DimensionKey;
    return (nb.catalog.dimensions.find((d) => dimensionAvailability(nb.catalog, nb.spec, d.key, { asFilter: true }).ok)?.key ?? "date") as DimensionKey;
}
export function FiltersStep({ nb }: {
    nb: NotebookCtx;
}) {
    const { spec, dispatch } = nb;
    return (<>
      {spec.filters.map((f, i) => (<FilterRow key={`${i}-${f.dim}`} nb={nb} index={i} filter={f}/>))}
      <AddRow disabled={spec.filters.length >= MAX_FILTERS} onClick={() => dispatch({ type: "addFilter", filter: { dim: firstFilterDim(nb), op: "in", value: [] } })}>
        Add filter
      </AddRow>
    </>);
}
function FilterRow({ nb, index, filter }: {
    nb: NotebookCtx;
    index: number;
    filter: QueryFilter;
}) {
    const { catalog, spec, dispatch } = nb;
    const avail = dimensionAvailability(catalog, spec, filter.dim, { asFilter: true, ignoreFilter: index });
    const def = catalog.dimensions.find((d) => d.key === filter.dim);
    const label = def?.label ?? filter.dim;
    const { values: suggestions, isLoading } = useDimensionValues(spec.source, filter.dim, spec.dateRange ?? nb.pageRange, { enabled: avail.ok, time: def?.kind === "time" });
    const update = (patch: Partial<QueryFilter>) => dispatch({ type: "updateFilter", index, patch });
    const multi = isMultiOp(filter.op);
    const values = (Array.isArray(filter.value) ? filter.value : [filter.value]).map(String).filter((v) => v !== "");
    return (<div className="flex flex-col gap-2.5 rounded-mini border border-tone/8 bg-fill p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Filter dimension" value={filter.dim} onChange={(e) => update({ dim: e.target.value as DimensionKey })} className="min-w-0 flex-1 py-2">
          <DimensionOptions nb={nb} index={index}/>
        </Select>
        <Select aria-label="Filter operator" value={filter.op} onChange={(e) => update({ op: e.target.value as QueryFilter["op"] })} className="py-2">
          {FILTER_OPS.map((op) => (<option key={op} value={op}>
              {FILTER_OP_LABEL[op]}
            </option>))}
        </Select>
        <IconButton label={`Remove the ${label} filter`} onClick={() => dispatch({ type: "removeFilter", index })}>
          ×
        </IconButton>
      </div>
      {multi ? (<MultiValues label={label} values={values} suggestions={suggestions} loading={isLoading && avail.ok} onChange={(next) => update({ value: next })}/>) : (<SingleValue label={label} op={filter.op} value={typeof filter.value === "string" || typeof filter.value === "number" ? String(filter.value) : (values[0] ?? "")} suggestions={suggestions} onChange={(v) => update({ value: v })}/>)}
      {!avail.ok ? <p className="m-0 text-xs text-warn">▲ {avail.reason}</p> : null}
    </div>);
}
function SuggestionChips({ items, onPick, loading }: {
    items: string[];
    onPick: (v: string) => void;
    loading?: boolean;
}) {
    if (loading)
        return <span className="text-xs text-faint">Loading values…</span>;
    if (!items.length)
        return null;
    return (<div className="flex flex-wrap gap-1.5" role="group" aria-label="Suggested values">
      {items.map((s) => (<button key={s} type="button" onClick={() => onPick(s)} className="max-w-[220px] truncate rounded-pill border border-dashed border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-teal/40 hover:text-accent" title={s}>
          + {s}
        </button>))}
    </div>);
}
function MultiValues({ label, values, suggestions, loading, onChange }: {
    label: string;
    values: string[];
    suggestions: string[];
    loading: boolean;
    onChange: (next: string[]) => void;
}) {
    const [text, setText] = useState("");
    const needle = text.trim().toLowerCase();
    const shown = suggestions.filter((s) => !values.includes(s) && (!needle || s.toLowerCase().includes(needle))).slice(0, 12);
    const add = (v: string) => {
        const t = v.trim();
        if (t && !values.includes(t))
            onChange([...values, t]);
        setText("");
    };
    return (<div className="flex flex-col gap-2">
      {values.length ? (<div className="flex flex-wrap gap-1.5">
          {values.map((v) => (<SelectedPill key={v} label={v} onRemove={() => onChange(values.filter((x) => x !== v))}/>))}
        </div>) : null}
      <Input variant="field" value={text} aria-label={`Add a ${label.toLowerCase()} value`} placeholder={values.length ? "Add another value…" : `Type a ${label.toLowerCase()} and press Enter`} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                add(text);
            }
            else if (e.key === "Backspace" && !text && values.length)
                onChange(values.slice(0, -1));
        }} className="py-2"/>
      <SuggestionChips items={shown} onPick={add} loading={loading && !suggestions.length}/>
    </div>);
}
function SingleValue({ label, op, value, suggestions, onChange }: {
    label: string;
    op: QueryFilter["op"];
    value: string;
    suggestions: string[];
    onChange: (v: string) => void;
}) {
    const exact = op === "eq" || op === "neq";
    const needle = value.trim().toLowerCase();
    const shown = exact ? suggestions.filter((s) => s !== value && (!needle || s.toLowerCase().includes(needle))).slice(0, 8) : [];
    return (<div className="flex flex-col gap-2">
      <DraftInput value={value} onCommit={onChange} aria-label={`${label} value`} placeholder={exact ? `Pick or type a ${label.toLowerCase()}` : "Text to match (case-insensitive)"} className="py-2"/>
      <SuggestionChips items={shown} onPick={onChange}/>
    </div>);
}
export function HavingStep({ nb }: {
    nb: NotebookCtx;
}) {
    const { spec, dispatch } = nb;
    return (<>
      <p className="m-0 text-xs leading-relaxed text-muted-3">Keeps only the rows whose aggregated value passes — e.g. search terms with spend but no conversions.</p>
      {spec.having.map((h, i) => (<HavingRow key={`${i}-${h.metric}`} nb={nb} index={i} having={h}/>))}
      <AddRow disabled={spec.having.length >= MAX_HAVING} onClick={() => dispatch({ type: "addHaving", having: { metric: spec.metrics[0] ?? "cost", op: "gt", value: 0 } })}>
        Add condition
      </AddRow>
    </>);
}
const parseNumber = (s: string): number | null => {
    const n = Number(s.replace(/[\s,$%x€£¥₫]/gi, ""));
    return s.trim() !== "" && Number.isFinite(n) ? n : null;
};
function NumberDraft({ value, scale, onCommit, label }: {
    value: number;
    scale: number;
    onCommit: (v: number) => void;
    label: string;
}) {
    return (<DraftInput value={String(+(value * scale).toFixed(6))} onCommit={(s) => {
            const n = parseNumber(s);
            if (n !== null)
                onCommit(n / scale);
        }} inputMode="decimal" aria-label={label} className="w-24 py-2 text-right tabular"/>);
}
function HavingRow({ nb, index, having }: {
    nb: NotebookCtx;
    index: number;
    having: QueryHaving;
}) {
    const { catalog, spec, dispatch, currency } = nb;
    const others = { ...spec, having: spec.having.filter((_, j) => j !== index) };
    const format = metricFormat(catalog, having.metric);
    const scale = havingScale(format);
    const unit = formatGlyph(format, currency);
    const avail = metricAvailability(catalog, others, having.metric);
    const update = (patch: Partial<QueryHaving>) => dispatch({ type: "updateHaving", index, patch });
    const groups = [
        { name: "Base", items: catalog.metrics.filter((m) => m.kind === "base") },
        { name: "Ratio", items: catalog.metrics.filter((m) => m.kind === "derived") },
        { name: "Custom", items: catalog.metrics.filter((m) => m.kind === "custom") },
    ];
    return (<div className="flex flex-col gap-2 rounded-mini border border-tone/8 bg-fill p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Condition metric" value={having.metric} onChange={(e) => update({ metric: e.target.value })} className="min-w-0 flex-1 py-2">
          {!catalog.metrics.some((m) => m.key === having.metric) ? <option value={having.metric}>{having.metric} (unknown)</option> : null}
          {groups.map((g) => g.items.length ? (<optgroup key={g.name} label={g.name}>
                {g.items.map((m) => {
                const ok = m.key === having.metric || metricAvailability(catalog, others, m.key).ok;
                return (<option key={m.key} value={m.key} disabled={!ok}>
                      {m.label}
                      {ok ? "" : " — unavailable"}
                    </option>);
            })}
              </optgroup>) : null)}
        </Select>
        <Select aria-label="Condition operator" value={having.op} onChange={(e) => update({ op: e.target.value as QueryHaving["op"] })} className="py-2">
          {HAVING_OPS.map((op) => (<option key={op} value={op}>
              {HAVING_OP_LABEL[op]}
            </option>))}
        </Select>
        {Array.isArray(having.value) ? (<>
            <NumberDraft value={having.value[0]} scale={scale} label="From" onCommit={(v) => update({ value: [v, (having.value as [
                    number,
                    number
                ])[1]] })}/>
            <span className="text-xs text-muted-3">and</span>
            <NumberDraft value={having.value[1]} scale={scale} label="To" onCommit={(v) => update({ value: [(having.value as [
                    number,
                    number
                ])[0], v] })}/>
          </>) : (<NumberDraft value={having.value} scale={scale} label="Value" onCommit={(v) => update({ value: v })}/>)}
        <span className="w-6 font-mono text-meta text-faint">{unit}</span>
        <IconButton label="Remove condition" onClick={() => dispatch({ type: "removeHaving", index })}>
          ×
        </IconButton>
      </div>
      {!avail.ok ? <p className="m-0 text-xs text-warn">▲ {avail.reason}</p> : null}
    </div>);
}
const LIMIT_PRESETS = [10, 25, 100, 1000];
export function SortStep({ nb }: {
    nb: NotebookCtx;
}) {
    const { spec, catalog, dispatch } = nb;
    const keys = sortableKeys(spec);
    const sort = spec.sort ?? [];
    const setSort = (next: typeof sort) => dispatch({ type: "setSort", sort: next });
    const unused = keys.filter((k) => !sort.some((s) => s.key === k));
    const time = spec.dimensions.find((d) => catalog.dimensions.find((x) => x.key === d)?.kind === "time");
    const defaultOrder = time ? `${sortKeyLabel(catalog, time)} ↑` : spec.metrics[0] ? `${sortKeyLabel(catalog, spec.metrics[0])} ↓` : "—";
    return (<>
      <div className="flex flex-col gap-2">
        <span className="label-mono">Sort</span>
        {sort.length ? (sort.map((s, i) => (<div key={s.key} className="flex flex-wrap items-center gap-2">
              <span className="w-5 font-mono text-micro text-faint">{i + 1}.</span>
              <Select aria-label={`Sort key ${i + 1}`} value={s.key} onChange={(e) => setSort(sort.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} className="min-w-0 flex-1 py-2">
                {[s.key, ...unused].map((k) => (<option key={k} value={k}>
                    {sortKeyLabel(catalog, k)}
                  </option>))}
              </Select>
              <Segmented ariaLabel={`Sort direction ${i + 1}`} value={s.dir} onChange={(dir) => setSort(sort.map((x, j) => (j === i ? { ...x, dir } : x)))} options={[
                { value: "desc", label: "↓ Desc", title: "Descending (high to low, Z to A)" },
                { value: "asc", label: "↑ Asc", title: "Ascending (low to high, A to Z)" },
            ]}/>
              <IconButton label="Remove sort" onClick={() => setSort(sort.filter((_, j) => j !== i))}>
                ×
              </IconButton>
            </div>))) : (<span className="text-xs text-muted-3">Default order: {defaultOrder}</span>)}
        <AddRow disabled={sort.length >= MAX_SORT || !unused.length} onClick={() => unused[0] && setSort([...sort, { key: unused[0], dir: catalog.dimensions.some((d) => d.key === unused[0]) ? "asc" : "desc" }])}>
          Add sort
        </AddRow>
      </div>
      <div className="flex flex-col gap-2">
        <span className="label-mono">Row limit</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <DraftInput value={spec.limit !== undefined ? String(spec.limit) : ""} placeholder="1,000" inputMode="numeric" aria-label="Row limit" className="w-24 py-2 tabular" onCommit={(s) => {
            const n = parseNumber(s);
            dispatch({ type: "setLimit", limit: n === null ? undefined : n });
        }}/>
          {LIMIT_PRESETS.map((n) => (<button key={n} type="button" aria-pressed={spec.limit === n} onClick={() => dispatch({ type: "setLimit", limit: spec.limit === n ? undefined : n })} className={cn("rounded-pill border px-3 py-1.5 font-mono text-meta transition-colors", spec.limit === n ? "border-accent bg-teal-t text-fg" : "border-line text-muted hover:text-fg")}>
              {n.toLocaleString("en-US")}
            </button>))}
          <span className="text-xs text-faint">max 10,000</span>
        </div>
      </div>
      <Switch checked={spec.totals !== false} onChange={(on) => dispatch({ type: "setTotals", totals: on })} label="Totals row (ratio of sums over every matching row)"/>
    </>);
}
const CHIP = "rounded-pill border px-3 py-1.5 text-xs transition-colors";
function resolveRange(nb: NotebookCtx): DateRange | null {
    const r = nb.spec.dateRange ?? nb.pageRange;
    if ("start" in r)
        return r.start <= r.end ? { start: r.start, end: r.end } : { start: r.end, end: r.start };
    return nb.today ? resolvePreset(r.preset, nb.today, r.includeToday) : null;
}
export function DateStep({ nb }: {
    nb: NotebookCtx;
}) {
    const { spec, catalog, dispatch } = nb;
    const pinned = spec.dateRange && "start" in spec.dateRange ? spec.dateRange : null;
    const custom = !!pinned;
    const [showCustom, setShowCustom] = useState(false);
    const [draft, setDraft] = useState<{
        from: string;
        to: string;
    } | null>(null);
    const result = draft?.from ?? pinned?.start ?? "";
    const to = draft?.to ?? pinned?.end ?? "";
    const preset = spec.dateRange && "preset" in spec.dateRange ? spec.dateRange : null;
    const range = resolveRange(nb);
    const cmp = range ? compareRange(range, spec.compare) : null;
    return (<>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Date range">
        <button type="button" aria-pressed={!spec.dateRange} onClick={() => dispatch({ type: "setDateRange", dateRange: undefined })} className={cn(CHIP, !spec.dateRange ? "border-accent bg-teal-t text-fg" : "border-line text-muted hover:text-fg")}>
          Page range <span className="font-mono text-micro text-muted-3">· {nb.pageRangeLabel}</span>
        </button>
        {catalog.presets.map((p) => {
            const on = preset?.preset === p.key;
            return (<button key={p.key} type="button" aria-pressed={on} onClick={() => dispatch({ type: "setDateRange", dateRange: { preset: p.key as DatePreset, ...(preset?.includeToday ? { includeToday: true } : {}) } })} className={cn(CHIP, on ? "border-accent bg-teal-t text-fg" : "border-line text-muted hover:text-fg")}>
              {p.label}
            </button>);
        })}
        <button type="button" aria-pressed={custom || showCustom} onClick={() => setShowCustom((v) => !v)} className={cn(CHIP, custom ? "border-accent bg-teal-t text-fg" : "border-dashed border-line text-muted hover:text-fg")}>
          Custom…
        </button>
      </div>
      {showCustom || custom ? (<div className="flex flex-wrap items-center gap-2">
          <Input variant="field" type="date" value={result} max={nb.dataThrough} onChange={(e) => setDraft({ from: e.target.value, to })} aria-label="From" className="py-2"/>
          <span className="text-xs text-muted-3">to</span>
          <Input variant="field" type="date" value={to} max={nb.dataThrough} onChange={(e) => setDraft({ from: result, to: e.target.value })} aria-label="To" className="py-2"/>
          <Button variant="accent" size="xs" disabled={!result || !to || !draft} onClick={() => {
                dispatch({ type: "setDateRange", dateRange: result <= to ? { start: result, end: to } : { start: to, end: result } });
                setDraft(null);
            }}>
            Apply
          </Button>
        </div>) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-3">
        <span>
          <span className="label-mono mr-2">Dates</span>
          {range ? resolvedRangeLabel(range, nb.today) : dateRangeLabel(spec.dateRange)}
          {!spec.dateRange ? " · follows the top bar" : ""}
        </span>
        {preset ? <Switch checked={!!preset.includeToday} onChange={(on) => dispatch({ type: "setDateRange", dateRange: { preset: preset.preset, ...(on ? { includeToday: true } : {}) } })} label="Include today (partial)"/> : null}
      </div>
      <div className="flex flex-col gap-2">
        <span className="label-mono">Compare</span>
        <Segmented ariaLabel="Compare with" variant="sans" value={spec.compare} onChange={(v) => dispatch({ type: "setCompare", compare: v as CompareMode })} options={(["none", "previous_period", "previous_year"] as const).map((c) => ({ value: c, label: c === "none" ? "Off" : c === "previous_period" ? "Previous period" : "Previous year" }))} className="self-start"/>
        {cmp ? <span className="text-xs text-muted-3">{`${COMPARE_LABEL[spec.compare]}: ${resolvedRangeLabel(cmp, nb.today)} · adds Δ columns and a dashed previous line`}</span> : null}
      </div>
    </>);
}
