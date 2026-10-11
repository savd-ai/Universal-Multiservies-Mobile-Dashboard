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
const 诓壍 = "savd.campaigns.columns.v1";
const 壂壍 = "savd.campaigns.density.v1";
const 瞱壍 = (隠壍: readonly string[], 掏壍: readonly string[]) => 隠壍.length === 掏壍.length && 隠壍.every((艾壍) => 掏壍.includes(艾壍));
const 佭壍 = {
    q: parseAsString.withDefault(""),
    sort: parseAsStringLiteral(SORT_KEYS).withDefault("cost"),
    dir: parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc"),
};
export function CampaignsScreen() {
    const { filters: 湜壍, money: 赋壍, query: 娺壍, compareOn: 礩壍 } = useCampaignContext();
    const 領壍 = useCampaigns(娺壍);
    const [攇壍, 菶壍] = useQueryStates(佭壍, { history: "replace", scroll: false });
    const [, 僥壍] = useCampaignParam();
    const [濔壍, 軃壍] = useStoredPref(诓壍);
    const [宲壍, 窡壍] = useStoredPref(壂壍);
    const [馐壍, 晿壍] = useState<Set<string>>(() => new Set());
    const 蕮壍 = useCampaignWrites();
    const 剝壍 = useMemo(() => parseColumnPref(濔壍), [濔壍]);
    const 煌壍 = useMemo(() => CAMPAIGN_COLUMNS.filter((逻壍) => 剝壍.includes(逻壍.key)), [剝壍]);
    const 崪壍: Density = 宲壍 === "compact" ? "compact" : "comfortable";
    const 簙壍 = 領壍.data;
    const 鬈壍 = useMemo(() => sortCampaigns(filterCampaigns(簙壍?.rows ?? [], { q: 攇壍.q, types: 湜壍.types, statuses: 湜壍.statuses, campaignIds: 湜壍.campaigns }), 攇壍.sort, 攇壍.dir), [簙壍, 攇壍.q, 攇壍.sort, 攇壍.dir, 湜壍.types, 湜壍.statuses, 湜壍.campaigns]);
    const 柷壍 = useMemo(() => totalsOf(鬈壍.map((蛦壍) => 蛦壍.metrics), 鬈壍.map((叕壍) => 叕壍.dailyBudget)), [鬈壍]);
    const 狄壍 = useMemo(() => (礩壍 && 簙壍?.prevTotals ? totalsOf(鬈壍.map((醳壍) => 醳壍.prev ?? ZERO_METRICS)) : null), [礩壍, 簙壍, 鬈壍]);
    const 庢壍 = 鬈壍.filter((綑壍) => 馐壍.has(綑壍.id));
    const 鲀壍 = availableTypes(簙壍 ? 簙壍.rows.map((楯壍) => 楯壍.type) : null, 湜壍.types);
    const 衞壍 = !!簙壍?.rows.some((啍壍) => 啍壍.status === "Removed");
    const 琼壍 = !!攇壍.q || 湜壍.types.length > 0 || 湜壍.statuses.length > 0 || 湜壍.campaigns.length > 0;
    const 錫壍 = () => {
        void 菶壍({ q: null });
        void 湜壍.set({ types: null, status: null, camps: null });
    };
    const 怚壍 = (缉壍: readonly CampaignListRow[]) => {
        if (!缉壍.length)
            return;
        const 鷸壍 = campaignCsv(缉壍, 剝壍, 赋壍);
        const 櫧壍 = 簙壍?.range;
        saveBlob(new Blob([鷸壍], { type: "text/csv;charset=utf-8" }), `campaigns${櫧壍 ? `_${櫧壍.start}_${櫧壍.end}` : ""}.csv`);
        toast(`Exported ${缉壍.length} campaign${缉壍.length === 1 ? "" : "s"} to CSV`);
    };
    const 觖壍 = async (囅壍: number, 疴壍: readonly CampaignListRow[]) => {
        const 钣壍 = 疴壍.filter((憒壍) => 憒壍.dailyBudget !== null && 憒壍.dailyBudget > 0).map((肁壍) => ({ campaignId: 肁壍.id, dailyBudget: adjustBudget(肁壍.dailyBudget ?? 0, 囅壍) }));
        return 蕮壍.setBudgets(钣壍);
    };
    const 齰壍 = (<>
      <ColumnChooser visible={剝壍} onChange={(江壍: ColumnKey[]) => 軃壍(瞱壍(江壍, DEFAULT_COLUMNS) ? null : JSON.stringify(江壍))}/>
      <DensityToggle value={崪壍} onChange={(譎壍) => 窡壍(譎壍 === "comfortable" ? null : 譎壍)}/>
      <Button variant="outline" size="sm" disabled={!鬈壍.length} onClick={() => 怚壍(鬈壍)}>
        Export CSV
      </Button>
    </>);
    return (<div className="flex flex-col gap-6">
      <PageHeader actions={齰壍}/>

      <div className="flex flex-wrap items-center gap-3">
        <Input type="search" value={攇壍.q} onChange={(堽壍) => void 菶壍({ q: 堽壍.target.value || null }, { limitUrlUpdates: debounce(300) })} placeholder="Search campaigns" aria-label="Search campaigns" className="min-w-[220px] flex-1 py-[11px] sm:max-w-[360px]"/>
        <TypeChips types={鲀壍} selected={湜壍.types} onChange={(眬壍) => void 湜壍.set({ types: 眬壍.length ? 眬壍 : null })}/>
        <span className="hidden flex-1 wide:block"/>
        <StatusFilter selected={湜壍.statuses} showRemoved={衞壍} onChange={(阛壍) => void 湜壍.set({ status: 阛壍.length ? 阛壍 : null })}/>
        {湜壍.campaigns.length ? (<Chip active onClick={() => void 湜壍.set({ camps: null })} title="Clear the campaign filter">
            {`${湜壍.campaigns.length} campaign${湜壍.campaigns.length > 1 ? "s" : ""} ×`}
          </Chip>) : null}
      </div>

      {簙壍?.warnings.length ? <div className="-mt-2 text-xs text-muted-3">{簙壍.warnings.join(" · ")}</div> : null}

      {領壍.error && !簙壍 ? (<ErrorState error={領壍.error} onRetry={() => void 領壍.refetch()}/>) : !簙壍 ? (<CampaignTableSkeleton columns={煌壍} density={崪壍}/>) : 簙壍.rows.length === 0 ? (<EmptyState>No campaigns in this account yet. Campaigns appear here once they have been created in Google Ads.</EmptyState>) : (<Refetching active={領壍.isFetching && 領壍.isPlaceholderData}>
          <CampaignTable rows={鬈壍} columns={煌壍} sort={{ key: 攇壍.sort, dir: 攇壍.dir }} onSort={(挊壍) => {
                const 臹壍 = nextSort({ key: 攇壍.sort, dir: 攇壍.dir }, 挊壍);
                void 菶壍({ sort: 臹壍.key, dir: 臹壍.dir });
            }} totals={柷壍} prevTotals={狄壍} accountCpa={簙壍.totals.cpa} money={赋壍} density={崪壍} selected={馐壍} onSelectedChange={晿壍} onOpen={(仨壍) => void 僥壍(仨壍)} onToggleStatus={(淗壍) => void 蕮壍.setStatus([淗壍.id], 淗壍.status === "Enabled" ? "Paused" : "Enabled")} pending={蕮壍.pending} empty={琼壍 ? (<span>
                  No campaigns match these filters.{" "}
                  <button type="button" onClick={錫壍} className="text-accent hover:opacity-85">
                    Clear filters
                  </button>
                </span>) : ("No campaigns.")}/>
        </Refetching>)}

      {庢壍.length ? (<CampaignBulkBar rows={庢壍} money={赋壍} busy={蕮壍.busy} onClear={() => 晿壍(new Set())} onStatus={(賆壍, 妵壍) => void 蕮壍.setStatus(賆壍, 妵壍)} onBudget={觖壍} onExport={() => 怚壍(庢壍)}/>) : null}
      {蕮壍.dialog}
    </div>);
}
