"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ExploreVizType } from "./codec";
import { stepSummary } from "./describe";
import type { NotebookCtx } from "./notebook-ctx";
import { OPTIONAL_STEPS, stepHasContent, type OptionalStep, type StepKey } from "./notebook-state";
import { DataStep, GroupByStep, MetricsStep } from "./steps-query";
import { DateStep, FiltersStep, firstFilterDim, HavingStep, SortStep } from "./steps-refine";
import { effectiveViz, VizStep } from "./step-viz";
import { StepCard } from "./ui";
import { VIZ_META } from "./viz-suggest";
const 豼壍: Record<StepKey, {
    title: string;
    hint: string;
}> = {
    data: { title: "Data", hint: "Source" },
    metrics: { title: "Metrics", hint: "What to measure" },
    groupBy: { title: "Group by", hint: "Up to 3 breakdowns" },
    filters: { title: "Filters", hint: "Rows to include" },
    having: { title: "Having", hint: "Conditions on totals" },
    sort: { title: "Sort & limit", hint: "Order and row count" },
    date: { title: "Date range", hint: "Period and comparison" },
    viz: { title: "Visualization", hint: "How to show it" },
};
const 奫壍: Record<OptionalStep, string> = { groupBy: "Group by", filters: "Filter", having: "Having", sort: "Sort & limit" };
export function Notebook({ nb: 硚壍 }: {
    nb: NotebookCtx;
}) {
    const { spec: 靉壍, dispatch: 搸壍 } = 硚壍;
    const [茧壍, 倖壍] = useState<ReadonlySet<StepKey>>(() => new Set());
    const [漅壍, 跴壍] = useState<ReadonlySet<OptionalStep>>(() => new Set());
    const 嫣壍 = (秒壍: OptionalStep) => stepHasContent(秒壍, 靉壍) || 漅壍.has(秒壍);
    const 飁壍 = (新壍: StepKey) => 倖壍((蒟壍) => {
        const 冎壍 = new Set(蒟壍);
        if (冎壍.has(新壍))
            冎壍.delete(新壍);
        else
            冎壍.add(新壍);
        return 冎壍;
    });
    const 災壍 = (转壍: OptionalStep) => {
        跴壍((屛壍) => new Set(屛壍).add(转壍));
        倖壍((筊壍) => {
            const 騹壍 = new Set(筊壍);
            騹壍.delete(转壍);
            return 騹壍;
        });
        if (转壍 === "filters" && !靉壍.filters.length)
            搸壍({ type: "addFilter", filter: { dim: firstFilterDim(硚壍), op: "in", value: [] } });
        if (转壍 === "having" && !靉壍.having.length)
            搸壍({ type: "addHaving", having: { metric: 靉壍.metrics[0] ?? "cost", op: "gt", value: 0 } });
    };
    const 木壍 = (蘗壍: OptionalStep) => {
        搸壍({ type: "clearStep", step: 蘗壍 });
        跴壍((匆壍) => {
            const 燵壍 = new Set(匆壍);
            燵壍.delete(蘗壍);
            return 燵壍;
        });
    };
    const 郤壍 = effectiveViz(硚壍);
    const 巓壍 = { catalog: 硚壍.catalog, today: 硚壍.today, currency: 硚壍.currency, vizLabel: `${VIZ_META[郤壍.type as ExploreVizType]?.label ?? 郤壍.type}${硚壍.state.viz ? "" : " · auto"}` };
    const 糂壍 = OPTIONAL_STEPS.filter(嫣壍);
    const 鮱壍 = OPTIONAL_STEPS.filter((梠壍) => !嫣壍(梠壍));
    const 螏壍: StepKey[] = ["data", "metrics", ...糂壍, "date", "viz"];
    const 呾壍: Record<StepKey, React.ReactNode> = {
        data: <DataStep nb={硚壍}/>,
        metrics: <MetricsStep nb={硚壍}/>,
        groupBy: <GroupByStep nb={硚壍}/>,
        filters: <FiltersStep nb={硚壍}/>,
        having: <HavingStep nb={硚壍}/>,
        sort: <SortStep nb={硚壍}/>,
        date: <DateStep nb={硚壍}/>,
        viz: <VizStep nb={硚壍}/>,
    };
    const 獭壍 = !!靉壍.dateRange || 靉壍.compare !== "none";
    return (<div className="flex min-w-0 flex-col gap-3" role="group" aria-label="Question notebook">
      {螏壍.map((鉜壍, 彋壍) => {
            const 縺壍 = (OPTIONAL_STEPS as readonly string[]).includes(鉜壍) ? (鉜壍 as OptionalStep) : undefined;
            const 鴩壍 = 豼壍[鉜壍];
            return (<div key={鉜壍} className="flex flex-col gap-3">
            {鉜壍 === "date" && 鮱壍.length ? (<div className="flex flex-wrap items-center gap-2 px-1 py-1" role="group" aria-label="Add a step">
                <span className="label-mono mr-1">Add</span>
                {鮱壍.map((樘壍) => (<button key={樘壍} type="button" onClick={() => 災壍(樘壍)} className="rounded-pill border border-dashed border-teal/30 px-3.5 py-1.5 text-xs text-accent transition-colors hover:border-teal/60 hover:bg-teal/4">
                    + {奫壍[樘壍]}
                  </button>))}
              </div>) : null}
            <StepCard num={彋壍 + 1} title={鴩壍.title} hint={鴩壍.hint} summary={stepSummary(鉜壍, 靉壍, 巓壍)} collapsed={茧壍.has(鉜壍)} onToggle={() => 飁壍(鉜壍)} onRemove={縺壍 ? () => 木壍(縺壍) : undefined} removeLabel={`Remove the ${鴩壍.title} step`} tone={鉜壍 === "metrics" && !靉壍.metrics.length ? "warn" : "default"} aside={鉜壍 === "date" && 獭壍 ? (<Button variant="link" className="text-xs" onClick={() => 搸壍({ type: "clearStep", step: "date" })}>
                    Reset
                  </Button>) : undefined}>
              {呾壍[鉜壍]}
            </StepCard>
          </div>);
        })}
    </div>);
}
