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
export function TvScreen({ dashboardId }: {
    dashboardId: string;
}) {
    const router = useRouter();
    const qc = useQueryClient();
    const status = useStatus();
    const settings = useSettings();
    const dashboards = useDashboards();
    const filters = useFilters(status.data?.today);
    const [{ rotate, seconds }] = useQueryStates({ rotate: parseAsBoolean.withDefault(false), seconds: parseAsInteger.withDefault(60) });
    const list = useMemo(() => (dashboards.data ?? []).filter((d) => d.tv?.include !== false), [dashboards.data]);
    const current = dashboards.data?.find((d) => d.id === dashboardId);
    const [clock, setClock] = useState<string>("");
    const [progress, setProgress] = useState(0);
    const period = Math.max(10, seconds) * 1000;
    useEffect(() => {
        const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
        tick();
        const t = setInterval(tick, 15000);
        return () => clearInterval(t);
    }, []);
    useEffect(() => {
        let lock: {
            release: () => Promise<void>;
        } | null = null;
        const acquire = async () => {
            try {
                const wl = (navigator as Navigator & {
                    wakeLock?: {
                        request: (t: "screen") => Promise<{
                            release: () => Promise<void>;
                        }>;
                    };
                }).wakeLock;
                if (wl && document.visibilityState === "visible")
                    lock = await wl.request("screen");
            }
            catch {
            }
        };
        void acquire();
        const onVis = () => void acquire();
        document.addEventListener("visibilitychange", onVis);
        return () => {
            document.removeEventListener("visibilitychange", onVis);
            void lock?.release().catch(() => undefined);
        };
    }, []);
    useEffect(() => {
        const every = (settings.data?.refreshSeconds || 300) * 1000;
        const t = setInterval(() => void qc.invalidateQueries({ queryKey: ["acct"] }), every);
        return () => clearInterval(t);
    }, [qc, settings.data?.refreshSeconds]);
    useEffect(() => {
        if (!rotate || list.length < 2)
            return;
        const started = performance.now();
        let raf = 0;
        const step = () => {
            const p = Math.min(1, (performance.now() - started) / period);
            setProgress(p);
            if (p >= 1) {
                const i = list.findIndex((d) => d.id === dashboardId);
                const next = list[(i + 1) % list.length];
                if (next)
                    router.replace(`/tv/${next.id}?rotate=1&seconds=${seconds}`);
                return;
            }
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [rotate, list, dashboardId, period, seconds, router]);
    const rt: WidgetRuntime | null = useMemo(() => status.data && current
        ? {
            filters,
            today: status.data.today,
            dataThrough: status.data.dataThrough,
            currency: status.data.display.currency || status.data.account.currency,
            money: moneyFromStatus(status.data),
            mode: status.data.mode,
            editing: false,
            dashboardId: current.id,
            openCampaign: () => undefined,
            toggleCrossFilter: () => undefined,
        }
        : null, [status.data, current, filters]);
    if (!dashboards.data || !status.data)
        return <Skeleton height="100dvh" className="rounded-none"/>;
    if (!current)
        return (<div className="p-10">
        <EmptyState action={<Link href="/overview">Back to dashboards →</Link>}>Dashboard not found.</EmptyState>
      </div>);
    return (<div className="min-h-dvh bg-page bg-glow px-8 pt-6 pb-8 text-fg">
      {rotate && list.length > 1 ? <div className="fixed inset-x-0 top-0 z-10 h-0.5 bg-accent-line" style={{ transform: `scaleX(${progress})`, transformOrigin: "left" }} aria-hidden/> : null}
      <header className="mb-6 flex items-center gap-5">
        <Logo size={26}/>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Headline text={current.headline || current.name} size={30}/>
          <span className="meta">{`${status.data.account.name} · ${filters.rangeLabel} · data through ${formatLong(status.data.dataThrough)}${status.data.mode !== "live" ? " · demo data" : ""}`}</span>
        </div>
        <span className="font-display text-[34px] font-semibold tabular" suppressHydrationWarning>
          {clock}
        </span>
        <Link href={current.isDefault ? "/overview" : `/overview/${current.id}`} className="rounded-pill border border-line px-3.5 py-1.5 text-xs text-muted hover:text-fg hover:opacity-100">
          Exit TV ×
        </Link>
      </header>
      {rt ? <DashboardGrid draft={current} rt={rt} editing={false} readOnly update={() => undefined} undo={() => undefined} onRequestEdit={() => undefined}/> : null}
    </div>);
}
