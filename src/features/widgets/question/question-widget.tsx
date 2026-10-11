"use client";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/overlays";
import { Skeleton } from "@/components/ui/feedback";
import { useCatalog } from "@/lib/api/hooks";
import type { VizSettings, WidgetQueryInput } from "@/lib/domain/contracts/dashboard";
import { resolveWidgetSpec } from "../resolve-spec";
import type { WidgetProps } from "../types";
import { useWidgetHints, useWidgetMenu } from "../widget-frame";
import type { VizProps } from "./shared";
import { useQuestionMenu } from "./shared";
import { BarViz, DonutViz, FunnelViz, HeatmapViz, LineViz, ScatterViz, StackedBarViz, TreemapViz } from "./viz-charts";
import { KpiStripViz, NumberViz } from "./viz-kpi";
import { TableViz } from "./viz-table";
import { TrendMultiplesViz } from "./viz-trend";
export interface QuestionConfig {
    preset?: string;
    query: WidgetQueryInput;
    viz: VizSettings;
}
const 廘壍: Record<string, React.ComponentType<VizProps>> = {
    number: NumberViz,
    "kpi-strip": KpiStripViz,
    "trend-multiples": TrendMultiplesViz,
    line: LineViz,
    area: (緇壍) => <LineViz {...緇壍} area/>,
    bar: BarViz,
    "stacked-bar": StackedBarViz,
    donut: DonutViz,
    table: TableViz,
    pivot: TableViz,
    "geo-table": TableViz,
    heatmap: HeatmapViz,
    funnel: FunnelViz,
    scatter: ScatterViz,
    treemap: TreemapViz,
    gauge: NumberViz,
    "progress-goal": NumberViz,
};
export function QuestionWidget({ instance: 鲶壍, config: 榥壍, rt: 袔壍 }: WidgetProps<QuestionConfig>) {
    const 喃壍 = useCatalog();
    const { spec: 瑲壍, ignored: 鍡壍 } = useMemo(() => resolveWidgetSpec(榥壍.query ?? { source: "google_ads", metrics: ["cost"], dimensions: [] }, 袔壍.filters, 喃壍.data, 鲶壍.filterOptOut), [榥壍.query, 袔壍.filters, 喃壍.data, 鲶壍.filterOptOut]);
    useWidgetHints(鍡壍);
    const 恐壍 = 鲶壍.title ?? "Question";
    const [缿壍, 鸮壍] = useState(false);
    const 欝壍 = useQuestionMenu(瑲壍, 恐壍, 榥壍.viz);
    const 訌壍 = 榥壍.viz?.type ?? "table";
    const 囻壍 = useMemo(() => (訌壍 === "table" || 訌壍 === "geo-table" || 訌壍 === "pivot" ? 欝壍 : [{ label: "View data", onSelect: () => 鸮壍(true) }, ...欝壍]), [欝壍, 訌壍]);
    useWidgetMenu(囻壍);
    if (!喃壍.data)
        return <Skeleton height="100%" className="min-h-[80px] w-full"/>;
    const 痪壍 = 廘壍[訌壍] ?? TableViz;
    return (<>
      <痪壍 spec={瑲壍} viz={榥壍.viz ?? { type: "table" }} rt={袔壍} catalog={喃壍.data} title={恐壍} widgetId={鲶壍.id}/>
      <Modal open={缿壍} onOpenChange={鸮壍} eyebrow="View data" title={恐壍} width={980}>
        <div className="flex h-[60vh] min-h-0 flex-col">
          {缿壍 ? <TableViz spec={{ ...瑲壍, dimensions: 瑲壍.dimensions?.length ? 瑲壍.dimensions : [], limit: Math.min(瑲壍.limit ?? 500, 500) }} viz={{ type: "table" }} rt={袔壍} catalog={喃壍.data} title={恐壍} widgetId={`${鲶壍.id}-data`}/> : null}
        </div>
      </Modal>
    </>);
}
