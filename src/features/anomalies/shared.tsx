"use client";
import { useCallback, useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { cn } from "@/components/ui/cn";
import { Checkbox, Chip } from "@/components/ui/controls";
import { Input } from "@/components/ui/inputs";
import { useStatus } from "@/lib/api/hooks";
import type { CampaignOption } from "@/lib/api/anomalies-ui";
import { formatMetricValue } from "@/lib/domain/metrics/registry";
import type { MetricFormat } from "@/lib/domain/types";
const clock = { now: 0, timer: null as ReturnType<typeof setInterval> | null, listeners: new Set<() => void>() };
function subscribeClock(cb: () => void) {
    clock.listeners.add(cb);
    if (!clock.timer) {
        clock.timer = setInterval(() => {
            clock.now = Date.now();
            clock.listeners.forEach((l) => l());
        }, 30000);
    }
    return () => {
        clock.listeners.delete(cb);
        if (!clock.listeners.size && clock.timer) {
            clearInterval(clock.timer);
            clock.timer = null;
        }
    };
}
function clockSnapshot(): number | null {
    if (!clock.now)
        clock.now = Date.now();
    return clock.now;
}
export function useNow(): number | null {
    return useSyncExternalStore(subscribeClock, clockSnapshot, () => null);
}
const permListeners = new Set<() => void>();
const permSnapshot = (): NotificationPermission | "unsupported" => (typeof Notification === "undefined" ? "unsupported" : Notification.permission);
export function useNotificationPermission(): [
    NotificationPermission | "unsupported" | null,
    () => Promise<void>
] {
    const perm = useSyncExternalStore((cb) => {
        permListeners.add(cb);
        return () => permListeners.delete(cb);
    }, permSnapshot, () => null);
    const requestPermission = useCallback(async () => {
        if (typeof Notification === "undefined")
            return;
        await Notification.requestPermission();
        permListeners.forEach((l) => l());
    }, []);
    return [perm, requestPermission];
}
export function useValueFormat(): {
    fmt: (format: MetricFormat, v: number | null | undefined) => string;
    currency: string;
    timeZone: string;
} {
    const d = useStatus().data;
    const currency = d?.display.currency || d?.account.currency || "USD";
    const fx = d && d.display.currency && d.display.currency !== d.account.currency ? (d.display.fxRates[d.display.currency] ?? 1) : 1;
    const timeZone = d?.account.timezone || "UTC";
    const fmt = useCallback((format: MetricFormat, v: number | null | undefined) => formatMetricValue(format, v, format === "money" ? { currency, fx } : {}), [currency, fx]);
    return { fmt, currency, timeZone };
}
export function useDebouncedValue<T>(value: T, ms: number): T {
    const [v, setV] = useState(value);
    useEffect(() => {
        if (Object.is(v, value))
            return;
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms, v]);
    return v;
}
export function cardDomId(id: string): string {
    return `signal-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}
export function ActionLink({ tone = "muted", className, type: value = "button", ...rest }: React.ComponentProps<"button"> & {
    tone?: "accent" | "muted" | "crit";
}) {
    return (<button type={value} className={cn("text-[12px] whitespace-nowrap transition-colors disabled:opacity-50", tone === "accent" ? "text-accent hover:opacity-85" : tone === "crit" ? "text-crit hover:opacity-85" : "text-muted hover:text-fg", className)} {...rest}/>);
}
interface NumberInputProps {
    id?: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
    prefix?: string;
    ariaLabel?: string;
    className?: string;
    disabled?: boolean;
}
export function NumberInput({ id, value, onChange, min, max, step, suffix, prefix, ariaLabel, className, disabled }: NumberInputProps) {
    return (<span className={cn("inline-flex items-center gap-2", className)}>
      {prefix ? <span className="font-mono text-meta text-faint">{prefix}</span> : null}
      <Input id={id} variant="field" type="number" inputMode="decimal" value={Number.isFinite(value) ? value : ""} min={min} max={max} step={step} disabled={disabled} aria-label={ariaLabel} aria-invalid={!Number.isFinite(value) || (min !== undefined && value < min) || (max !== undefined && value > max) || undefined} onChange={(e) => onChange(e.target.value === "" ? Number.NaN : e.target.valueAsNumber)} className="w-24 min-w-0 px-3 py-2 tabular aria-[invalid=true]:border-crit/60"/>
      {suffix ? <span className="font-mono text-meta text-faint">{suffix}</span> : null}
    </span>);
}
export function ToggleChips<T extends string>({ options, value, onChange, ariaLabel, className }: {
    options: readonly {
        value: T;
        label: React.ReactNode;
    }[];
    value: readonly T[];
    onChange: (v: T[]) => void;
    ariaLabel: string;
    className?: string;
}) {
    return (<div role="group" aria-label={ariaLabel} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
            const on = value.includes(o.value);
            return (<Chip key={o.value} active={on} onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])} className="px-3 py-1">
            {o.label}
          </Chip>);
        })}
    </div>);
}
export function CampaignChecklist({ campaigns, value, onChange, label = "campaigns", emptyLabel = "All campaigns" }: {
    campaigns: readonly CampaignOption[] | undefined;
    value: readonly string[];
    onChange: (ids: string[]) => void;
    label?: string;
    emptyLabel?: string;
}) {
    const [q, setQ] = useState("");
    const list = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return (campaigns ?? []).filter((c) => !needle || c.name.toLowerCase().includes(needle));
    }, [campaigns, q]);
    const selected = new Set(value);
    return (<div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-3">
        <span>{value.length ? `${value.length} selected` : emptyLabel}</span>
        {value.length ? (<ActionLink onClick={() => onChange([])} className="text-xs">
            Clear
          </ActionLink>) : null}
      </div>
      {(campaigns?.length ?? 0) > 8 ? <Input variant="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter campaigns…" aria-label={`Filter ${label}`} className="py-2"/> : null}
      <div role="group" aria-label={label} className="flex max-h-52 flex-col overflow-y-auto rounded-mini border border-line">
        {!campaigns ? <span className="p-3 text-xs text-muted-3">Loading campaigns…</span> : null}
        {campaigns && !list.length ? <span className="p-3 text-xs text-muted-3">No campaigns match.</span> : null}
        {list.map((c) => (<label key={c.id} className="flex cursor-pointer items-center gap-3 border-b border-line-soft px-3 py-2 text-[13px] last:border-b-0 hover:bg-fill">
            <Checkbox checked={selected.has(c.id)} onChange={(on) => onChange(on ? [...value, c.id] : value.filter((v) => v !== c.id))} ariaLabel={c.name}/>
            <span className="min-w-0 flex-1 truncate">{c.name}</span>
            <span className="font-mono text-micro text-faint">{c.type}</span>
          </label>))}
      </div>
    </div>);
}
let zones: string[] | null = null;
function timeZones(): string[] {
    if (zones)
        return zones;
    try {
        zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    }
    catch {
        zones = [];
    }
    if (!zones.includes("UTC"))
        zones = ["UTC", ...zones];
    return zones;
}
export function TimeZoneInput({ id, value, onChange, ariaLabel }: {
    id?: string;
    value: string;
    onChange: (tz: string) => void;
    ariaLabel?: string;
}) {
    const listId = useId();
    const [options, setOptions] = useState<string[]>([]);
    return (<>
      <Input id={id} variant="field" value={value} onFocus={() => setOptions(timeZones())} onChange={(e) => onChange(e.target.value)} list={listId} spellCheck={false} autoComplete="off" aria-label={ariaLabel} placeholder="America/New_York" className="min-w-0 py-2"/>
      <datalist id={listId}>
        {options.map((z) => (<option key={z} value={z}/>))}
      </datalist>
    </>);
}
