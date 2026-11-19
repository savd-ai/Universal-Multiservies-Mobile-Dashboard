import type { ComponentType } from "react";
import type { FilterKey, WidgetInstance } from "@/lib/domain/contracts/dashboard";
import type { ResolvedFilters } from "@/lib/filters";
import type { MoneyFmt } from "@/lib/money";

// Widget contract. Every dashboard tile — generic Question widgets and bespoke ones (pacing, anomaly feed, AI
// ideas…) — is a WidgetDefinition in the registry.

export type WidgetCategory = "Performance" | "Budget" | "Monitoring" | "AI" | "Cross-channel" | "Content";

export interface WidgetRuntime {
  filters: ResolvedFilters;
  /** account-local today (the day in progress) */
  today: string;
  /** last complete day of data */
  dataThrough: string;
  /** display currency code (symbols, labels) */
  currency: string;
  /** display currency + conversion factor — pass this to formatters */
  money: MoneyFmt;
  mode: "demo" | "live";
  editing: boolean;
  dashboardId: string;
  /** opens the campaign drawer */
  openCampaign: (id: string) => void;
  /** adds/removes a cross-filter chip for a dimension value */
  toggleCrossFilter: (dim: string, value: string, opts?: { exclude?: boolean }) => void;
}

export interface WidgetProps<C = Record<string, unknown>> {
  instance: WidgetInstance;
  config: C;
  rt: WidgetRuntime;
  size: { w: number; h: number };
  /** persists into the dashboard draft */
  setConfig: (patch: Partial<C>) => void;
}

/** Simple per-widget settings rendered by the config drawer. */
export type ConfigField =
  | { key: string; label: string; kind: "number"; min: number; max: number; step?: number; hint?: string }
  | { key: string; label: string; kind: "select"; options: { value: string; label: string }[]; hint?: string }
  | { key: string; label: string; kind: "metric"; hint?: string }
  | { key: string; label: string; kind: "text"; multiline?: boolean; hint?: string };

export interface WidgetDefinition<C = Record<string, unknown>> {
  type: string;
  title: string;
  subtitle: string;
  category: WidgetCategory;
  description: string;
  keywords?: string[];
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
  defaultConfig: C;
  link?: { href: string; label: string };
  /** dashboard slicers the widget honours (the rest are shown as "not applied") */
  filters: readonly FilterKey[];
  /** editable settings (the Question widget has its own query editor) */
  configFields?: ConfigField[];
  /** content-sized: the frame grows to fit instead of clipping (lists, tables and charts scroll or scale instead) */
  grows?: boolean | ((config: C) => boolean);
  Component: ComponentType<WidgetProps<C>>;
}

export const ALL_FILTERS: readonly FilterKey[] = ["range", "compare", "campaignType", "campaign", "status", "device", "cross"];
