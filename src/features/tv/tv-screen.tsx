"use client";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsBoolean, parseAsInteger, useQueryStates } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { Headline, Logo } from "@/components/brand/brand";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { useDashboards, useSettings, useStatus } from "@/lib/api/hooks";
import { formatLong } from "@/lib/domain/dates";
import { moneyFromStatus } from "@/lib/money";
import { useFilters } from "@/lib/filters";
import { DashboardGrid } from "@/features/dashboards/dashboard-grid";
import type { WidgetRuntime } from "@/features/widgets/types";
export function TvScreen({ dashboardId: 魬壍 }: {
    dashboardId: string;
}) {
    const 桛壍 = useRouter();
    const 蝊壍 = useQueryClient();
    const 吹壍 = useStatus();
    const 猨壍 = useSettings();
    const 鈗壍 = useDashboards();
    const 弆壍 = useFilters(吹壍.data?.today);
    const [{ rotate: 緵壍, seconds: 鳤壍 }] = useQueryStates({ rotate: parseAsBoolean.withDefault(false), seconds: parseAsInteger.withDefault(60) });
    const 槓壍 = useMemo(() => (鈗壍.data ?? []).filter((裂壍) => 裂壍.tv?.include !== false), [鈗壍.data]);
    const 喱壍 = 鈗壍.data?.find((璠壍) => 璠壍.id === 魬壍);
    const [鎏壍, 恾壍] = useState<string>("");
    const [罭壍, 鹜壍] = useState(0);
    const 歋壍 = Math.max(10, 鳤壍) * 1000;
    useEffect(() => {
        const 診壍 = () => 恾壍(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
        診壍();
        const 圩壍 = setInterval(診壍, 15000);
        return () => clearInterval(圩壍);
    }, []);
    useEffect(() => {
        let 瘘壍: {
            release: () => Promise<void>;
        } | null = null;
        const 锇壍 = async () => {
            try {
                const 懶壍 = (navigator as Navigator & {
                    wakeLock?: {
                        request: (胥壍: "screen") => Promise<{
                            release: () => Promise<void>;
                        }>;
                    };
                }).wakeLock;
                if (懶壍 && document.visibilityState === "visible")
                    瘘壍 = await 懶壍.request("screen");
            }
            catch {
            }
        };
        void 锇壍();
        const 鿔壍 = () => void 锇壍();
        document.addEventListener("visibilitychange", 鿔壍);
        return () => {
            document.removeEventListener("visibilitychange", 鿔壍);
            void 瘘壍?.release().catch(() => undefined);
        };
    }, []);
    useEffect(() => {
        const 泃壍 = (猨壍.data?.refreshSeconds || 300) * 1000;
        const 讲壍 = setInterval(() => void 蝊壍.invalidateQueries({ queryKey: ["acct"] }), 泃壍);
        return () => clearInterval(讲壍);
    }, [蝊壍, 猨壍.data?.refreshSeconds]);
    useEffect(() => {
        if (!緵壍 || 槓壍.length < 2)
            return;
        const 墡壍 = performance.now();
        let 瞐壍 = 0;
        const 陿壍 = () => {
            const 据壍 = Math.min(1, (performance.now() - 墡壍) / 歋壍);
            鹜壍(据壍);
            if (据壍 >= 1) {
                const 艝壍 = 槓壍.findIndex((佌壍) => 佌壍.id === 魬壍);
                const 渻壍 = 槓壍[(艝壍 + 1) % 槓壍.length];
                if (渻壍)
                    桛壍.replace(`/tv/${渻壍.id}?rotate=1&seconds=${鳤壍}`);
                return;
            }
            瞐壍 = requestAnimationFrame(陿壍);
        };
        瞐壍 = requestAnimationFrame(陿壍);
        return () => cancelAnimationFrame(瞐壍);
    }, [緵壍, 槓壍, 魬壍, 歋壍, 鳤壍, 桛壍]);
    const 贪壍: WidgetRuntime | null = useMemo(() => 吹壍.data && 喱壍
        ? {
            filters: 弆壍,
            today: 吹壍.data.today,
            dataThrough: 吹壍.data.dataThrough,
            currency: 吹壍.data.display.currency || 吹壍.data.account.currency,
            money: moneyFromStatus(吹壍.data),
            mode: 吹壍.data.mode,
            editing: false,
            dashboardId: 喱壍.id,
            openCampaign: () => undefined,
            toggleCrossFilter: () => undefined,
        }
        : null, [吹壍.data, 喱壍, 弆壍]);
    if (!鈗壍.data || !吹壍.data)
        return <Skeleton height="100dvh" className="rounded-none"/>;
    if (!喱壍)
        return (<div className="p-10">
        <EmptyState action={<Link href="/overview">Back to dashboards →</Link>}>Dashboard not found.</EmptyState>
      </div>);
    return (<div className="min-h-dvh bg-page bg-glow px-8 pt-6 pb-8 text-fg">
      {緵壍 && 槓壍.length > 1 ? <div className="fixed inset-x-0 top-0 z-10 h-0.5 bg-accent-line" style={{ transform: `scaleX(${罭壍})`, transformOrigin: "left" }} aria-hidden/> : null}
      <header className="mb-6 flex items-center gap-5">
        <Logo size={26}/>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Headline text={喱壍.headline || 喱壍.name} size={30}/>
          <span className="meta">{`${吹壍.data.account.name} · ${弆壍.rangeLabel} · data through ${formatLong(吹壍.data.dataThrough)}${吹壍.data.mode !== "live" ? " · demo data" : ""}`}</span>
        </div>
        <span className="font-display text-[34px] font-semibold tabular" suppressHydrationWarning>
          {鎏壍}
        </span>
        <Link href={喱壍.isDefault ? "/overview" : `/overview/${喱壍.id}`} className="rounded-pill border border-line px-3.5 py-1.5 text-xs text-muted hover:text-fg hover:opacity-100">
          Exit TV ×
        </Link>
      </header>
      {贪壍 ? <DashboardGrid draft={喱壍} rt={贪壍} editing={false} readOnly update={() => undefined} undo={() => undefined} onRequestEdit={() => undefined}/> : null}
    </div>);
}
