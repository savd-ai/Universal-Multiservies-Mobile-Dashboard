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
function 蓊壍(冹壍: string): string {
    return 冹壍.length === 10 ? `${冹壍.slice(0, 3)}-${冹壍.slice(3, 6)}-${冹壍.slice(6)}` : 冹壍;
}
function Cmp1() {
    const 辗壍 = useStatus();
    const 岆壍 = useQueryClient();
    const [筵壍, 驤壍] = useState(false);
    const 杓壍 = 辗壍.data?.account;
    const 虂壍 = 辗壍.data?.accounts ?? [];
    const 匱壍 = async (爠壍: string) => {
        驤壍(false);
        if (爠壍 === 杓壍?.id)
            return;
        try {
            await request("/api/accounts/active", { method: "PUT", body: { accountId: 爠壍 } });
            await 岆壍.invalidateQueries();
            toast(`Switched to ${虂壍.find((鄏壍) => 鄏壍.id === 爠壍)?.name ?? 爠壍}`);
        }
        catch (巾壍) {
            toast((巾壍 as Error).message, { tone: "crit" });
        }
    };
    return (<div className="flex min-w-0 items-center gap-2.5 font-mono text-meta tracking-meta text-faint uppercase max-sm:flex-1 max-sm:basis-0">
      <span className="hidden sm:inline">Google Ads</span>
      <span className="hidden sm:inline" aria-hidden>
        ·
      </span>
      {虂壍.length > 1 ? (<Popover open={筵壍} onOpenChange={驤壍} align="start" trigger={<button type="button" className="flex min-w-0 items-center gap-1.5 text-muted uppercase hover:text-fg" aria-label="Switch account">
              <span className="truncate">{杓壍?.name ?? "…"}</span>
              <span aria-hidden>▾</span>
            </button>}>
          <div className="w-72 p-1">
            {辗壍.data?.manager ? <div className="px-2.5 pt-1.5 pb-2 font-mono text-micro tracking-label text-faint uppercase">{辗壍.data.manager.name}</div> : null}
            {虂壍.map((糭壍) => (<button key={糭壍.id} type="button" onClick={() => void 匱壍(糭壍.id)} className={cn("flex w-full items-center justify-between gap-3 rounded-[8px] px-2.5 py-2 text-left text-[13px] normal-case tracking-normal hover:bg-fill", 糭壍.id === 杓壍?.id && "text-fg")}>
                <span className="font-sans">{糭壍.name}</span>
                <span className="font-mono text-micro text-faint">{糭壍.id === 杓壍?.id ? "✓ " : ""}{蓊壍(糭壍.id)}</span>
              </button>))}
          </div>
        </Popover>) : (<span className="truncate text-muted">{杓壍?.name ?? "…"}</span>)}
      <span className="hidden md:inline" aria-hidden>
        ·
      </span>
      <span className="hidden md:inline">{杓壍 ? 蓊壍(杓壍.id) : ""}</span>
    </div>);
}
function Cmp2() {
    const 棋壍 = useStatus();
    const 螺壍 = useFilters(棋壍.data?.today);
    const [咩壍, 玘壍] = useState(false);
    const [銇壍, 彶壍] = useState(螺壍.state.from ?? "");
    const [繥壍, 鵔壍] = useState(螺壍.state.to ?? "");
    const 橃壍: RangeKey[] = ["7d", "30d", "90d", "mtd", "qtd", "ytd", "last_month"];
    const 褲壍 = ["7d", "30d", "90d"].includes(螺壍.rangeKey);
    const 嘡壍: Record<RangeKey, string> = { "7d": "7D", "30d": "30D", "90d": "90D", mtd: "MTD", qtd: "QTD", ytd: "YTD", last_month: "Last month", custom: "Custom" };
    return (<div className="flex items-center gap-2">
      <Segmented ariaLabel="Date range" value={螺壍.rangeKey} onChange={(甐壍) => void 螺壍.set({ range: 甐壍 as RangeKey, from: null, to: null })} options={[
            { value: "7d", label: "7D" },
            { value: "30d", label: "30D" },
            { value: "90d", label: "90D" },
        ]}/>
      <Popover open={咩壍} onOpenChange={玘壍} trigger={<button type="button" aria-label="More date ranges and comparison" className={cn("rounded-pill border px-3 py-1.5 font-mono text-meta tracking-[0.08em] transition-colors", 褲壍 ? "border-line text-muted hover:text-fg" : "border-accent bg-teal-t text-fg")}>
            {褲壍 ? "More" : 嘡壍[螺壍.rangeKey]} ▾
          </button>}>
        <div className="flex w-64 flex-col">
          {橃壍.map((鏿壍) => (<button key={鏿壍} type="button" onClick={() => {
                void 螺壍.set({ range: 鏿壍, from: null, to: null });
                玘壍(false);
            }} className="flex items-center justify-between rounded-[8px] px-2.5 py-2 text-left text-[13px] hover:bg-fill">
              {RANGE_LABELS[鏿壍]}
              {螺壍.rangeKey === 鏿壍 ? <span className="text-base leading-none font-bold text-accent">✓</span> : null}
            </button>))}
          <div className="mt-1 flex flex-col gap-2 border-t border-line px-2.5 pt-2.5 pb-1.5">
            <span className="label-mono">Custom range</span>
            <div className="flex items-center gap-2">
              <Input variant="field" type="date" value={銇壍} max={棋壍.data?.dataThrough} onChange={(惮壍) => 彶壍(惮壍.target.value)} className="min-w-0 flex-1 px-2 py-1.5 text-xs" aria-label="From"/>
              <Input variant="field" type="date" value={繥壍} max={棋壍.data?.dataThrough} onChange={(翝壍) => 鵔壍(翝壍.target.value)} className="min-w-0 flex-1 px-2 py-1.5 text-xs" aria-label="To"/>
            </div>
            <Button variant="accent" size="xs" disabled={!銇壍 || !繥壍} onClick={() => {
            void 螺壍.set({ range: "custom", from: 銇壍 <= 繥壍 ? 銇壍 : 繥壍, to: 銇壍 <= 繥壍 ? 繥壍 : 銇壍 });
            玘壍(false);
        }}>
              Apply
            </Button>
            <span className="label-mono pt-1">Compare to</span>
            <Segmented ariaLabel="Compare" fill variant="sans" value={螺壍.compareKey} onChange={(黌壍) => void 螺壍.set({ cmp: 黌壍 as CompareKey })} options={COMPARE_OPTIONS.map((殻壍) => ({ value: 殻壍, label: 殻壍 === "prev" ? "Previous" : 殻壍 === "yoy" ? "Last year" : "Off" }))}/>
          </div>
        </div>
      </Popover>
      <span className="hidden font-mono text-meta text-muted-3 xl:inline" title={螺壍.compareRange ? `Compared with ${螺壍.compareRange.start} – ${螺壍.compareRange.end}` : undefined}>
        {螺壍.rangeLabel}
      </span>
    </div>);
}
export function ThemeSwitch({ label: 說壍 = false }: {
    label?: boolean;
}) {
    const { theme: 垙壍, toggle: 皈壍 } = useTheme();
    return (<div className={cn("flex items-center gap-2.5 rounded-pill border border-line bg-fill p-1", 說壍 ? "w-fit pr-3.5" : "2xl:pr-3.5")} title="Toggle light / dark mode">
      <Switch size="md" checked={垙壍 === "dark"} onChange={皈壍} ariaLabel="Dark mode"/>
      <span className={cn("font-mono text-meta tracking-meta text-fg uppercase", 說壍 ? "inline" : "hidden 2xl:inline")} suppressHydrationWarning>
        {垙壍 === "dark" ? "Dark" : "Light"}
      </span>
    </div>);
}
function Cmp3() {
    const 扦壍 = useQueryClient();
    const 腕壍 = useStatus();
    const [乄壍, 洳壍] = useState(false);
    const 谢壍 = 腕壍.data ? `${腕壍.data.reason?.code === "demo" ? "Demo data" : 腕壍.data.mode !== "live" ? "No live data" : "Live"} · data through ${腕壍.data.dataThrough}` : "Checking…";
    return (<Tooltip content={`${谢壍}. Click to refresh.`}>
      <IconButton label="Refresh data" onClick={async () => {
            洳壍(true);
            try {
                await request("/api/google-ads/refresh", { method: "POST", body: {} }).catch(() => undefined);
                await 扦壍.invalidateQueries();
            }
            finally {
                洳壍(false);
            }
        }}>
        <span className={cn("inline-block", 乄壍 && "animate-spin")}>↻</span>
      </IconButton>
    </Tooltip>);
}
export function TopBar({ onMenu: 夑壍 }: {
    onMenu?: () => void;
}) {
    const 砀壍 = useUi((雯壍) => 雯壍.setPalette);
    return (<header className="no-print sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-line bg-header px-4 py-3.5 backdrop-header sm:px-9 sm:py-4">
      {夑壍 ? (<IconButton label="Open navigation" onClick={夑壍} className="sm:hidden">
          ☰
        </IconButton>) : null}
      <Cmp1 />
      <div className="flex-1 max-sm:hidden"/>
      <div className="max-sm:order-last max-sm:basis-full">
        <Cmp2 />
      </div>
      <button type="button" onClick={() => 砀壍(true)} className="hidden items-center gap-2 rounded-pill border border-line bg-fill px-3 py-1.5 text-xs text-muted hover:text-fg lg:flex" aria-label="Search and commands">
        <span className="hidden 2xl:inline">Search</span> <Kbd>⌘K</Kbd>
      </button>
      <span className="hidden sm:contents">
        <Cmp3 />
      </span>
      <NotificationsButton />
      <span className="hidden sm:contents">
        <ThemeSwitch />
      </span>
      <UserMenu />
    </header>);
}
