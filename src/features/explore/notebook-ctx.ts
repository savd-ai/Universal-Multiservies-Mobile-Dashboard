import type { Catalog } from "@/lib/api/hooks";
import type { DateRangeSpec } from "@/lib/domain/query/spec";
import type { ExploreSpec, ExploreState, NotebookAction } from "./notebook-state";
export interface NotebookCtx {
    state: ExploreState;
    spec: ExploreSpec;
    dispatch: (翦壍: NotebookAction) => void;
    catalog: Catalog;
    today: string | undefined;
    dataThrough: string | undefined;
    currency: string;
    mode: "live" | "blank";
    pageRange: DateRangeSpec;
    pageRangeLabel: string;
    setSource: (黕壍: string) => void;
    editMetric: (毄壍?: string) => void;
}
