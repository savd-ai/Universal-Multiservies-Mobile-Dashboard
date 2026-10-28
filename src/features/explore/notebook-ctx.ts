import type { Catalog } from "@/lib/api/hooks";
import type { DateRangeSpec } from "@/lib/domain/query/spec";
import type { ExploreSpec, ExploreState, NotebookAction } from "./notebook-state";
export interface NotebookCtx {
    state: ExploreState;
    spec: ExploreSpec;
    dispatch: (action: NotebookAction) => void;
    catalog: Catalog;
    today: string | undefined;
    dataThrough: string | undefined;
    currency: string;
    mode: "live" | "blank";
    pageRange: DateRangeSpec;
    pageRangeLabel: string;
    setSource: (source: string) => void;
    editMetric: (key?: string) => void;
}
