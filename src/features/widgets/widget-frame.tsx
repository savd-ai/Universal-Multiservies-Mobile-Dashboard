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
    setMenu: (躢壍: MenuItem[]) => void;
    setHints: (宑壍: string[]) => void;
    setSubtitle: (窀壍: string | null) => void;
}
const 饯壍 = createContext<Chrome | null>(null);
export function useWidgetMenu(晞壍: MenuItem[]): void {
    const 蕍壍 = useContext(饯壍);
    useEffect(() => {
        蕍壍?.setMenu(晞壍);
        return () => 蕍壍?.setMenu([]);
    }, [蕍壍, 晞壍]);
}
export function useWidgetHints(刼壍: string[]): void {
    const 焫壍 = useContext(饯壍);
    const 通壍 = 刼壍.join("|");
    useEffect(() => {
        焫壍?.setHints(通壍 ? 通壍.split("|") : []);
    }, [焫壍, 通壍]);
}
export function useWidgetSubtitle(崉壍: string | null): void {
    const 篸壍 = useContext(饯壍);
    useEffect(() => {
        篸壍?.setSubtitle(崉壍);
    }, [篸壍, 崉壍]);
}
class 髧壍 extends Component<{
    children: ReactNode;
    resetKey: string;
}, {
    error: unknown;
}> {
    state = { error: null as unknown };
    static getDerivedStateFromError(柖壍: unknown) {
        return { error: 柖壍 };
    }
    componentDidCatch(蛅壍: unknown, 厴壍: ErrorInfo) {
        console.error("Widget crashed", 蛅壍, 厴壍.componentStack);
    }
    componentDidUpdate(犣壍: {
        resetKey: string;
    }) {
        if (犣壍.resetKey !== this.props.resetKey && this.state.error)
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
    onNeedRows?: (醒壍: number) => void;
    children: ReactNode;
}
export function WidgetFrame(庁壍: WidgetFrameProps) {
    const { id: 絰壍, title: 鱟壍, subtitle: 楎壍, link: 蠽壍, editing: 唬壍, width: 琛壍, onLeft: 錊壍, onRight: 忹壍, onSize: 绨壍, onRemove: 鷗壍, onConfigure: 櫆壍, extraMenu: 覵壍, className: 嚤壍, style: 疓壍, bodyClassName: 钂壍, resetKey: 慱壍, onNeedRows: 聠壍, children: 齏壍 } = 庁壍;
    const 氾壍 = useRef<HTMLElement>(null);
    const 謭壍 = useRef<HTMLDivElement>(null);
    const 堜壍 = useRef<HTMLDivElement>(null);
    const [看壍, 闺壍] = useState<MenuItem[]>([]);
    const [择壍, 臘壍] = useState<string[]>([]);
    const [仇壍, 涶壍] = useState<string | null>(null);
    const 貥壍 = useMemo<Chrome>(() => ({ setMenu: 闺壍, setHints: 臘壍, setSubtitle: 涶壍 }), []);
    const [妔壍, 碃壍] = useState<import("echarts/core").EChartsType[]>([]);
    const 靲壍 = useMemo<ChartRegistry>(() => ({
        register: (摡壍) => {
            碃壍((荐壍) => [...荐壍, 摡壍]);
            return () => 碃壍((倿壍) => 倿壍.filter((漮壍) => 漮壍 !== 摡壍));
        },
    }), []);
    const 踝壍: MenuItem[] = 妔壍.length
        ? [
            {
                label: "Download PNG",
                onSelect: () => {
                    const 嬌壍 = 妔壍[0];
                    if (!嬌壍)
                        return;
                    void chartToPng(嬌壍, readChartTokens().surface).then((移壍) => (移壍 ? saveBlob(移壍, `${鱟壍.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`) : toast("Couldn't export this chart", { tone: "crit" })));
                },
            },
        ]
        : [];
    const 飪壍 = [...看壍, ...踝壍, ...(覵壍 ?? [])];
    const 旙壍 = `w-${絰壍}-title`;
    const 蓈壍 = !!聠壍;
    const 冷壍 = useEffectEvent((炦壍: number) => 聠壍?.(炦壍));
    useEffect(() => {
        const 辕壍 = 氾壍.current;
        const 岄壍 = 謭壍.current;
        const 筳壍 = 堜壍.current;
        if (!蓈壍 || !辕壍 || !岄壍 || !筳壍)
            return;
        let 驢壍 = 0;
        const 村壍 = () => {
            cancelAnimationFrame(驢壍);
            驢壍 = requestAnimationFrame(() => {
                const 虀壍 = 筳壍.offsetHeight - 岄壍.clientHeight;
                if (虀壍 > 1)
                    冷壍(rowsForPx(辕壍.offsetHeight + 虀壍));
            });
        };
        const 匯壍 = new ResizeObserver(村壍);
        匯壍.observe(筳壍);
        匯壍.observe(岄壍);
        return () => {
            匯壍.disconnect();
            cancelAnimationFrame(驢壍);
        };
    }, [蓈壍]);
    return (<section ref={氾壍} aria-labelledby={旙壍} className={cn("group/widget flex min-h-0 min-w-0 animate-fade-up flex-col gap-[18px] rounded-card border bg-card p-[22px] shadow-card", 唬壍 ? "border-teal/30" : "border-line", 嚤壍)} style={疓壍}>
      <div className={cn("flex items-center gap-3", 唬壍 && "rgl-handle cursor-grab active:cursor-grabbing")}>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id={旙壍} className="m-0 truncate font-display text-base font-semibold tracking-title">
            {鱟壍}
          </h2>
          <div className="flex min-w-0 items-center gap-2">
            <span className="meta truncate">{仇壍 ?? 楎壍}</span>
            {择壍.length ? (<Tooltip content={`Not applied here: ${择壍.join(", ")}. This widget's data has no such field.`}>
                <span className="cursor-help font-mono text-micro text-faint" aria-label={`Filters not applied: ${择壍.join(", ")}`}>
                  ⓘ
                </span>
              </Tooltip>) : null}
          </div>
        </div>
        {!唬壍 && 蠽壍 ? (<Link href={蠽壍.href} className="text-xs whitespace-nowrap text-accent">
            {蠽壍.label} →
          </Link>) : null}
        {!唬壍 && 飪壍.length ? (<Menu trigger={<button type="button" aria-label={`${鱟壍} options`} className="grid size-7 place-items-center rounded-pill text-muted opacity-60 transition-opacity group-hover/widget:opacity-100 hover:bg-fill focus-visible:opacity-100">
                ⋯
              </button>} items={飪壍}/>) : null}
        {唬壍 ? (<div className="rgl-no-drag flex gap-1">
            {錊壍 ? (<IconButton label={`Move ${鱟壍} earlier`} onClick={錊壍}>
                ←
              </IconButton>) : null}
            {忹壍 ? (<IconButton label={`Move ${鱟壍} later`} onClick={忹壍}>
                →
              </IconButton>) : null}
            {绨壍 ? (<button type="button" onClick={绨壍} aria-label={`Resize ${鱟壍}, currently ${SIZE_LABEL[琛壍] ?? `${琛壍}/12`}`} className="grid h-7 place-items-center rounded-pill border border-teal/30 px-2.5 font-mono text-micro text-accent hover:border-teal/60">
                {SIZE_LABEL[琛壍] ?? `${琛壍}/12`}
              </button>) : null}
            {櫆壍 ? (<IconButton label={`Configure ${鱟壍}`} onClick={櫆壍}>
                ⚙
              </IconButton>) : null}
            {鷗壍 ? (<IconButton label={`Remove ${鱟壍}`} onClick={鷗壍}>
                ×
              </IconButton>) : null}
          </div>) : null}
      </div>
      <div ref={謭壍} className={cn("relative flex min-h-0 flex-1 flex-col", 蓈壍 && "overflow-hidden", 钂壍)}>
        <div ref={堜壍} className={cn("flex flex-col", 蓈壍 ? "flex-[1_0_auto]" : "min-h-0 flex-1")}>
          <饯壍.Provider value={貥壍}>
            <ChartRegistryContext.Provider value={靲壍}>
              <髧壍 resetKey={慱壍}>{齏壍}</髧壍>
            </ChartRegistryContext.Provider>
          </饯壍.Provider>
        </div>
      </div>
    </section>);
}
