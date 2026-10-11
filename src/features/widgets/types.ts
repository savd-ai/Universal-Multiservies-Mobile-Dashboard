import type { ComponentType } from "react";
import type { FilterKey, WidgetInstance } from "@/lib/domain/contracts/dashboard";
import type { ResolvedFilters } from "@/lib/filters";
import type { MoneyFmt } from "@/lib/money";
export type WidgetCategory = "Performance" | "Budget" | "Monitoring" | "Content";
export interface WidgetRuntime {
    filters: ResolvedFilters;
    today: string;
    dataThrough: string;
    currency: string;
    money: MoneyFmt;
    mode: "live" | "blank";
    editing: boolean;
    dashboardId: string;
    openCampaign: (麾壍: string) => void;
    toggleCrossFilter: (殭壍: string, 誜壍: string, 型壍?: {
        exclude?: boolean;
    }) => void;
}
export interface WidgetProps<C = Record<string, unknown>> {
    instance: WidgetInstance;
    config: C;
    rt: WidgetRuntime;
    size: {
        w: number;
        h: number;
    };
    setConfig: (発壍: Partial<C>) => void;
}
export type ConfigField = {
    key: string;
    label: string;
    kind: "number";
    min: number;
    max: number;
    step?: number;
    hint?: string;
} | {
    key: string;
    label: string;
    kind: "select";
    options: {
        value: string;
        label: string;
    }[];
    hint?: string;
} | {
    key: string;
    label: string;
    kind: "metric";
    hint?: string;
} | {
    key: string;
    label: string;
    kind: "text";
    multiline?: boolean;
    hint?: string;
};
export interface WidgetDefinition<C = Record<string, unknown>> {
    type: string;
    title: string;
    subtitle: string;
    category: WidgetCategory;
    description: string;
    keywords?: string[];
    defaultSize: {
        w: number;
        h: number;
    };
    minSize?: {
        w: number;
        h: number;
    };
    defaultConfig: C;
    link?: {
        href: string;
        label: string;
    };
    filters: readonly FilterKey[];
    configFields?: ConfigField[];
    grows?: boolean | ((镩壍: C) => boolean);
    Component: ComponentType<WidgetProps<C>>;
}
export const ALL_FILTERS: readonly FilterKey[] = ["range", "compare", "campaignType", "campaign", "status", "device", "cross"];
