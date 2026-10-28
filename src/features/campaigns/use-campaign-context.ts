"use client";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import { useStatus } from "@/lib/api/hooks";
import { useFilters } from "@/lib/filters";
import { campaignRangeQuery, moneyFmtOf, rangeSearchOf } from "./campaign-utils";
export function useCampaignContext() {
    const status = useStatus();
    const filters = useFilters(status.data?.today);
    const money = useMemo(() => moneyFmtOf(status.data), [status.data]);
    const query = useMemo(() => campaignRangeQuery(filters.dateRange, filters.compare), [filters.dateRange, filters.compare]);
    const { range, from: value, to, cmp } = filters.state;
    const rangeSearch = useMemo(() => rangeSearchOf({ range, from: value, to, cmp }), [range, value, to, cmp]);
    return { status, filters, money, query, rangeSearch, compareOn: filters.compare !== "none" };
}
export function useCampaignParam() {
    return useQueryState("campaign", parseAsString.withOptions({ history: "push", scroll: false }));
}
