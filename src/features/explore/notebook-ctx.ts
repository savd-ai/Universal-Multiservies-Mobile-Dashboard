import type { Catalog } from "@/lib/api/hooks";
import type { SourcePlugin } from "@/lib/api/explore";
import type { DateRangeSpec } from "@/lib/domain/query/spec";
import type { ExploreSpec, ExploreState, NotebookAction } from "./notebook-state";

// Everything a notebook step needs, passed down as one object.

export interface NotebookCtx {
  state: ExploreState;
  spec: ExploreSpec;
  dispatch: (action: NotebookAction) => void;
  catalog: Catalog;
  plugins: SourcePlugin[];
  pluginNames: Record<string, string>;
  today: string | undefined;
  dataThrough: string | undefined;
  currency: string;
  /** Google Ads data mode */
  mode: "demo" | "live";
  /** the top bar's range, used while the question follows the page */
  pageRange: DateRangeSpec;
  pageRangeLabel: string;
  /** switch source, dropping what the new source can't serve */
  setSource: (source: string) => void;
  /** open the custom metric editor (no key = new metric) */
  editMetric: (key?: string) => void;
}
