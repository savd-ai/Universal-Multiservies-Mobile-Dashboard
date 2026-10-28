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
const VIZ: Record<string, React.ComponentType<VizProps>> = {
    number: NumberViz,
    "kpi-strip": KpiStripViz,
    "trend-multiples": TrendMultiplesViz,
    line: LineViz,
    area: (p) => <LineViz {...p} area/>,
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
export function QuestionWidget({ instance, config, rt }: WidgetProps<QuestionConfig>) {
    const catalog = useCatalog();
    const { spec, ignored } = useMemo(() => resolveWidgetSpec(config.query ?? { source: "google_ads", metrics: ["cost"], dimensions: [] }, rt.filters, catalog.data, instance.filterOptOut), [config.query, rt.filters, catalog.data, instance.filterOptOut]);
    useWidgetHints(ignored);
    const title = instance.title ?? "Question";
    const [showData, setShowData] = useState(false);
    const baseMenu = useQuestionMenu(spec, title, config.viz);
    const vizType = config.viz?.type ?? "table";
    const menu = useMemo(() => (vizType === "table" || vizType === "geo-table" || vizType === "pivot" ? baseMenu : [{ label: "View data", onSelect: () => setShowData(true) }, ...baseMenu]), [baseMenu, vizType]);
    useWidgetMenu(menu);
    if (!catalog.data)
        return <Skeleton height="100%" className="min-h-[80px] w-full"/>;
    const Viz = VIZ[vizType] ?? TableViz;
    return (<>
      <Viz spec={spec} viz={config.viz ?? { type: "table" }} rt={rt} catalog={catalog.data} title={title} widgetId={instance.id}/>
      <Modal open={showData} onOpenChange={setShowData} eyebrow="View data" title={title} width={980}>
        <div className="flex h-[60vh] min-h-0 flex-col">
          {showData ? <TableViz spec={{ ...spec, dimensions: spec.dimensions?.length ? spec.dimensions : [], limit: Math.min(spec.limit ?? 500, 500) }} viz={{ type: "table" }} rt={rt} catalog={catalog.data} title={title} widgetId={`${instance.id}-data`}/> : null}
        </div>
      </Modal>
    </>);
}
