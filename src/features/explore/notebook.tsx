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
const TITLES: Record<StepKey, {
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
const ADD_LABEL: Record<OptionalStep, string> = { groupBy: "Group by", filters: "Filter", having: "Having", sort: "Sort & limit" };
export function Notebook({ nb }: {
    nb: NotebookCtx;
}) {
    const { spec, dispatch } = nb;
    const [collapsed, setCollapsed] = useState<ReadonlySet<StepKey>>(() => new Set());
    const [opened, setOpened] = useState<ReadonlySet<OptionalStep>>(() => new Set());
    const visible = (s: OptionalStep) => stepHasContent(s, spec) || opened.has(s);
    const toggle = (k: StepKey) => setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(k))
            next.delete(k);
        else
            next.add(k);
        return next;
    });
    const open = (s: OptionalStep) => {
        setOpened((prev) => new Set(prev).add(s));
        setCollapsed((prev) => {
            const next = new Set(prev);
            next.delete(s);
            return next;
        });
        if (s === "filters" && !spec.filters.length)
            dispatch({ type: "addFilter", filter: { dim: firstFilterDim(nb), op: "in", value: [] } });
        if (s === "having" && !spec.having.length)
            dispatch({ type: "addHaving", having: { metric: spec.metrics[0] ?? "cost", op: "gt", value: 0 } });
    };
    const remove = (s: OptionalStep) => {
        dispatch({ type: "clearStep", step: s });
        setOpened((prev) => {
            const next = new Set(prev);
            next.delete(s);
            return next;
        });
    };
    const viz = effectiveViz(nb);
    const ctx = { catalog: nb.catalog, today: nb.today, currency: nb.currency, vizLabel: `${VIZ_META[viz.type as ExploreVizType]?.label ?? viz.type}${nb.state.viz ? "" : " · auto"}` };
    const optional = OPTIONAL_STEPS.filter(visible);
    const hidden = OPTIONAL_STEPS.filter((s) => !visible(s));
    const order: StepKey[] = ["data", "metrics", ...optional, "date", "viz"];
    const body: Record<StepKey, React.ReactNode> = {
        data: <DataStep nb={nb}/>,
        metrics: <MetricsStep nb={nb}/>,
        groupBy: <GroupByStep nb={nb}/>,
        filters: <FiltersStep nb={nb}/>,
        having: <HavingStep nb={nb}/>,
        sort: <SortStep nb={nb}/>,
        date: <DateStep nb={nb}/>,
        viz: <VizStep nb={nb}/>,
    };
    const dateCustomized = !!spec.dateRange || spec.compare !== "none";
    return (<div className="flex min-w-0 flex-col gap-3" role="group" aria-label="Question notebook">
      {order.map((k, i) => {
            const optionalStep = (OPTIONAL_STEPS as readonly string[]).includes(k) ? (k as OptionalStep) : undefined;
            const t = TITLES[k];
            return (<div key={k} className="flex flex-col gap-3">
            {k === "date" && hidden.length ? (<div className="flex flex-wrap items-center gap-2 px-1 py-1" role="group" aria-label="Add a step">
                <span className="label-mono mr-1">Add</span>
                {hidden.map((s) => (<button key={s} type="button" onClick={() => open(s)} className="rounded-pill border border-dashed border-teal/30 px-3.5 py-1.5 text-xs text-accent transition-colors hover:border-teal/60 hover:bg-teal/4">
                    + {ADD_LABEL[s]}
                  </button>))}
              </div>) : null}
            <StepCard num={i + 1} title={t.title} hint={t.hint} summary={stepSummary(k, spec, ctx)} collapsed={collapsed.has(k)} onToggle={() => toggle(k)} onRemove={optionalStep ? () => remove(optionalStep) : undefined} removeLabel={`Remove the ${t.title} step`} tone={k === "metrics" && !spec.metrics.length ? "warn" : "default"} aside={k === "date" && dateCustomized ? (<Button variant="link" className="text-xs" onClick={() => dispatch({ type: "clearStep", step: "date" })}>
                    Reset
                  </Button>) : undefined}>
              {body[k]}
            </StepCard>
          </div>);
        })}
    </div>);
}
