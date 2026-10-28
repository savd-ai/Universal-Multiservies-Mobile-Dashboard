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
const TAB_LABELS: Record<BudgetTab, string> = { pacing: "Pacing", optimizer: "Optimizer", forecast: "Forecast", simulators: "Simulators", plans: "Plans" };
export const tabId = (base: string, t: BudgetTab) => `${base}-tab-${t}`;
export const panelId = (base: string) => `${base}-panel`;
export function BudgetTabs({ value, onChange, idBase, counts }: {
    value: BudgetTab;
    onChange: (t: BudgetTab) => void;
    idBase: string;
    counts?: Partial<Record<BudgetTab, number>>;
}) {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    const row = useActiveTabInView(value);
    const idx = Math.max(0, BUDGET_TABS.indexOf(value));
    const onKey = (e: React.KeyboardEvent) => {
        const n = BUDGET_TABS.length;
        const next = e.key === "ArrowRight" ? (idx + 1) % n : e.key === "ArrowLeft" ? (idx - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
        if (next < 0)
            return;
        e.preventDefault();
        onChange(BUDGET_TABS[next] as BudgetTab);
        refs.current[next]?.focus();
    };
    return (<div ref={row} role="tablist" aria-label="Budget planner sections" onKeyDown={onKey} className="tab-row gap-0.5 self-start rounded-pill border border-line bg-fill p-[3px]">
      {BUDGET_TABS.map((t, i) => {
            const on = t === value;
            const count = counts?.[t];
            return (<button key={t} ref={(el) => {
                    refs.current[i] = el;
                }} id={tabId(idBase, t)} type="button" role="tab" aria-selected={on} aria-controls={panelId(idBase)} tabIndex={on ? 0 : -1} onClick={() => onChange(t)} className={cn("flex items-center gap-2 rounded-pill px-4 py-[7px] text-[13px] transition-colors", on ? "bg-accent text-on-accent" : "text-muted hover:text-fg")}>
            {TAB_LABELS[t]}
            {count ? <span className={cn("font-mono text-micro", on ? "text-on-accent" : "text-faint")}>{count}</span> : null}
          </button>);
        })}
    </div>);
}
export function MonthPicker({ month, currentMonth, onChange, min, max, complete = false }: {
    month: string;
    currentMonth: string;
    onChange: (m: string | null) => void;
    min: string;
    max: string;
    complete?: boolean;
}) {
    const phase = month < currentMonth || (month === currentMonth && complete) ? "Complete" : month > currentMonth ? "Planning" : "In progress";
    const shift = (d: number) => {
        const next = shiftMonth(month, d);
        onChange(next === currentMonth ? null : next);
    };
    return (<div className="flex items-center gap-2">
      <IconButton label="Previous month" onClick={() => shift(-1)} disabled={month <= min} className="disabled:opacity-40">
        ←
      </IconButton>
      <div className="flex min-w-[150px] flex-col items-center gap-0.5" aria-live="polite">
        <span className="font-display text-[15px] font-semibold tracking-title">{monthLabel(month)}</span>
        <span className={cn("font-mono text-micro tracking-label uppercase", phase === "In progress" ? "text-accent" : "text-faint")}>{phase}</span>
      </div>
      <IconButton label="Next month" onClick={() => shift(1)} disabled={month >= max} className="disabled:opacity-40">
        →
      </IconButton>
      {month !== currentMonth ? (<Button variant="link" className="ml-1 text-xs" onClick={() => onChange(null)}>
          This month
        </Button>) : null}
    </div>);
}
export function UnsavedBar({ summary, onDiscard, onSave, saving, saveLabel = "Save targets", extra }: {
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
        <span className="min-w-0 text-[13px] text-muted-3">{summary}</span>
        <span className="flex-1"/>
        {extra}
        <Button variant="ghost" onClick={onDiscard} disabled={saving}>
          Discard
        </Button>
        <Button variant="accent" onClick={onSave} loading={saving}>
          {saveLabel}
        </Button>
      </div>
    </div>);
}
const STATUS_COPY: Record<PacingStatus, {
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
export function PaceBadge({ status, className }: {
    status: PacingStatus;
    className?: string;
}) {
    const s = STATUS_COPY[status];
    return <span className={cn("inline-flex rounded-pill px-2.5 py-1 text-[11px] whitespace-nowrap", s.cls, className)}>{s.label}</span>;
}
export function LegendKey({ kind, label, color = "var(--accent-line)" }: {
    kind: "line" | "dashed" | "thin" | "band" | "dot" | "ring";
    label: React.ReactNode;
    color?: string;
}) {
    const mark = kind === "line" ? (<span className="h-0.5 w-3.5 rounded-[2px]" style={{ background: color }}/>) : kind === "dashed" ? (<span className="w-3.5 border-t-[1.5px] border-dashed" style={{ borderColor: color }}/>) : kind === "thin" ? (<span className="h-px w-3.5" style={{ background: color }}/>) : kind === "band" ? (<span className="h-2 w-3.5 rounded-[2px] bg-teal/14"/>) : kind === "dot" ? (<span className="size-2 rounded-full" style={{ background: color }}/>) : (<span className="size-2 rounded-full border-2" style={{ borderColor: color }}/>);
    return (<span className="flex items-center gap-2 text-xs text-muted">
      <span aria-hidden className="flex items-center">
        {mark}
      </span>
      {label}
    </span>);
}
export function MoneyInput({ id, value, onCommit, currency, step = 50, ariaLabel, className, edited, title }: {
    id?: string;
    value: number;
    onCommit: (v: number) => void;
    currency: string;
    step?: number;
    ariaLabel: string;
    className?: string;
    edited?: boolean;
    title?: string;
}) {
    const [text, setText] = useState<string | null>(null);
    const cancel = useRef(false);
    const commit = (raw: string) => {
        const parsed = parseMoney(raw);
        setText(null);
        if (parsed === null)
            return;
        const v = roundMoney(parsed, step);
        if (Math.abs(v - value) >= 0.005)
            onCommit(v);
    };
    return (<input id={id} type="text" inputMode="decimal" aria-label={ariaLabel} title={title} value={text ?? moneyExact(value, currency)} onFocus={(e) => {
            setText(String(Math.round(value * 100) / 100));
            requestAnimationFrame(() => e.target.select());
        }} onChange={(e) => setText(e.target.value)} onBlur={(e) => {
            if (cancel.current) {
                cancel.current = false;
                setText(null);
                return;
            }
            commit(e.target.value);
        }} onKeyDown={(e) => {
            if (e.key === "Enter")
                e.currentTarget.blur();
            if (e.key === "Escape") {
                cancel.current = true;
                e.currentTarget.blur();
            }
        }} className={cn("w-[84px] rounded-[8px] border border-transparent bg-transparent px-1.5 py-1 text-right text-[13px] font-semibold tabular outline-none transition-colors hover:border-line focus:border-accent/60 focus:bg-input", edited && "text-accent", className)}/>);
}
export function CopyTextModal({ file, onClose, title }: {
    file: {
        body: string;
        filename: string;
        warnings: string[];
    } | null;
    onClose: () => void;
    title: string;
}) {
    const copy = () => {
        if (!file)
            return;
        void navigator.clipboard.writeText(file.body).then(() => toast("Change list copied"), () => toast("Copy failed — select the text instead", { tone: "warn" }));
    };
    return (<Modal open={!!file} onOpenChange={(o) => !o && onClose()} eyebrow="Change list" title={title} description="Paste into a ticket or apply by hand in Google Ads — this dashboard never changes Google Ads itself." width={620} footer={<>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="accent" onClick={copy}>
            Copy change list
          </Button>
        </>}>
      <CodeBlock className="max-h-72 whitespace-pre-wrap">{file?.body.trim() || "No budget changes."}</CodeBlock>
      {file?.warnings.length ? (<ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-muted-3">
          {file.warnings.map((w) => (<li key={w}>● {w}</li>))}
        </ul>) : null}
    </Modal>);
}
export function ChangesDialog({ open, onOpenChange, title, description, changes, skipped, currency, confirmLabel, onConfirm, pending, children, }: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
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
    return (<Modal open={open} onOpenChange={onOpenChange} eyebrow="Daily budgets" title={title} description={description} width={560} footer={<>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="brand" onClick={onConfirm} loading={pending} disabled={!changes.length}>
            {confirmLabel}
          </Button>
        </>}>
      <div className="flex flex-col gap-3">
        {changes.length ? (<ul className="m-0 flex max-h-64 list-none flex-col overflow-y-auto rounded-mini border border-line p-0">
            {changes.map((c) => (<li key={c.campaignId} className="flex items-center gap-3 border-b border-line-soft px-3.5 py-2.5 text-[13px] tabular last:border-b-0">
                <MiddleTruncate text={c.name} className="flex-1"/>
                <span className="text-muted-3">{c.from === null ? "—" : moneyExact(c.from, currency)}</span>
                <span aria-hidden className="text-faint">
                  →
                </span>
                <span className="font-semibold">{moneyExact(c.to, currency)}</span>
              </li>))}
          </ul>) : (<p className="m-0 text-[13px] text-muted-3">Nothing to change — every budget already matches.</p>)}
        {skipped.length ? (<div className="flex flex-col gap-1 text-xs text-muted-3">
            <span className="label-mono">Not included</span>
            {skipped.map((s) => (<span key={`${s.name}-${s.reason}`}>
                {s.name} · {s.reason}
              </span>))}
          </div>) : null}
        {children}
      </div>
    </Modal>);
}
