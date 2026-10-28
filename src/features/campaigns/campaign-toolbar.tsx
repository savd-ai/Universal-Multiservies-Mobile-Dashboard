"use client";
import { Button } from "@/components/ui/button";
import { Checkbox, Chip, Segmented } from "@/components/ui/controls";
import { Popover } from "@/components/ui/overlays";
import { CAMPAIGN_TYPES, type CampaignType } from "@/lib/domain/types";
import { CAMPAIGN_COLUMNS, DEFAULT_COLUMNS, type ColumnKey } from "./campaign-utils";
import type { Density } from "./campaign-table";
const PROTOTYPE_TYPES: CampaignType[] = ["Search", "PMax", "Shopping", "Video", "Display", "Demand Gen"];
export function availableTypes(rowTypes: readonly string[] | null, selected: readonly string[]): CampaignType[] {
    const present = new Set<string>(rowTypes ?? PROTOTYPE_TYPES);
    selected.forEach((t) => present.add(t));
    return CAMPAIGN_TYPES.filter((t) => present.has(t));
}
export function TypeChips({ types, selected, onChange }: {
    types: readonly CampaignType[];
    selected: readonly string[];
    onChange: (next: string[]) => void;
}) {
    const pick = (t: CampaignType, e: React.MouseEvent) => {
        const multi = e.metaKey || e.ctrlKey || e.shiftKey;
        if (multi)
            onChange(selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t]);
        else
            onChange(selected.length === 1 && selected[0] === t ? [] : [t]);
    };
    return (<div className="flex flex-wrap items-center gap-2" role="group" aria-label="Campaign type">
      <Chip active={selected.length === 0} onClick={() => onChange([])}>
        All
      </Chip>
      {types.map((t) => (<Chip key={t} active={selected.includes(t)} onClick={(e) => pick(t, e)} title="⌘/⇧-click to combine types">
          {t}
        </Chip>))}
    </div>);
}
type StatusOption = "All" | "Enabled" | "Paused" | "Removed";
export function StatusFilter({ selected, showRemoved, onChange }: {
    selected: readonly string[];
    showRemoved: boolean;
    onChange: (next: string[]) => void;
}) {
    const value: StatusOption = selected.length === 1 && ["Enabled", "Paused", "Removed"].includes(selected[0] as string) ? (selected[0] as StatusOption) : "All";
    const options: {
        value: StatusOption;
        label: string;
    }[] = [
        { value: "All", label: "All" },
        { value: "Enabled", label: "Enabled" },
        { value: "Paused", label: "Paused" },
        ...(showRemoved || value === "Removed" ? [{ value: "Removed" as const, label: "Removed" }] : []),
    ];
    return <Segmented ariaLabel="Campaign status" variant="sans" options={options} value={value} onChange={(v) => onChange(v === "All" ? [] : [v])}/>;
}
export function ColumnChooser({ visible, onChange }: {
    visible: readonly ColumnKey[];
    onChange: (next: ColumnKey[]) => void;
}) {
    const toggle = (key: ColumnKey, on: boolean) => {
        const value = new Set(visible);
        if (on)
            value.add(key);
        else
            value.delete(key);
        onChange(CAMPAIGN_COLUMNS.filter((c) => c.locked || value.has(c.key)).map((c) => c.key));
    };
    const isDefault = visible.length === DEFAULT_COLUMNS.length && DEFAULT_COLUMNS.every((k) => visible.includes(k));
    return (<Popover align="end" trigger={<Button variant="ghost" size="sm">
          Columns <span aria-hidden>▾</span>
        </Button>}>
      <div className="flex w-[220px] flex-col" role="group" aria-label="Visible columns">
        <span className="px-2.5 pt-1.5 pb-1 label-mono">Visible columns</span>
        {CAMPAIGN_COLUMNS.filter((c) => !c.locked).map((c) => (<label key={c.key} className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] select-none hover:bg-fill">
            <Checkbox checked={visible.includes(c.key)} onChange={(on) => toggle(c.key, on)} ariaLabel={c.label}/>
            <span className="flex-1">{c.label}</span>
            {!c.defaultOn ? <span className="font-mono text-micro text-faint">extra</span> : null}
          </label>))}
        <div className="my-1 h-px bg-line"/>
        <button type="button" disabled={isDefault} onClick={() => onChange(DEFAULT_COLUMNS)} className="rounded-[8px] px-2.5 py-2 text-left text-[13px] text-muted hover:bg-fill hover:text-fg disabled:opacity-40">
          Reset to default
        </button>
      </div>
    </Popover>);
}
export function DensityToggle({ value, onChange }: {
    value: Density;
    onChange: (v: Density) => void;
}) {
    return (<Segmented ariaLabel="Row density" options={[
            { value: "comfortable", label: "Comfortable" },
            { value: "compact", label: "Compact" },
        ]} value={value} onChange={onChange}/>);
}
