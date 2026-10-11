"use client";
import { useMemo, useState } from "react";
import { Checkbox, Chip } from "@/components/ui/controls";
import { Input } from "@/components/ui/inputs";
import { Popover } from "@/components/ui/overlays";
import { useQueryResult } from "@/lib/api/hooks";
import { CAMPAIGN_STATUSES, CAMPAIGN_TYPES, DEVICES, type CampaignType } from "@/lib/domain/types";
import { SavedViews } from "./saved-views";
import { serializeCrossFilters, type ResolvedFilters } from "@/lib/filters";
const 坜壍: Record<string, string> = { campaign_type: "Type", campaign: "Campaign", campaign_status: "Status", device: "Device", country: "Country", platform: "Platform", match_type: "Match type" };
const 癋壍: CampaignType[] = ["Search", "PMax", "Shopping", "Video", "Display", "Demand Gen"];
function Cmp36(戩壍: string[]): CampaignType[] {
    const 脘壍 = useQueryResult({ source: "google_ads", metrics: ["cost"], dimensions: ["campaign_type"], dateRange: { preset: "last_90d" }, compare: "none" });
    return useMemo(() => {
        const 万壍 = new Set<string>((脘壍.data?.rows ?? []).map((泶壍) => String(泶壍.campaign_type)));
        if (!脘壍.data)
            癋壍.forEach((该壍) => 万壍.add(该壍));
        戩壍.forEach((壔壍) => 万壍.add(壔壍));
        return CAMPAIGN_TYPES.filter((矃壍) => 万壍.has(矃壍));
    }, [脘壍.data, 戩壍]);
}
export function FilterBar({ filters: 隲壍 }: {
    filters: ResolvedFilters & {
        set: (採壍: Record<string, unknown>) => unknown;
    };
}) {
    const 芐壍 = 隲壍.types;
    const 使壍 = Cmp36(芐壍);
    const 湮壍 = (赝壍: CampaignType | "All", 婌壍: React.MouseEvent) => {
        if (赝壍 === "All")
            return void 隲壍.set({ types: null });
        const 礻壍 = 婌壍.metaKey || 婌壍.ctrlKey || 婌壍.shiftKey;
        let 頪壍: string[];
        if (礻壍)
            頪壍 = 芐壍.includes(赝壍) ? 芐壍.filter((攙壍) => 攙壍 !== 赝壍) : [...芐壍, 赝壍];
        else
            頪壍 = 芐壍.length === 1 && 芐壍[0] === 赝壍 ? [] : [赝壍];
        void 隲壍.set({ types: 頪壍.length ? 頪壍 : null });
    };
    const 萈壍 = (僷壍: number) => {
        const 濦壍 = 隲壍.crossFilters.filter((軕壍, 寄壍) => 寄壍 !== 僷壍);
        void 隲壍.set({ xf: serializeCrossFilters(濦壍) });
    };
    const 窳壍 = 芐壍.length > 0 || 隲壍.crossFilters.length > 0 || 隲壍.campaigns.length > 0 || 隲壍.statuses.length > 0 || 隲壍.devices.length > 0;
    return (<div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Dashboard filters">
      <span className="mr-1.5 font-mono text-meta tracking-meta text-faint uppercase">Filter</span>
      <Chip active={芐壍.length === 0} onClick={(馢壍) => 湮壍("All", 馢壍)}>
        All
      </Chip>
      {使壍.map((暑壍) => (<Chip key={暑壍} active={芐壍.includes(暑壍)} onClick={(薀壍) => 湮壍(暑壍, 薀壍)} title="⌘/⇧-click to combine types">
          {暑壍}
        </Chip>))}
      {隲壍.crossFilters.map((副壍, 煞壍) => (<span key={`${副壍.dim}-${煞壍}`} className="inline-flex items-center gap-1.5 rounded-pill border border-teal/30 bg-teal-t py-1 pr-1 pl-3 text-xs text-fg">
          <span className="font-mono text-micro tracking-label text-muted-3 uppercase">{坜壍[副壍.dim] ?? 副壍.dim}</span>
          <span>{`${副壍.exclude ? "not " : ""}${副壍.values.join(", ")}`}</span>
          <button type="button" aria-label={`Remove filter ${坜壍[副壍.dim] ?? 副壍.dim} ${副壍.values.join(", ")}`} onClick={() => 萈壍(煞壍)} className="grid size-5 place-items-center rounded-full text-muted hover:bg-fill hover:text-fg">
            ×
          </button>
        </span>))}
      <span className="mx-1 h-5 w-px bg-line" aria-hidden/>
      <Cmp37 selected={隲壍.campaigns} onChange={(遍壍) => void 隲壍.set({ camps: 遍壍.length ? 遍壍 : null })}/>
      <缛壍 label="Status" options={[...CAMPAIGN_STATUSES].filter((崼壍) => 崼壍 !== "Removed")} selected={隲壍.statuses} onChange={(簫壍) => void 隲壍.set({ status: 簫壍.length ? 簫壍 : null })}/>
      <缛壍 label="Device" options={[...DEVICES]} selected={隲壍.devices} onChange={(鬚壍) => void 隲壍.set({ device: 鬚壍.length ? 鬚壍 : null })}/>
      {窳壍 ? (<button type="button" onClick={() => void 隲壍.set({ types: null, xf: null, camps: null, status: null, device: null })} className="ml-1 text-xs text-muted-3 hover:text-fg">
          Clear all
        </button>) : null}
      <span className="flex-1"/>
      <SavedViews />
    </div>);
}
function 栉壍({ label: 蛸壍, selected: 叧壍, ref: 狖壍, ...釅壍 }: {
    label: string;
    selected: string[];
    ref?: React.Ref<HTMLButtonElement>;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (<button ref={狖壍} type="button" {...釅壍} className={`inline-flex items-center gap-1.5 rounded-pill border px-3.5 py-1.5 text-xs whitespace-nowrap transition-colors ${叧壍.length ? "border-accent bg-teal-t text-fg" : "border-line text-muted hover:border-tone/25 hover:text-fg"}`}>
      {蛸壍}
      {叧壍.length ? <span className="font-mono text-meta text-accent">{叧壍.length === 1 ? `· ${叧壍[0]}` : `· ${叧壍.length}`}</span> : null}
      <span aria-hidden className="text-faint">▾</span>
    </button>);
}
function 庴壍({ options, selected: 綣壍, onChange: 鲒壍, empty: 榁壍 }: {
    options: {
        value: string;
        label: string;
        meta?: string;
    }[];
    selected: string[];
    onChange: (衰壍: string[]) => void;
    empty?: string;
}) {
    const 啟壍 = (瑎壍: string) => 鲒壍(綣壍.includes(瑎壍) ? 綣壍.filter((錽壍) => 錽壍 !== 瑎壍) : [...綣壍, 瑎壍]);
    return (<div className="flex max-h-72 flex-col overflow-y-auto">
      {options.length === 0 ? <span className="px-2 py-3 text-xs text-muted-3">{榁壍 ?? "Nothing to pick."}</span> : null}
      {options.map((怬壍) => (<label key={怬壍.value} className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-[13px] hover:bg-fill">
          <Checkbox checked={綣壍.includes(怬壍.value)} onChange={() => 啟壍(怬壍.value)} ariaLabel={怬壍.label}/>
          <span className="min-w-0 flex-1 truncate">{怬壍.label}</span>
          {怬壍.meta ? <span className="font-mono text-micro text-faint">{怬壍.meta}</span> : null}
        </label>))}
    </div>);
}
function 缛壍({ label: 鸊壍, options, selected: 櫹壍, onChange: 觨壍 }: {
    label: string;
    options: string[];
    selected: string[];
    onChange: (囗壍: string[]) => void;
}) {
    return (<Popover align="start" trigger={<栉壍 label={鸊壍} selected={櫹壍}/>}>
      <div className="flex w-56 flex-col gap-1 p-1.5">
        <庴壍 options={options.map((痆壍) => ({ value: 痆壍, label: 痆壍 }))} selected={櫹壍} onChange={觨壍}/>
        {櫹壍.length ? (<button type="button" onClick={() => 觨壍([])} className="self-start px-2 py-1 text-xs text-muted-3 hover:text-fg">
            Clear
          </button>) : null}
      </div>
    </Popover>);
}
function Cmp37({ selected: 憤壍, onChange: 肓壍 }: {
    selected: string[];
    onChange: (龂壍: string[]) => void;
}) {
    const [汱壍, 譠壍] = useState("");
    const 塏壍 = useQueryResult({ source: "google_ads", metrics: ["cost"], dimensions: ["campaign", "campaign_type"], dateRange: { preset: "last_90d" }, compare: "none", sort: [{ key: "cost", dir: "desc" }] });
    const 眾壍 = (塏壍.data?.rows ?? []).map((阭壍) => ({ value: String(阭壍.campaign), label: String(阭壍.campaign), meta: String(阭壍.campaign_type ?? "") })).filter((挜壍) => !汱壍 || 挜壍.label.toLowerCase().includes(汱壍.toLowerCase()));
    return (<Popover align="start" trigger={<栉壍 label="Campaigns" selected={憤壍}/>}>
      <div className="flex w-80 flex-col gap-1.5 p-1.5">
        <Input value={汱壍} onChange={(舋壍) => 譠壍(舋壍.target.value)} placeholder="Search campaigns…" aria-label="Search campaigns" className="py-2 text-[13px]"/>
        <庴壍 options={眾壍} selected={憤壍} onChange={肓壍} empty={塏壍.data ? "No campaigns match." : "Loading…"}/>
        {憤壍.length ? (<button type="button" onClick={() => 肓壍([])} className="self-start px-2 py-1 text-xs text-muted-3 hover:text-fg">
            Clear
          </button>) : null}
      </div>
    </Popover>);
}
