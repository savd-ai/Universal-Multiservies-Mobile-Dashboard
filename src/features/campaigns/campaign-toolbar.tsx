"use client";
import { Button } from "@/components/ui/button";
import { Checkbox, Chip, Segmented } from "@/components/ui/controls";
import { Popover } from "@/components/ui/overlays";
import { CAMPAIGN_TYPES, type CampaignType } from "@/lib/domain/types";
import { CAMPAIGN_COLUMNS, DEFAULT_COLUMNS, type ColumnKey } from "./campaign-utils";
import type { Density } from "./campaign-table";
const 斌壍: CampaignType[] = ["Search", "PMax", "Shopping", "Video", "Display", "Demand Gen"];
export function availableTypes(葻壍: readonly string[] | null, 兪壍: readonly string[]): CampaignType[] {
    const 灙壍 = new Set<string>(葻壍 ?? 斌壍);
    兪壍.forEach((轈壍) => 灙壍.add(轈壍));
    return CAMPAIGN_TYPES.filter((尷壍) => 灙壍.has(尷壍));
}
export function TypeChips({ types: 符壍, selected: 騕壍, onChange: 朄壍 }: {
    types: readonly CampaignType[];
    selected: readonly string[];
    onChange: (藳壍: string[]) => void;
}) {
    const 勢壍 = (燑壍: CampaignType, 郀壍: React.MouseEvent) => {
        const 嶯壍 = 郀壍.metaKey || 郀壍.ctrlKey || 郀壍.shiftKey;
        if (嶯壍)
            朄壍(騕壍.includes(燑壍) ? 騕壍.filter((粞壍) => 粞壍 !== 燑壍) : [...騕壍, 燑壍]);
        else
            朄壍(騕壍.length === 1 && 騕壍[0] === 燑壍 ? [] : [燑壍]);
    };
    return (<div className="flex flex-wrap items-center gap-2" role="group" aria-label="Campaign type">
      <Chip active={騕壍.length === 0} onClick={() => 朄壍([])}>
        All
      </Chip>
      {符壍.map((鮍壍) => (<Chip key={鮍壍} active={騕壍.includes(鮍壍)} onClick={(桼壍) => 勢壍(鮍壍, 桼壍)} title="⌘/⇧-click to combine types">
          {鮍壍}
        </Chip>))}
    </div>);
}
type StatusOption = "All" | "Enabled" | "Paused" | "Removed";
export function StatusFilter({ selected: 蝫壍, showRemoved: 呚壍, onChange: 獉壍 }: {
    selected: readonly string[];
    showRemoved: boolean;
    onChange: (鈸壍: string[]) => void;
}) {
    const 弧壍: StatusOption = 蝫壍.length === 1 && ["Enabled", "Paused", "Removed"].includes(蝫壍[0] as string) ? (蝫壍[0] as StatusOption) : "All";
    const 縖壍: {
        value: StatusOption;
        label: string;
    }[] = [
        { value: "All", label: "All" },
        { value: "Enabled", label: "Enabled" },
        { value: "Paused", label: "Paused" },
        ...(呚壍 || 弧壍 === "Removed" ? [{ value: "Removed" as const, label: "Removed" }] : []),
    ];
    return <Segmented ariaLabel="Campaign status" variant="sans" options={縖壍} value={弧壍} onChange={(鴅壍) => 獉壍(鴅壍 === "All" ? [] : [鴅壍])}/>;
}
export function ColumnChooser({ visible: 槴壍, onChange: 裣壍 }: {
    visible: readonly ColumnKey[];
    onChange: (嗒壍: ColumnKey[]) => void;
}) {
    const 瓁壍 = (鎰壍: ColumnKey, 悟壍: boolean) => {
        const 美壍 = new Set(槴壍);
        if (悟壍)
            美壍.add(鎰壍);
        else
            美壍.delete(鎰壍);
        裣壍(CAMPAIGN_COLUMNS.filter((鹽壍) => 鹽壍.locked || 美壍.has(鹽壍.key)).map((歬壍) => 歬壍.key));
    };
    const 詛壍 = 槴壍.length === DEFAULT_COLUMNS.length && DEFAULT_COLUMNS.every((坊壍) => 槴壍.includes(坊壍));
    return (<Popover align="end" trigger={<Button variant="ghost" size="sm">
          Columns <span aria-hidden>▾</span>
        </Button>}>
      <div className="flex w-[220px] flex-col" role="group" aria-label="Visible columns">
        <span className="px-2.5 pt-1.5 pb-1 label-mono">Visible columns</span>
        {CAMPAIGN_COLUMNS.filter((瘹壍) => !瘹壍.locked).map((锨壍) => (<label key={锨壍.key} className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] select-none hover:bg-fill">
            <Checkbox checked={槴壍.includes(锨壍.key)} onChange={(戗壍) => 瓁壍(锨壍.key, 戗壍)} ariaLabel={锨壍.label}/>
            <span className="flex-1">{锨壍.label}</span>
            {!锨壍.defaultOn ? <span className="font-mono text-micro text-faint">extra</span> : null}
          </label>))}
        <div className="my-1 h-px bg-line"/>
        <button type="button" disabled={詛壍} onClick={() => 裣壍(DEFAULT_COLUMNS)} className="rounded-[8px] px-2.5 py-2 text-left text-[13px] text-muted hover:bg-fill hover:text-fg disabled:opacity-40">
          Reset to default
        </button>
      </div>
    </Popover>);
}
export function DensityToggle({ value: 脆壍, onChange: 鿵壍 }: {
    value: Density;
    onChange: (泤壍: Density) => void;
}) {
    return (<Segmented ariaLabel="Row density" options={[
            { value: "comfortable", label: "Comfortable" },
            { value: "compact", label: "Compact" },
        ]} value={脆壍} onChange={鿵壍}/>);
}
