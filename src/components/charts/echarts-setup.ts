import { BarChart, FunnelChart, GaugeChart, HeatmapChart, LineChart, PieChart, ScatterChart, TreemapChart } from "echarts/charts";
import { AriaComponent, DatasetComponent, GraphicComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, MarkPointComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { LabelLayout, UniversalTransition } from "echarts/features";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";
echarts.use([
    LineChart,
    BarChart,
    PieChart,
    HeatmapChart,
    ScatterChart,
    TreemapChart,
    GaugeChart,
    FunnelChart,
    GridComponent,
    GraphicComponent,
    TooltipComponent,
    LegendComponent,
    MarkLineComponent,
    MarkAreaComponent,
    MarkPointComponent,
    DatasetComponent,
    VisualMapComponent,
    AriaComponent,
    LabelLayout,
    UniversalTransition,
    SVGRenderer,
    CanvasRenderer,
]);
export { echarts };
