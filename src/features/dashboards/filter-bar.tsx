"use client";
import { useMemo, useState } from "react";
import { Checkbox, Chip } from "@/components/ui/controls";
import { Input } from "@/components/ui/inputs";
import { Popover } from "@/components/ui/overlays";
import { useQueryResult } from "@/lib/api/hooks";
import { CAMPAIGN_STATUSES, CAMPAIGN_TYPES, DEVICES, type CampaignType } from "@/lib/domain/types";
import { SavedViews } from "./saved-views";
import { serializeCrossFilters, type ResolvedFilters } from "@/lib/filters";
const DIM_LABEL: Record<string, string> = { campaign_type: "Type", campaign: "Campaign", campaign_status: "Status", device: "Device", country: "Country", platform: "Platform", match_type: "Match type" };
const PROTOTYPE_TYPES: CampaignType[] = ["Search", "PMax", "Shopping", "Video", "Display", "Demand Gen"];
function useAccountTypes(selected: string[]): CampaignType[] {
    const q = useQueryResult({ source: "google_ads", metrics: ["cost"], dimensions: ["campaign_type"], dateRange: { preset: "last_90d" }, compare: "none" });
    return useMemo(() => {
        const present = new Set<string>((q.data?.rows ?? []).map((r) => String(r.campaign_type)));
        if (!q.data)
            PROTOTYPE_TYPES.forEach((t) => present.add(t));
        selected.forEach((t) => present.add(t));
        return CAMPAIGN_TYPES.filter((t) => present.has(t));
    }, [q.data, selected]);
}
export function FilterBar({ filters }: {
    filters: ResolvedFilters & {
        set: (v: Record<string, unknown>) => unknown;
    };
}) {
    const types = filters.types;
    const available = useAccountTypes(types);
    const pick = (t: CampaignType | "All", e: React.MouseEvent) => {
        if (t === "All")
            return void filters.set({ types: null });
        const multi = e.metaKey || e.ctrlKey || e.shiftKey;
        let next: string[];
        if (multi)
            next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t];
        else
            next = types.length === 1 && types[0] === t ? [] : [t];
        void filters.set({ types: next.length ? next : null });
    };
    const removeCross = (i: number) => {
        const next = filters.crossFilters.filter((_, j) => j !== i);
        void filters.set({ xf: serializeCrossFilters(next) });
    };
    const hasAny = types.length > 0 || filters.crossFilters.length > 0 || filters.campaigns.length > 0 || filters.statuses.length > 0 || filters.devices.length > 0;
    return (<div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Dashboard filters">
      <span className="mr-1.5 font-mono text-meta tracking-meta text-faint uppercase">Filter</span>
      <Chip active={types.length === 0} onClick={(e) => pick("All", e)}>
        All
      </Chip>
      {available.map((t) => (<Chip key={t} active={types.includes(t)} onClick={(e) => pick(t, e)} title="⌘/⇧-click to combine types">
          {t}
        </Chip>))}
      {filters.crossFilters.map((c, i) => (<span key={`${c.dim}-${i}`} className="inline-flex items-center gap-1.5 rounded-pill border border-teal/30 bg-teal-t py-1 pr-1 pl-3 text-xs text-fg">
          <span className="font-mono text-micro tracking-label text-muted-3 uppercase">{DIM_LABEL[c.dim] ?? c.dim}</span>
          <span>{`${c.exclude ? "not " : ""}${c.values.join(", ")}`}</span>
          <button type="button" aria-label={`Remove filter ${DIM_LABEL[c.dim] ?? c.dim} ${c.values.join(", ")}`} onClick={() => removeCross(i)} className="grid size-5 place-items-center rounded-full text-muted hover:bg-fill hover:text-fg">
            ×
          </button>
        </span>))}
      <span className="mx-1 h-5 w-px bg-line" aria-hidden/>
      <CampaignSlicer selected={filters.campaigns} onChange={(v) => void filters.set({ camps: v.length ? v : null })}/>
      <ListSlicer label="Status" options={[...CAMPAIGN_STATUSES].filter((x) => x !== "Removed")} selected={filters.statuses} onChange={(v) => void filters.set({ status: v.length ? v : null })}/>
      <ListSlicer label="Device" options={[...DEVICES]} selected={filters.devices} onChange={(v) => void filters.set({ device: v.length ? v : null })}/>
      {hasAny ? (<button type="button" onClick={() => void filters.set({ types: null, xf: null, camps: null, status: null, device: null })} className="ml-1 text-xs text-muted-3 hover:text-fg">
          Clear all
        </button>) : null}
      <span className="flex-1"/>
      <SavedViews />
    </div>);
}
function SlicerButton({ label, selected, ref, ...rest }: {
    label: string;
    selected: string[];
    ref?: React.Ref<HTMLButtonElement>;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (<button ref={ref} type="button" {...rest} className={`inline-flex items-center gap-1.5 rounded-pill border px-3.5 py-1.5 text-xs whitespace-nowrap transition-colors ${selected.length ? "border-accent bg-teal-t text-fg" : "border-line text-muted hover:border-tone/25 hover:text-fg"}`}>
      {label}
      {selected.length ? <span className="font-mono text-meta text-accent">{selected.length === 1 ? `· ${selected[0]}` : `· ${selected.length}`}</span> : null}
      <span aria-hidden className="text-faint">▾</span>
    </button>);
}
function Checklist({ options, selected, onChange, empty }: {
    options: {
        value: string;
        label: string;
        meta?: string;
    }[];
    selected: string[];
    onChange: (v: string[]) => void;
    empty?: string;
}) {
    const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
    return (<div className="flex max-h-72 flex-col overflow-y-auto">
      {options.length === 0 ? <span className="px-2 py-3 text-xs text-muted-3">{empty ?? "Nothing to pick."}</span> : null}
      {options.map((o) => (<label key={o.value} className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-[13px] hover:bg-fill">
          <Checkbox checked={selected.includes(o.value)} onChange={() => toggle(o.value)} ariaLabel={o.label}/>
          <span className="min-w-0 flex-1 truncate">{o.label}</span>
          {o.meta ? <span className="font-mono text-micro text-faint">{o.meta}</span> : null}
        </label>))}
    </div>);
}
function ListSlicer({ label, options, selected, onChange }: {
    label: string;
    options: string[];
    selected: string[];
    onChange: (v: string[]) => void;
}) {
    return (<Popover align="start" trigger={<SlicerButton label={label} selected={selected}/>}>
      <div className="flex w-56 flex-col gap-1 p-1.5">
        <Checklist options={options.map((o) => ({ value: o, label: o }))} selected={selected} onChange={onChange}/>
        {selected.length ? (<button type="button" onClick={() => onChange([])} className="self-start px-2 py-1 text-xs text-muted-3 hover:text-fg">
            Clear
          </button>) : null}
      </div>
    </Popover>);
}
function CampaignSlicer({ selected, onChange }: {
    selected: string[];
    onChange: (v: string[]) => void;
}) {
    const [q, setQ] = useState("");
    const list = useQueryResult({ source: "google_ads", metrics: ["cost"], dimensions: ["campaign", "campaign_type"], dateRange: { preset: "last_90d" }, compare: "none", sort: [{ key: "cost", dir: "desc" }] });
    const options = (list.data?.rows ?? []).map((r) => ({ value: String(r.campaign), label: String(r.campaign), meta: String(r.campaign_type ?? "") })).filter((o) => !q || o.label.toLowerCase().includes(q.toLowerCase()));
    return (<Popover align="start" trigger={<SlicerButton label="Campaigns" selected={selected}/>}>
      <div className="flex w-80 flex-col gap-1.5 p-1.5">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search campaigns…" aria-label="Search campaigns" className="py-2 text-[13px]"/>
        <Checklist options={options} selected={selected} onChange={onChange} empty={list.data ? "No campaigns match." : "Loading…"}/>
        {selected.length ? (<button type="button" onClick={() => onChange([])} className="self-start px-2 py-1 text-xs text-muted-3 hover:text-fg">
            Clear
          </button>) : null}
      </div>
    </Popover>);
}
