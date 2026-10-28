"use client";
import Link from "next/link";
import { Component, createContext, useContext, useEffect, useEffectEvent, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { ErrorState } from "@/components/ui/feedback";
import { Menu, Tooltip, type MenuItem } from "@/components/ui/overlays";
import { chartToPng, ChartRegistryContext, type ChartRegistry } from "@/components/charts/chart-context";
import { readChartTokens } from "@/components/charts/tokens";
import { toast } from "@/components/ui/toast";
import { saveBlob } from "@/lib/api/client";
import { rowsForPx, SIZE_LABEL } from "@/features/dashboards/layout-engine";
interface Chrome {
    setMenu: (items: MenuItem[]) => void;
    setHints: (hints: string[]) => void;
    setSubtitle: (sub: string | null) => void;
}
const WidgetChromeContext = createContext<Chrome | null>(null);
export function useWidgetMenu(items: MenuItem[]): void {
    const ctx = useContext(WidgetChromeContext);
    useEffect(() => {
        ctx?.setMenu(items);
        return () => ctx?.setMenu([]);
    }, [ctx, items]);
}
export function useWidgetHints(hints: string[]): void {
    const ctx = useContext(WidgetChromeContext);
    const key = hints.join("|");
    useEffect(() => {
        ctx?.setHints(key ? key.split("|") : []);
    }, [ctx, key]);
}
export function useWidgetSubtitle(sub: string | null): void {
    const ctx = useContext(WidgetChromeContext);
    useEffect(() => {
        ctx?.setSubtitle(sub);
    }, [ctx, sub]);
}
class WidgetBoundary extends Component<{
    children: ReactNode;
    resetKey: string;
}, {
    error: unknown;
}> {
    state = { error: null as unknown };
    static getDerivedStateFromError(error: unknown) {
        return { error };
    }
    componentDidCatch(error: unknown, info: ErrorInfo) {
        console.error("Widget crashed", error, info.componentStack);
    }
    componentDidUpdate(prev: {
        resetKey: string;
    }) {
        if (prev.resetKey !== this.props.resetKey && this.state.error)
            this.setState({ error: null });
    }
    render() {
        if (this.state.error)
            return <ErrorState error={this.state.error} onRetry={() => this.setState({ error: null })}/>;
        return this.props.children;
    }
}
export interface WidgetFrameProps {
    id: string;
    title: string;
    subtitle?: string;
    link?: {
        href: string;
        label: string;
    };
    editing: boolean;
    width: number;
    height?: number;
    onLeft?: () => void;
    onRight?: () => void;
    onSize?: () => void;
    onRemove?: () => void;
    onConfigure?: () => void;
    extraMenu?: MenuItem[];
    className?: string;
    style?: React.CSSProperties;
    bodyClassName?: string;
    resetKey: string;
    onNeedRows?: (rows: number) => void;
    children: ReactNode;
}
export function WidgetFrame(props: WidgetFrameProps) {
    const { id, title, subtitle, link, editing, width, onLeft, onRight, onSize, onRemove, onConfigure, extraMenu, className, style, bodyClassName, resetKey, onNeedRows, children } = props;
    const sectionRef = useRef<HTMLElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    const [menu, setMenu] = useState<MenuItem[]>([]);
    const [hints, setHints] = useState<string[]>([]);
    const [subOverride, setSubtitle] = useState<string | null>(null);
    const chrome = useMemo<Chrome>(() => ({ setMenu, setHints, setSubtitle }), []);
    const [charts, setCharts] = useState<import("echarts/core").EChartsType[]>([]);
    const registry = useMemo<ChartRegistry>(() => ({
        register: (c) => {
            setCharts((list) => [...list, c]);
            return () => setCharts((list) => list.filter((x) => x !== c));
        },
    }), []);
    const pngItem: MenuItem[] = charts.length
        ? [
            {
                label: "Download PNG",
                onSelect: () => {
                    const chart = charts[0];
                    if (!chart)
                        return;
                    void chartToPng(chart, readChartTokens().surface).then((blob) => (blob ? saveBlob(blob, `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`) : toast("Couldn't export this chart", { tone: "crit" })));
                },
            },
        ]
        : [];
    const items = [...menu, ...pngItem, ...(extraMenu ?? [])];
    const headingId = `w-${id}-title`;
    const autoGrow = !!onNeedRows;
    const report = useEffectEvent((rows: number) => onNeedRows?.(rows));
    useEffect(() => {
        const sec = sectionRef.current;
        const body = bodyRef.current;
        const inner = innerRef.current;
        if (!autoGrow || !sec || !body || !inner)
            return;
        let frame = 0;
        const measure = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const overflow = inner.offsetHeight - body.clientHeight;
                if (overflow > 1)
                    report(rowsForPx(sec.offsetHeight + overflow));
            });
        };
        const ro = new ResizeObserver(measure);
        ro.observe(inner);
        ro.observe(body);
        return () => {
            ro.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [autoGrow]);
    return (<section ref={sectionRef} aria-labelledby={headingId} className={cn("group/widget flex min-h-0 min-w-0 animate-fade-up flex-col gap-[18px] rounded-card border bg-card p-[22px] shadow-card", editing ? "border-teal/30" : "border-line", className)} style={style}>
      <div className={cn("flex items-center gap-3", editing && "rgl-handle cursor-grab active:cursor-grabbing")}>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id={headingId} className="m-0 truncate font-display text-base font-semibold tracking-title">
            {title}
          </h2>
          <div className="flex min-w-0 items-center gap-2">
            <span className="meta truncate">{subOverride ?? subtitle}</span>
            {hints.length ? (<Tooltip content={`Not applied here: ${hints.join(", ")}. This widget's data has no such field.`}>
                <span className="cursor-help font-mono text-micro text-faint" aria-label={`Filters not applied: ${hints.join(", ")}`}>
                  ⓘ
                </span>
              </Tooltip>) : null}
          </div>
        </div>
        {!editing && link ? (<Link href={link.href} className="text-xs whitespace-nowrap text-accent">
            {link.label} →
          </Link>) : null}
        {!editing && items.length ? (<Menu trigger={<button type="button" aria-label={`${title} options`} className="grid size-7 place-items-center rounded-pill text-muted opacity-60 transition-opacity group-hover/widget:opacity-100 hover:bg-fill focus-visible:opacity-100">
                ⋯
              </button>} items={items}/>) : null}
        {editing ? (<div className="rgl-no-drag flex gap-1">
            {onLeft ? (<IconButton label={`Move ${title} earlier`} onClick={onLeft}>
                ←
              </IconButton>) : null}
            {onRight ? (<IconButton label={`Move ${title} later`} onClick={onRight}>
                →
              </IconButton>) : null}
            {onSize ? (<button type="button" onClick={onSize} aria-label={`Resize ${title}, currently ${SIZE_LABEL[width] ?? `${width}/12`}`} className="grid h-7 place-items-center rounded-pill border border-teal/30 px-2.5 font-mono text-micro text-accent hover:border-teal/60">
                {SIZE_LABEL[width] ?? `${width}/12`}
              </button>) : null}
            {onConfigure ? (<IconButton label={`Configure ${title}`} onClick={onConfigure}>
                ⚙
              </IconButton>) : null}
            {onRemove ? (<IconButton label={`Remove ${title}`} onClick={onRemove}>
                ×
              </IconButton>) : null}
          </div>) : null}
      </div>
      <div ref={bodyRef} className={cn("relative flex min-h-0 flex-1 flex-col", autoGrow && "overflow-hidden", bodyClassName)}>
        <div ref={innerRef} className={cn("flex flex-col", autoGrow ? "flex-[1_0_auto]" : "min-h-0 flex-1")}>
          <WidgetChromeContext.Provider value={chrome}>
            <ChartRegistryContext.Provider value={registry}>
              <WidgetBoundary resetKey={resetKey}>{children}</WidgetBoundary>
            </ChartRegistryContext.Provider>
          </WidgetChromeContext.Provider>
        </div>
      </div>
    </section>);
}
