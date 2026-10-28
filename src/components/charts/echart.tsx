"use client";
import type { EChartsType } from "echarts/core";
import { useContext, useEffect, useEffectEvent, useRef, useState } from "react";
import { ChartRegistryContext } from "./chart-context";
import { cn } from "@/components/ui/cn";
import { useChartTokens, type ChartTokens } from "./tokens";
type EchartsModule = typeof import("./echarts-setup");
let modPromise: Promise<EchartsModule> | null = null;
const loadEcharts = () => (modPromise ??= import("./echarts-setup"));
export interface EChartEvents {
    click?: (params: Record<string, unknown>) => void;
}
interface EChartProps {
    build: (t: ChartTokens) => Record<string, unknown>;
    deps: readonly unknown[];
    renderer?: "svg" | "canvas";
    height?: number | string;
    className?: string;
    ariaLabel: string;
    events?: EChartEvents;
    group?: string;
    onInstance?: (chart: EChartsType | null) => void;
}
export function EChart({ build, deps, renderer = "svg", height = "100%", className, ariaLabel, events, group, onInstance }: EChartProps) {
    const el = useRef<HTMLDivElement>(null);
    const chart = useRef<EChartsType | null>(null);
    const tokens = useChartTokens();
    const registry = useContext(ChartRegistryContext);
    const [ready, setReady] = useState(false);
    const buildOption = useEffectEvent((t: ChartTokens) => build(t));
    const onClick = useEffectEvent((p: Record<string, unknown>) => events?.click?.(p));
    const onInst = useEffectEvent((c: EChartsType | null) => onInstance?.(c));
    useEffect(() => {
        const node = el.current;
        if (!node)
            return;
        let disposed = false;
        let ro: ResizeObserver | null = null;
        let frame = 0;
        const tryInit = async () => {
            if (chart.current || disposed)
                return;
            if (node.clientWidth === 0 || node.clientHeight === 0)
                return;
            const { echarts } = await loadEcharts();
            if (disposed || chart.current)
                return;
            const inst = echarts.init(node, undefined, { renderer });
            chart.current = inst;
            if (group) {
                inst.group = group;
                echarts.connect(group);
            }
            inst.on("click", (p) => onClick(p as unknown as Record<string, unknown>));
            onInst(inst);
            setReady(true);
        };
        ro = new ResizeObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                if (!chart.current)
                    void tryInit();
                else
                    chart.current.resize();
            });
        });
        ro.observe(node);
        void tryInit();
        return () => {
            disposed = true;
            cancelAnimationFrame(frame);
            ro?.disconnect();
            chart.current?.dispose();
            chart.current = null;
            onInst(null);
        };
    }, [renderer, group]);
    useEffect(() => {
        if (!ready || !chart.current || !registry)
            return;
        return registry.register(chart.current);
    }, [ready, registry]);
    useEffect(() => {
        if (!ready || !chart.current)
            return;
        chart.current.setOption(buildOption(tokens), { notMerge: true, lazyUpdate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, tokens, ...deps]);
    return <div ref={el} role="img" aria-label={ariaLabel} className={cn("w-full min-w-0", className)} style={{ height }}/>;
}
