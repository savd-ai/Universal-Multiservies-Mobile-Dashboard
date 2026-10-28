"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Segmented, Switch } from "@/components/ui/controls";
import { Input } from "@/components/ui/inputs";
import { Popover, Tooltip } from "@/components/ui/overlays";
import { Kbd } from "@/components/ui/status";
import { toast } from "@/components/ui/toast";
import { request } from "@/lib/api/client";
import { useStatus } from "@/lib/api/hooks";
import { COMPARE_OPTIONS, RANGE_LABELS, useFilters, type CompareKey, type RangeKey } from "@/lib/filters";
import { useTheme } from "@/lib/theme";
import { useUi } from "@/stores/ui";
import { NotificationsButton } from "./notifications";
import { UserMenu } from "./user-menu";
function formatAccountId(id: string): string {
    return id.length === 10 ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id;
}
function AccountSwitcher() {
    const status = useStatus();
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const acct = status.data?.account;
    const accounts = status.data?.accounts ?? [];
    const switchTo = async (id: string) => {
        setOpen(false);
        if (id === acct?.id)
            return;
        try {
            await request("/api/accounts/active", { method: "PUT", body: { accountId: id } });
            await qc.invalidateQueries();
            toast(`Switched to ${accounts.find((a) => a.id === id)?.name ?? id}`);
        }
        catch (e) {
            toast((e as Error).message, { tone: "crit" });
        }
    };
    return (<div className="flex min-w-0 items-center gap-2.5 font-mono text-meta tracking-meta text-faint uppercase max-sm:flex-1 max-sm:basis-0">
      <span className="hidden sm:inline">Google Ads</span>
      <span className="hidden sm:inline" aria-hidden>
        ·
      </span>
      {accounts.length > 1 ? (<Popover open={open} onOpenChange={setOpen} align="start" trigger={<button type="button" className="flex min-w-0 items-center gap-1.5 text-muted uppercase hover:text-fg" aria-label="Switch account">
              <span className="truncate">{acct?.name ?? "…"}</span>
              <span aria-hidden>▾</span>
            </button>}>
          <div className="w-72 p-1">
            {status.data?.manager ? <div className="px-2.5 pt-1.5 pb-2 font-mono text-micro tracking-label text-faint uppercase">{status.data.manager.name}</div> : null}
            {accounts.map((a) => (<button key={a.id} type="button" onClick={() => void switchTo(a.id)} className={cn("flex w-full items-center justify-between gap-3 rounded-[8px] px-2.5 py-2 text-left text-[13px] normal-case tracking-normal hover:bg-fill", a.id === acct?.id && "text-fg")}>
                <span className="font-sans">{a.name}</span>
                <span className="font-mono text-micro text-faint">{a.id === acct?.id ? "✓ " : ""}{formatAccountId(a.id)}</span>
              </button>))}
          </div>
        </Popover>) : (<span className="truncate text-muted">{acct?.name ?? "…"}</span>)}
      <span className="hidden md:inline" aria-hidden>
        ·
      </span>
      <span className="hidden md:inline">{acct ? formatAccountId(acct.id) : ""}</span>
    </div>);
}
function DateRangeControl() {
    const status = useStatus();
    const f = useFilters(status.data?.today);
    const [open, setOpen] = useState(false);
    const [state, setFrom] = useState(f.state.from ?? "");
    const [to, setTo] = useState(f.state.to ?? "");
    const presets: RangeKey[] = ["7d", "30d", "90d", "mtd", "qtd", "ytd", "last_month"];
    const pill = ["7d", "30d", "90d"].includes(f.rangeKey);
    const shortLabel: Record<RangeKey, string> = { "7d": "7D", "30d": "30D", "90d": "90D", mtd: "MTD", qtd: "QTD", ytd: "YTD", last_month: "Last month", custom: "Custom" };
    return (<div className="flex items-center gap-2">
      <Segmented ariaLabel="Date range" value={f.rangeKey} onChange={(v) => void f.set({ range: v as RangeKey, from: null, to: null })} options={[
            { value: "7d", label: "7D" },
            { value: "30d", label: "30D" },
            { value: "90d", label: "90D" },
        ]}/>
      <Popover open={open} onOpenChange={setOpen} trigger={<button type="button" aria-label="More date ranges and comparison" className={cn("rounded-pill border px-3 py-1.5 font-mono text-meta tracking-[0.08em] transition-colors", pill ? "border-line text-muted hover:text-fg" : "border-accent bg-teal-t text-fg")}>
            {pill ? "More" : shortLabel[f.rangeKey]} ▾
          </button>}>
        <div className="flex w-64 flex-col">
          {presets.map((p) => (<button key={p} type="button" onClick={() => {
                void f.set({ range: p, from: null, to: null });
                setOpen(false);
            }} className="flex items-center justify-between rounded-[8px] px-2.5 py-2 text-left text-[13px] hover:bg-fill">
              {RANGE_LABELS[p]}
              {f.rangeKey === p ? <span className="text-base leading-none font-bold text-accent">✓</span> : null}
            </button>))}
          <div className="mt-1 flex flex-col gap-2 border-t border-line px-2.5 pt-2.5 pb-1.5">
            <span className="label-mono">Custom range</span>
            <div className="flex items-center gap-2">
              <Input variant="field" type="date" value={state} max={status.data?.dataThrough} onChange={(e) => setFrom(e.target.value)} className="min-w-0 flex-1 px-2 py-1.5 text-xs" aria-label="From"/>
              <Input variant="field" type="date" value={to} max={status.data?.dataThrough} onChange={(e) => setTo(e.target.value)} className="min-w-0 flex-1 px-2 py-1.5 text-xs" aria-label="To"/>
            </div>
            <Button variant="accent" size="xs" disabled={!state || !to} onClick={() => {
            void f.set({ range: "custom", from: state <= to ? state : to, to: state <= to ? to : state });
            setOpen(false);
        }}>
              Apply
            </Button>
            <span className="label-mono pt-1">Compare to</span>
            <Segmented ariaLabel="Compare" fill variant="sans" value={f.compareKey} onChange={(v) => void f.set({ cmp: v as CompareKey })} options={COMPARE_OPTIONS.map((c) => ({ value: c, label: c === "prev" ? "Previous" : c === "yoy" ? "Last year" : "Off" }))}/>
          </div>
        </div>
      </Popover>
      <span className="hidden font-mono text-meta text-muted-3 xl:inline" title={f.compareRange ? `Compared with ${f.compareRange.start} – ${f.compareRange.end}` : undefined}>
        {f.rangeLabel}
      </span>
    </div>);
}
export function ThemeSwitch({ label = false }: {
    label?: boolean;
}) {
    const { theme, toggle } = useTheme();
    return (<div className={cn("flex items-center gap-2.5 rounded-pill border border-line bg-fill p-1", label ? "w-fit pr-3.5" : "2xl:pr-3.5")} title="Toggle light / dark mode">
      <Switch size="md" checked={theme === "dark"} onChange={toggle} ariaLabel="Dark mode"/>
      <span className={cn("font-mono text-meta tracking-meta text-fg uppercase", label ? "inline" : "hidden 2xl:inline")} suppressHydrationWarning>
        {theme === "dark" ? "Dark" : "Light"}
      </span>
    </div>);
}
function SyncButton() {
    const qc = useQueryClient();
    const status = useStatus();
    const [busy, setBusy] = useState(false);
    const label = status.data ? `${status.data.reason?.code === "demo" ? "Demo data" : status.data.mode !== "live" ? "No live data" : "Live"} · data through ${status.data.dataThrough}` : "Checking…";
    return (<Tooltip content={`${label}. Click to refresh.`}>
      <IconButton label="Refresh data" onClick={async () => {
            setBusy(true);
            try {
                await request("/api/google-ads/refresh", { method: "POST", body: {} }).catch(() => undefined);
                await qc.invalidateQueries();
            }
            finally {
                setBusy(false);
            }
        }}>
        <span className={cn("inline-block", busy && "animate-spin")}>↻</span>
      </IconButton>
    </Tooltip>);
}
export function TopBar({ onMenu }: {
    onMenu?: () => void;
}) {
    const setPalette = useUi((s) => s.setPalette);
    return (<header className="no-print sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-line bg-header px-4 py-3.5 backdrop-header sm:px-9 sm:py-4">
      {onMenu ? (<IconButton label="Open navigation" onClick={onMenu} className="sm:hidden">
          ☰
        </IconButton>) : null}
      <AccountSwitcher />
      <div className="flex-1 max-sm:hidden"/>
      <div className="max-sm:order-last max-sm:basis-full">
        <DateRangeControl />
      </div>
      <button type="button" onClick={() => setPalette(true)} className="hidden items-center gap-2 rounded-pill border border-line bg-fill px-3 py-1.5 text-xs text-muted hover:text-fg lg:flex" aria-label="Search and commands">
        <span className="hidden 2xl:inline">Search</span> <Kbd>⌘K</Kbd>
      </button>
      <span className="hidden sm:contents">
        <SyncButton />
      </span>
      <NotificationsButton />
      <span className="hidden sm:contents">
        <ThemeSwitch />
      </span>
      <UserMenu />
    </header>);
}
