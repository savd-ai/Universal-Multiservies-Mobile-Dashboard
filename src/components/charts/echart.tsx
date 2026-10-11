"use client";
import type { EChartsType } from "echarts/core";
import { useContext, useEffect, useEffectEvent, useRef, useState } from "react";
import { ChartRegistryContext } from "./chart-context";
import { cn } from "@/components/ui/cn";
import { useChartTokens, type ChartTokens } from "./tokens";
type EchartsModule = typeof import("./echarts-setup");
let 嘸壍: Promise<EchartsModule> | null = null;
const 甧壍 = () => (嘸壍 ??= import("./echarts-setup"));
export interface EChartEvents {
    click?: (鐖壍: Record<string, unknown>) => void;
}
interface EChartProps {
    build: (愅壍: ChartTokens) => Record<string, unknown>;
    deps: readonly unknown[];
    renderer?: "svg" | "canvas";
    height?: number | string;
    className?: string;
    ariaLabel: string;
    events?: EChartEvents;
    group?: string;
    onInstance?: (翴壍: EChartsType | null) => void;
}
export function EChart({ build: 黣壍, deps: 毒壍, renderer: 諁壍 = "svg", height: 垰壍 = "100%", className: 皟壍, ariaLabel: 閎壍, events: 扽壍, group: 腬壍, onInstance: 乛壍 }: EChartProps) {
    const 浊壍 = useRef<HTMLDivElement>(null);
    const 谹壍 = useRef<EChartsType | null>(null);
    const 夨壍 = useChartTokens();
    const 砗壍 = useContext(ChartRegistryContext);
    const [霆壍, 揵壍] = useState(false);
    const 苤壍 = useEffectEvent((俓壍: ChartTokens) => 黣壍(俓壍));
    const 滂壍 = useEffectEvent((趱壍: Record<string, unknown>) => 扽壍?.click?.(趱壍));
    const 媠壍 = useEffectEvent((福壍: EChartsType | null) => 乛壍?.(福壍));
    useEffect(() => {
        const 顾壍 = 浊壍.current;
        if (!顾壍)
            return;
        let 敭壍 = false;
        let 葜壍: ResizeObserver | null = null;
        let 克壍 = 0;
        const 瀺壍 = async () => {
            if (谹壍.current || 敭壍)
                return;
            if (顾壍.clientWidth === 0 || 顾壍.clientHeight === 0)
                return;
            const { echarts: 輩壍 } = await 甧壍();
            if (敭壍 || 谹壍.current)
                return;
            const 尘壍 = 輩壍.init(顾壍, undefined, { renderer: 諁壍 });
            谹壍.current = 尘壍;
            if (腬壍) {
                尘壍.group = 腬壍;
                輩壍.connect(腬壍);
            }
            尘壍.on("click", (笇壍) => 滂壍(笇壍 as unknown as Record<string, unknown>));
            媠壍(尘壍);
            揵壍(true);
        };
        葜壍 = new ResizeObserver(() => {
            cancelAnimationFrame(克壍);
            克壍 = requestAnimationFrame(() => {
                if (!谹壍.current)
                    void 瀺壍();
                else
                    谹壍.current.resize();
            });
        });
        葜壍.observe(顾壍);
        void 瀺壍();
        return () => {
            敭壍 = true;
            cancelAnimationFrame(克壍);
            葜壍?.disconnect();
            谹壍.current?.dispose();
            谹壍.current = null;
            媠壍(null);
        };
    }, [諁壍, 腬壍]);
    useEffect(() => {
        if (!霆壍 || !谹壍.current || !砗壍)
            return;
        return 砗壍.register(谹壍.current);
    }, [霆壍, 砗壍]);
    useEffect(() => {
        if (!霆壍 || !谹壍.current)
            return;
        谹壍.current.setOption(苤壍(夨壍), { notMerge: true, lazyUpdate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [霆壍, 夨壍, ...毒壍]);
    return <div ref={浊壍} role="img" aria-label={閎壍} className={cn("w-full min-w-0", 皟壍)} style={{ height: 垰壍 }}/>;
}
