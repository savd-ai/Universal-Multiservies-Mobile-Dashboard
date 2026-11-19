"use client";

import { parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import { useStatus } from "@/lib/api/hooks";
import { useFilters } from "@/lib/filters";
import { campaignRangeQuery, moneyFmtOf, rangeSearchOf } from "./campaign-utils";

// Shared inputs of the Campaigns screens and drawer: status, the top bar's URL slicers (range / compare), the
// display-currency formatter, the /api/campaigns range params and the range part of the URL (carried across the
// list ↔ drawer ↔ detail links).

export function useCampaignContext() {
  const status = useStatus();
  const filters = useFilters(status.data?.today);
  const money = useMemo(() => moneyFmtOf(status.data), [status.data]);
  const query = useMemo(() => campaignRangeQuery(filters.dateRange, filters.compare), [filters.dateRange, filters.compare]);
  const { range, from, to, cmp } = filters.state;
  const rangeSearch = useMemo(() => rangeSearchOf({ range, from, to, cmp }), [range, from, to, cmp]);
  return { status, filters, money, query, rangeSearch, compareOn: filters.compare !== "none" };
}

/** `?campaign=<id>` opens the campaign drawer (pushes history, so Back closes it). */
export function useCampaignParam() {
  return useQueryState("campaign", parseAsString.withOptions({ history: "push", scroll: false }));
}
