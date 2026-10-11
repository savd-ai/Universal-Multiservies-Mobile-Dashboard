"use client";
import { useRef, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { MiddleTruncate } from "@/components/ui/middle-truncate";
import { Modal } from "@/components/ui/overlays";
import { CodeBlock } from "@/components/ui/surfaces";
import { useActiveTabInView } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import type { PacingStatus } from "@/lib/domain/contracts/budget";
import { moneyExact, parseMoney, roundMoney } from "./lib/money";
import { monthLabel, shiftMonth } from "./lib/months";
import type { BudgetChange, SkippedChange } from "./lib/pacing";
export const BUDGET_TABS = ["pacing", "optimizer", "forecast", "simulators", "plans"] as const;
export type BudgetTab = (typeof BUDGET_TABS)[number];
const 淜壍: Record<BudgetTab, string> = { pacing: "Pacing", optimizer: "Optimizer", forecast: "Forecast", simulators: "Simulators", plans: "Plans" };
export const tabId = (賋壍: string, 妺壍: BudgetTab) => `${賋壍}-tab-${妺壍}`;
export const panelId = (碩壍: string) => `${碩壍}-panel`;
export function BudgetTabs({ value: 鞘壍, onChange: 撇壍, idBase: 荶壍, counts: 健壍 }: {
    value: BudgetTab;
    onChange: (潔壍: BudgetTab) => void;
    idBase: string;
    counts?: Partial<Record<BudgetTab, number>>;
}) {
    const 蹃壍 = useRef<(HTMLButtonElement | null)[]>([]);
    const 嬲壍 = useActiveTabInView(鞘壍);
    const 稡壍 = Math.max(0, BUDGET_TABS.indexOf(鞘壍));
    const 餐壍 = (旿壍: React.KeyboardEvent) => {
        const 蓮壍 = BUDGET_TABS.length;
        const 凝壍 = 旿壍.key === "ArrowRight" ? (稡壍 + 1) % 蓮壍 : 旿壍.key === "ArrowLeft" ? (稡壍 - 1 + 蓮壍) % 蓮壍 : 旿壍.key === "Home" ? 0 : 旿壍.key === "End" ? 蓮壍 - 1 : -1;
        if (凝壍 < 0)
            return;
        旿壍.preventDefault();
        撇壍(BUDGET_TABS[凝壍] as BudgetTab);
        蹃壍.current[凝壍]?.focus();
    };
    return (<div ref={嬲壍} role="tablist" aria-label="Budget planner sections" onKeyDown={餐壍} className="tab-row gap-0.5 self-start rounded-pill border border-line bg-fill p-[3px]">
      {BUDGET_TABS.map((烌壍, 辻壍) => {
            const 岪壍 = 烌壍 === 鞘壍;
            const 箙壍 = 健壍?.[烌壍];
            return (<button key={烌壍} ref={(骈壍) => {
                    蹃壍.current[辻壍] = 骈壍;
                }} id={tabId(荶壍, 烌壍)} type="button" role="tab" aria-selected={岪壍} aria-controls={panelId(荶壍)} tabIndex={岪壍 ? 0 : -1} onClick={() => 撇壍(烌壍)} className={cn("flex items-center gap-2 rounded-pill px-4 py-[7px] text-[13px] transition-colors", 岪壍 ? "bg-accent text-on-accent" : "text-muted hover:text-fg")}>
            {淜壍[烌壍]}
            {箙壍 ? <span className={cn("font-mono text-micro", 岪壍 ? "text-on-accent" : "text-faint")}>{箙壍}</span> : null}
          </button>);
        })}
    </div>);
}
export function MonthPicker({ month: 杷壍, currentMonth: 虦壍, onChange: 单壍, min: 牄壍, max: 鄳壍, complete: 帢壍 = false }: {
    month: string;
    currentMonth: string;
    onChange: (紑壍: string | null) => void;
    min: string;
    max: string;
    complete?: boolean;
}) {
    const 鰀壍 = 杷壍 < 虦壍 || (杷壍 === 虦壍 && 帢壍) ? "Complete" : 杷壍 > 虦壍 ? "Planning" : "In progress";
    const 棯壍 = (蟞壍: number) => {
        const 响壍 = shiftMonth(杷壍, 蟞壍);
        单壍(响壍 === 虦壍 ? null : 响壍);
    };
    return (<div className="flex items-center gap-2">
      <IconButton label="Previous month" onClick={() => 棯壍(-1)} disabled={杷壍 <= 牄壍} className="disabled:opacity-40">
        ←
      </IconButton>
      <div className="flex min-w-[150px] flex-col items-center gap-0.5" aria-live="polite">
        <span className="font-display text-[15px] font-semibold tracking-title">{monthLabel(杷壍)}</span>
        <span className={cn("font-mono text-micro tracking-label uppercase", 鰀壍 === "In progress" ? "text-accent" : "text-faint")}>{鰀壍}</span>
      </div>
      <IconButton label="Next month" onClick={() => 棯壍(1)} disabled={杷壍 >= 鄳壍} className="disabled:opacity-40">
        →
      </IconButton>
      {杷壍 !== 虦壍 ? (<Button variant="link" className="ml-1 text-xs" onClick={() => 单壍(null)}>
          This month
        </Button>) : null}
    </div>);
}
export function UnsavedBar({ summary: 玼壍, onDiscard: 銫壍, onSave: 徚壍, saving: 纉壍, saveLabel: 鵸壍 = "Save targets", extra: 橧壍 }: {
    summary: React.ReactNode;
    onDiscard: () => void;
    onSave: () => void;
    saving?: boolean;
    saveLabel?: string;
    extra?: React.ReactNode;
}) {
    return (<div className="sticky bottom-4 z-20 rounded-mini bg-page shadow-pop animate-fade-up-fast" role="region" aria-label="Unsaved changes">
      <div className="flex flex-wrap items-center gap-2.5 rounded-mini border border-dashed border-teal/30 bg-teal/4 px-[18px] py-3.5">
        <span className="font-mono text-meta tracking-meta text-accent uppercase">Unsaved changes</span>
        <span className="min-w-0 text-[13px] text-muted-3">{玼壍}</span>
        <span className="flex-1"/>
        {橧壍}
        <Button variant="ghost" onClick={銫壍} disabled={纉壍}>
          Discard
        </Button>
        <Button variant="accent" onClick={徚壍} loading={纉壍}>
          {鵸壍}
        </Button>
      </div>
    </div>);
}
const 襖壍: Record<PacingStatus, {
    label: string;
    cls: string;
}> = {
    overpacing: { label: "Overpacing", cls: "bg-warn-t text-warn" },
    underpacing: { label: "Underpacing", cls: "bg-tone/5 text-muted" },
    on_track: { label: "On track", cls: "bg-teal-t text-accent" },
    paused: { label: "Paused", cls: "bg-tone/5 text-muted-3" },
    no_budget: { label: "No budget", cls: "bg-tone/5 text-muted-3" },
    unsupported_period: { label: "Custom period", cls: "bg-tone/5 text-muted-3" },
};
export function PaceBadge({ status: 噅壍, className: 甴壍 }: {
    status: PacingStatus;
    className?: string;
}) {
    const 鐣壍 = 襖壍[噅壍];
    return <span className={cn("inline-flex rounded-pill px-2.5 py-1 text-[11px] whitespace-nowrap", 鐣壍.cls, 甴壍)}>{鐣壍.label}</span>;
}
export function LegendKey({ kind: 愒壍, label: 老壍, color: 黰壍 = "var(--accent-line)" }: {
    kind: "line" | "dashed" | "thin" | "band" | "dot" | "ring";
    label: React.ReactNode;
    color?: string;
}) {
    const 毟壍 = 愒壍 === "line" ? (<span className="h-0.5 w-3.5 rounded-[2px]" style={{ background: 黰壍 }}/>) : 愒壍 === "dashed" ? (<span className="w-3.5 border-t-[1.5px] border-dashed" style={{ borderColor: 黰壍 }}/>) : 愒壍 === "thin" ? (<span className="h-px w-3.5" style={{ background: 黰壍 }}/>) : 愒壍 === "band" ? (<span className="h-2 w-3.5 rounded-[2px] bg-teal/14"/>) : 愒壍 === "dot" ? (<span className="size-2 rounded-full" style={{ background: 黰壍 }}/>) : (<span className="size-2 rounded-full border-2" style={{ borderColor: 黰壍 }}/>);
    return (<span className="flex items-center gap-2 text-xs text-muted">
      <span aria-hidden className="flex items-center">
        {毟壍}
      </span>
      {老壍}
    </span>);
}
export function MoneyInput({ id: 諎壍, value: 垽壍, onCommit: 皬壍, currency: 閛壍, step: 把壍 = 50, ariaLabel: 腹壍, className: 乨壍, edited: 浗壍, title: 豆壍 }: {
    id?: string;
    value: number;
    onCommit: (夵壍: number) => void;
    currency: string;
    step?: number;
    ariaLabel: string;
    className?: string;
    edited?: boolean;
    title?: string;
}) {
    const [砤壍, 霓壍] = useState<string | null>(null);
    const 搂壍 = useRef(false);
    const 英壍 = (俠壍: string) => {
        const 滏壍 = parseMoney(俠壍);
        霓壍(null);
        if (滏壍 === null)
            return;
        const 趾壍 = roundMoney(滏壍, 把壍);
        if (Math.abs(趾壍 - 垽壍) >= 0.005)
            皬壍(趾壍);
    };
    return (<input id={諎壍} type="text" inputMode="decimal" aria-label={腹壍} title={豆壍} value={砤壍 ?? moneyExact(垽壍, 閛壍)} onFocus={(媭壍) => {
            霓壍(String(Math.round(垽壍 * 100) / 100));
            requestAnimationFrame(() => 媭壍.target.select());
        }} onChange={(禜壍) => 霓壍(禜壍.target.value)} onBlur={(颋壍) => {
            if (搂壍.current) {
                搂壍.current = false;
                霓壍(null);
                return;
            }
            英壍(颋壍.target.value);
        }} onKeyDown={(敺壍) => {
            if (敺壍.key === "Enter")
                敺壍.currentTarget.blur();
            if (敺壍.key === "Escape") {
                搂壍.current = true;
                敺壍.currentTarget.blur();
            }
        }} className={cn("w-[84px] rounded-[8px] border border-transparent bg-transparent px-1.5 py-1 text-right text-[13px] font-semibold tabular outline-none transition-colors hover:border-line focus:border-accent/60 focus:bg-input", 浗壍 && "text-accent", 乨壍)}/>);
}
export function CopyTextModal({ file: 葩壍, onClose: 兘壍, title: 灇壍 }: {
    file: {
        body: string;
        filename: string;
        warnings: string[];
    } | null;
    onClose: () => void;
    title: string;
}) {
    const 輶壍 = () => {
        if (!葩壍)
            return;
        void navigator.clipboard.writeText(葩壍.body).then(() => toast("Change list copied"), () => toast("Copy failed — select the text instead", { tone: "warn" }));
    };
    return (<Modal open={!!葩壍} onOpenChange={(尥壍) => !尥壍 && 兘壍()} eyebrow="Change list" title={灇壍} description="Paste into a ticket or apply by hand in Google Ads — this dashboard never changes Google Ads itself." width={620} footer={<>
          <Button variant="ghost" onClick={兘壍}>
            Close
          </Button>
          <Button variant="accent" onClick={輶壍}>
            Copy change list
          </Button>
        </>}>
      <CodeBlock className="max-h-72 whitespace-pre-wrap">{葩壍?.body.trim() || "No budget changes."}</CodeBlock>
      {葩壍?.warnings.length ? (<ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-muted-3">
          {葩壍.warnings.map((笔壍) => (<li key={笔壍}>● {笔壍}</li>))}
        </ul>) : null}
    </Modal>);
}
export function ChangesDialog({ open: 騃壍, onOpenChange: 曲壍, title: 藡壍, description: 勐壍, changes: 熿壍, skipped: 邮壍, currency: 嶝壍, confirmLabel: 粌壍, onConfirm: 魻壍, pending: 桪壍, children: 蝙壍, }: {
    open: boolean;
    onOpenChange: (呈壍: boolean) => void;
    title: string;
    description: string;
    changes: readonly BudgetChange[];
    skipped: readonly SkippedChange[];
    currency: string;
    confirmLabel: string;
    onConfirm: () => void;
    pending?: boolean;
    children?: React.ReactNode;
}) {
    return (<Modal open={騃壍} onOpenChange={曲壍} eyebrow="Daily budgets" title={藡壍} description={勐壍} width={560} footer={<>
          <Button variant="ghost" onClick={() => 曲壍(false)}>
            Cancel
          </Button>
          <Button variant="brand" onClick={魻壍} loading={桪壍} disabled={!熿壍.length}>
            {粌壍}
          </Button>
        </>}>
      <div className="flex flex-col gap-3">
        {熿壍.length ? (<ul className="m-0 flex max-h-64 list-none flex-col overflow-y-auto rounded-mini border border-line p-0">
            {熿壍.map((猷壍) => (<li key={猷壍.campaignId} className="flex items-center gap-3 border-b border-line-soft px-3.5 py-2.5 text-[13px] tabular last:border-b-0">
                <MiddleTruncate text={猷壍.name} className="flex-1"/>
                <span className="text-muted-3">{猷壍.from === null ? "—" : moneyExact(猷壍.from, 嶝壍)}</span>
                <span aria-hidden className="text-faint">
                  →
                </span>
                <span className="font-semibold">{moneyExact(猷壍.to, 嶝壍)}</span>
              </li>))}
          </ul>) : (<p className="m-0 text-[13px] text-muted-3">Nothing to change — every budget already matches.</p>)}
        {邮壍.length ? (<div className="flex flex-col gap-1 text-xs text-muted-3">
            <span className="label-mono">Not included</span>
            {邮壍.map((鈦壍) => (<span key={`${鈦壍.name}-${鈦壍.reason}`}>
                {鈦壍.name} · {鈦壍.reason}
              </span>))}
          </div>) : null}
        {蝙壍}
      </div>
    </Modal>);
}
