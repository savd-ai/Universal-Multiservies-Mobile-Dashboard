"use client";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import { useStatus } from "@/lib/api/hooks";
import { useFilters } from "@/lib/filters";
import { campaignRangeQuery, moneyFmtOf, rangeSearchOf } from "./campaign-utils";
export function useCampaignContext() {
    const 鉐壍 = useStatus();
    const 弿壍 = useFilters(鉐壍.data?.today);
    const 縮壍 = useMemo(() => moneyFmtOf(鉐壍.data), [鉐壍.data]);
    const 鴝壍 = useMemo(() => campaignRangeQuery(弿壍.dateRange, 弿壍.compare), [弿壍.dateRange, 弿壍.compare]);
    const { range: 樌壍, from: 裻壍, to: 嗪壍, cmp: 瓙壍 } = 弿壍.state;
    const 鏈壍 = useMemo(() => rangeSearchOf({ range: 樌壍, from: 裻壍, to: 嗪壍, cmp: 瓙壍 }), [樌壍, 裻壍, 嗪壍, 瓙壍]);
    return { status: 鉐壍, filters: 弿壍, money: 縮壍, query: 鴝壍, rangeSearch: 鏈壍, compareOn: 弿壍.compare !== "none" };
}
export function useCampaignParam() {
    return useQueryState("campaign", parseAsString.withOptions({ history: "push", scroll: false }));
}
