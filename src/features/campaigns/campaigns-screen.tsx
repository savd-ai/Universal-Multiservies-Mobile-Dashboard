"use client";
import { debounce, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/controls";
import { EmptyState, ErrorState, Refetching } from "@/components/ui/feedback";
import { Input } from "@/components/ui/inputs";
import { toast } from "@/components/ui/toast";
import { saveBlob } from "@/lib/api/client";
import { useCampaigns } from "@/lib/api/campaigns";
import type { CampaignListRow } from "@/lib/domain/contracts/actions";
import { CampaignBulkBar } from "./campaign-bulk-bar";
import { CampaignTable, CampaignTableSkeleton, type Density } from "./campaign-table";
import { availableTypes, ColumnChooser, DensityToggle, StatusFilter, TypeChips } from "./campaign-toolbar";
import { adjustBudget, CAMPAIGN_COLUMNS, campaignCsv, DEFAULT_COLUMNS, filterCampaigns, nextSort, parseColumnPref, SORT_KEYS, sortCampaigns, totalsOf, ZERO_METRICS, type ColumnKey } from "./campaign-utils";
import { useCampaignContext, useCampaignParam } from "./use-campaign-context";
import { useCampaignWrites } from "./use-campaign-writes";
import { useStoredPref } from "./use-stored-pref";
const COLUMNS_KEY = "savd.campaigns.columns.v1";
const DENSITY_KEY = "savd.campaigns.density.v1";
const sameKeys = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((k) => b.includes(k));
const viewParsers = {
    q: parseAsString.withDefault(""),
    sort: parseAsStringLiteral(SORT_KEYS).withDefault("cost"),
    dir: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
};
export function CampaignsScreen() {
    const { filters, money, query, compareOn } = useCampaignContext();
    const list = useCampaigns(query);
    const [view, setView] = useQueryStates(viewParsers, { history: "replace", scroll: false });
    const [, setCampaign] = useCampaignParam();
    const [colsRaw, setColsRaw] = useStoredPref(COLUMNS_KEY);
    const [densityRaw, setDensityRaw] = useStoredPref(DENSITY_KEY);
    const [selected, setSelected] = useState<Set<string>>(() => new Set());
    const writes = useCampaignWrites();
    const visibleKeys = useMemo(() => parseColumnPref(colsRaw), [colsRaw]);
    const columns = useMemo(() => CAMPAIGN_COLUMNS.filter((c) => visibleKeys.includes(c.key)), [visibleKeys]);
    const density: Density = densityRaw === "compact" ? "compact" : "comfortable";
    const data = list.data;
    const rows = useMemo(() => sortCampaigns(filterCampaigns(data?.rows ?? [], { q: view.q, types: filters.types, statuses: filters.statuses, campaignIds: filters.campaigns }), view.sort, view.dir), [data, view.q, view.sort, view.dir, filters.types, filters.statuses, filters.campaigns]);
    const totals = useMemo(() => totalsOf(rows.map((r) => r.metrics), rows.map((r) => r.dailyBudget)), [rows]);
    const prevTotals = useMemo(() => (compareOn && data?.prevTotals ? totalsOf(rows.map((r) => r.prev ?? ZERO_METRICS)) : null), [compareOn, data, rows]);
    const selectedRows = rows.filter((r) => selected.has(r.id));
    const types = availableTypes(data ? data.rows.map((r) => r.type) : null, filters.types);
    const hasRemoved = !!data?.rows.some((r) => r.status === "Removed");
    const filtered = !!view.q || filters.types.length > 0 || filters.statuses.length > 0 || filters.campaigns.length > 0;
    const clearFilters = () => {
        void setView({ q: null });
        void filters.set({ types: null, status: null, camps: null });
    };
    const exportCsv = (subset: readonly CampaignListRow[]) => {
        if (!subset.length)
            return;
        const csv = campaignCsv(subset, visibleKeys, money);
        const r = data?.range;
        saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `campaigns${r ? `_${r.start}_${r.end}` : ""}.csv`);
        toast(`Exported ${subset.length} campaign${subset.length === 1 ? "" : "s"} to CSV`);
    };
    const applyBudget = async (pct: number, subset: readonly CampaignListRow[]) => {
        const budgets = subset.filter((r) => r.dailyBudget !== null && r.dailyBudget > 0).map((r) => ({ campaignId: r.id, dailyBudget: adjustBudget(r.dailyBudget ?? 0, pct) }));
        return writes.setBudgets(budgets);
    };
    const headerActions = (<>
      <ColumnChooser visible={visibleKeys} onChange={(next: ColumnKey[]) => setColsRaw(sameKeys(next, DEFAULT_COLUMNS) ? null : JSON.stringify(next))}/>
      <DensityToggle value={density} onChange={(v) => setDensityRaw(v === "comfortable" ? null : v)}/>
      <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => exportCsv(rows)}>
        Export CSV
      </Button>
    </>);
    return (<div className="flex flex-col gap-6">
      <PageHeader actions={headerActions}/>

      <div className="flex flex-wrap items-center gap-3">
        <Input type="search" value={view.q} onChange={(e) => void setView({ q: e.target.value || null }, { limitUrlUpdates: debounce(300) })} placeholder="Search campaigns" aria-label="Search campaigns" className="min-w-[220px] flex-1 py-[11px] sm:max-w-[360px]"/>
        <TypeChips types={types} selected={filters.types} onChange={(next) => void filters.set({ types: next.length ? next : null })}/>
        <span className="hidden flex-1 wide:block"/>
        <StatusFilter selected={filters.statuses} showRemoved={hasRemoved} onChange={(next) => void filters.set({ status: next.length ? next : null })}/>
        {filters.campaigns.length ? (<Chip active onClick={() => void filters.set({ camps: null })} title="Clear the campaign filter">
            {`${filters.campaigns.length} campaign${filters.campaigns.length > 1 ? "s" : ""} ×`}
          </Chip>) : null}
      </div>

      {data?.warnings.length ? <div className="-mt-2 text-xs text-muted-3">{data.warnings.join(" · ")}</div> : null}

      {list.error && !data ? (<ErrorState error={list.error} onRetry={() => void list.refetch()}/>) : !data ? (<CampaignTableSkeleton columns={columns} density={density}/>) : data.rows.length === 0 ? (<EmptyState>No campaigns in this account yet. Campaigns appear here once they have been created in Google Ads.</EmptyState>) : (<Refetching active={list.isFetching && list.isPlaceholderData}>
          <CampaignTable rows={rows} columns={columns} sort={{ key: view.sort, dir: view.dir }} onSort={(key) => {
                const next = nextSort({ key: view.sort, dir: view.dir }, key);
                void setView({ sort: next.key, dir: next.dir });
            }} totals={totals} prevTotals={prevTotals} accountCpa={data.totals.cpa} money={money} density={density} selected={selected} onSelectedChange={setSelected} onOpen={(id) => void setCampaign(id)} onToggleStatus={(r) => void writes.setStatus([r.id], r.status === "Enabled" ? "Paused" : "Enabled")} pending={writes.pending} empty={filtered ? (<span>
                  No campaigns match these filters.{" "}
                  <button type="button" onClick={clearFilters} className="text-accent hover:opacity-85">
                    Clear filters
                  </button>
                </span>) : ("No campaigns.")}/>
        </Refetching>)}

      {selectedRows.length ? (<CampaignBulkBar rows={selectedRows} money={money} busy={writes.busy} onClear={() => setSelected(new Set())} onStatus={(ids, status) => void writes.setStatus(ids, status)} onBudget={applyBudget} onExport={() => exportCsv(selectedRows)}/>) : null}
      {writes.dialog}
    </div>);
}
