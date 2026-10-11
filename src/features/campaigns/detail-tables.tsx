"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip, Segmented } from "@/components/ui/controls";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/feedback";
import { Input } from "@/components/ui/inputs";
import { LiveGuard, READ_ONLY_COPY } from "@/components/ui/live-guard";
import { Pill, StatusPill } from "@/components/ui/status";
import { Card, CardHeader } from "@/components/ui/surfaces";
import type { CampaignDetail, CampaignMetrics } from "@/lib/domain/contracts/actions";
import { formatMetric, keywordNotation, METRIC_META, money, rangeShortLabel, totalsOf, type MetricKey, type MoneyFmt } from "./campaign-utils";
import { useCampaignContext } from "./use-campaign-context";
import { useCampaignWrites } from "./use-campaign-writes";
type AdGroup = CampaignDetail["adGroups"][number];
type Keyword = CampaignDetail["keywords"][number];
type SearchTerm = CampaignDetail["searchTerms"][number];
function 菈壍<T extends CampaignMetrics>(傷壍: MetricKey[], 澦壍: MoneyFmt, 躕壍?: CampaignMetrics): Column<T>[] {
    return 傷壍.map((宄壍) => ({
        key: 宄壍,
        header: METRIC_META[宄壍].label,
        width: "minmax(64px,1fr)",
        align: "right" as const,
        sortValue: (穳壍: T) => 穳壍[宄壍],
        cell: (饢壍: T) => formatMetric(宄壍, 饢壍[宄壍], 澦壍),
        total: 躕壍 ? formatMetric(宄壍, 躕壍[宄壍], 澦壍) : undefined,
    }));
}
function 晑壍({ share: 蕀壍 }: {
    share: number;
}) {
    const 刯壍 = Math.max(0, Math.min(1, 蕀壍));
    return (<span className="block h-1 w-full max-w-[160px] rounded-pill bg-tone/5" title={`${(刯壍 * 100).toFixed(0)}% of campaign spend`}>
      <span className="block h-full rounded-pill bg-accent" style={{ width: `${刯壍 * 100}%` }}/>
    </span>);
}
export function AdGroupsTab({ detail: 焞壍 }: {
    detail: CampaignDetail;
}) {
    const { money: 逍壍, filters: 峼壍 } = useCampaignContext();
    const 篫壍 = 焞壍.campaign.type === "PMax" ? "asset group" : "ad group";
    const 髚壍 = useMemo(() => totalsOf(焞壍.adGroups), [焞壍.adGroups]);
    const 柉壍 = useMemo<Column<AdGroup>[]>(() => [
        {
            key: "name",
            header: 篫壍 === "asset group" ? "Asset group" : "Ad group",
            width: "minmax(200px,2.2fr)",
            sortValue: (蚸壍) => 蚸壍.name,
            cell: (厧壍) => (<span className="flex min-w-0 flex-col gap-1.5">
            <span className="truncate font-medium" title={厧壍.name}>
              {厧壍.name}
            </span>
            <晑壍 share={髚壍.cost > 0 ? 厧壍.cost / 髚壍.cost : 0}/>
          </span>),
            total: `Total · ${焞壍.adGroups.length} ${篫壍}${焞壍.adGroups.length === 1 ? "" : "s"}`,
        },
        { key: "status", header: "Status", width: "92px", sortValue: (犖壍) => 犖壍.status, cell: (醅壍) => <StatusPill on={醅壍.status === "Enabled"}>{醅壍.status}</StatusPill> },
        ...菈壍<AdGroup>(["cost", "impressions", "clicks", "ctr", "cpc", "conversions", "cpa", "roas"], 逍壍, 髚壍),
    ], [焞壍.adGroups.length, 逍壍, 篫壍, 髚壍]);
    if (!焞壍.adGroups.length)
        return <EmptyState>{`No ${篫壍}s with data in this range.`}</EmptyState>;
    return (<Card className="flex flex-col gap-4">
      <CardHeader title={篫壍 === "asset group" ? "Asset groups" : "Ad groups"} sub={`${焞壍.adGroups.length} ${篫壍}${焞壍.adGroups.length === 1 ? "" : "s"} · ${rangeShortLabel(峼壍.rangeKey, 峼壍.range)}`}/>
      <DataTable rows={焞壍.adGroups} columns={柉壍} rowKey={(年壍) => 年壍.id} ariaLabel={篫壍 === "asset group" ? "Asset groups" : "Ad groups"} initialSort={{ key: "cost", dir: "desc" }} minWidth={900}/>
    </Card>);
}
const 絣壍: Record<string, string> = {
    PMax: "Performance Max campaigns don’t use keywords — Google matches search themes, audience signals and assets instead. The queries it matched are under Search terms.",
    Shopping: "Shopping campaigns match products from your feed to searches, so there are no keywords. The queries they matched are under Search terms.",
    Display: "Display campaigns target audiences, topics and placements rather than keywords.",
    Video: "Video campaigns target audiences and placements rather than keywords.",
    "Demand Gen": "Demand Gen campaigns target audiences rather than keywords.",
    App: "App campaigns are automated across Google’s networks; keywords aren’t exposed.",
};
const 鱒壍: Record<string, string> = { Above: "▲", Average: "●", Below: "▼" };
const 楁壍 = { Above: "accent", Average: "muted", Below: "warn" } as const;
function 蠰壍({ short: 唟壍, label: 琎壍, value: 鋽壍 }: {
    short: string;
    label: string;
    value: string | null;
}) {
    if (!鋽壍)
        return null;
    const 忬壍 = 楁壍[鋽壍 as keyof typeof 楁壍] ?? "faint";
    return (<span title={`${琎壍}: ${鋽壍 === "Average" ? "average" : `${鋽壍.toLowerCase()} average`}`}>
      <Pill tone={忬壍} className="gap-1 px-1.5 py-px text-[9px] tracking-[0.08em]">
        {唟壍}
        <span aria-hidden>{鱒壍[鋽壍] ?? ""}</span>
        <span className="sr-only">{` ${琎壍} ${鋽壍}`}</span>
      </Pill>
    </span>);
}
function 绛壍({ k: 鷊壍 }: {
    k: Keyword;
}) {
    if (鷊壍.qs === null)
        return <span className="text-faint">—</span>;
    return (<span className="flex flex-col gap-1">
      <span className="flex items-baseline gap-0.5">
        <span className="font-display text-[15px] font-semibold">{鷊壍.qs}</span>
        <span className="font-mono text-micro text-faint">/10</span>
      </span>
      <span className="flex flex-wrap gap-1">
        <蠰壍 short="CTR" label="Expected CTR" value={鷊壍.qsCtr}/>
        <蠰壍 short="AD" label="Ad relevance" value={鷊壍.qsRelevance}/>
        <蠰壍 short="LP" label="Landing page experience" value={鷊壍.qsLanding}/>
      </span>
    </span>);
}
const 檹壍 = ["All", "Exact", "Phrase", "Broad"] as const;
export function KeywordsTab({ detail: 覨壍 }: {
    detail: CampaignDetail;
}) {
    const { money: 嚗壍, filters: 疆壍 } = useCampaignContext();
    const [鑵壍, 慤壍] = useState("");
    const [聓壍, 齂壍] = useState<(typeof 檹壍)[number]>("All");
    const 氱壍 = useMemo(() => {
        const 謠壍 = 鑵壍.trim().toLowerCase();
        return 覨壍.keywords.filter((堏壍) => (聓壍 === "All" || 堏壍.matchType === 聓壍) && (!謠壍 || 堏壍.text.toLowerCase().includes(謠壍) || 堏壍.adGroupName.toLowerCase().includes(謠壍)));
    }, [覨壍.keywords, 鑵壍, 聓壍]);
    const 盾壍 = useMemo(() => totalsOf(氱壍), [氱壍]);
    const 闭壍 = useMemo(() => {
        const 拜壍 = 覨壍.keywords.filter((臋壍) => 臋壍.qs !== null && 臋壍.impressions > 0);
        const 人壍 = 拜壍.reduce((涩壍, 貘壍) => 涩壍 + 貘壍.impressions, 0);
        return 人壍 > 0 ? 拜壍.reduce((妇壍, 硶壍) => 妇壍 + (硶壍.qs ?? 0) * 硶壍.impressions, 0) / 人壍 : null;
    }, [覨壍.keywords]);
    const 靥壍 = useMemo<Column<Keyword>[]>(() => [
        {
            key: "text",
            header: "Keyword",
            width: "minmax(200px,2.2fr)",
            sortValue: (摔壍) => 摔壍.text,
            cell: (荃壍) => (<span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium" title={keywordNotation(荃壍.text, 荃壍.matchType)}>
              {keywordNotation(荃壍.text, 荃壍.matchType)}
            </span>
            <span className="truncate font-mono text-micro tracking-[0.08em] text-faint uppercase">{荃壍.adGroupName}</span>
          </span>),
            total: `Total · ${氱壍.length} keyword${氱壍.length === 1 ? "" : "s"}`,
        },
        { key: "match", header: "Match", width: "70px", sortValue: (倲壍) => 倲壍.matchType, cell: (漡壍) => <span className="text-muted">{漡壍.matchType}</span> },
        { key: "status", header: "Status", width: "84px", sortValue: (踐壍) => 踐壍.status, cell: (嫿壍) => <StatusPill on={嫿壍.status === "Enabled"}>{嫿壍.status}</StatusPill> },
        { key: "qs", header: "Quality", width: "124px", sortValue: (秮壍) => 秮壍.qs, cell: (飝壍) => <绛壍 k={飝壍}/> },
        { key: "bid", header: "Max CPC", width: "minmax(64px,1fr)", align: "right", sortValue: (旌壍) => 旌壍.cpcBid, cell: (蒻壍) => money(蒻壍.cpcBid, 嚗壍, 2) },
        ...菈壍<Keyword>(["cost", "impressions", "clicks", "ctr", "cpc", "conversions", "cpa"], 嚗壍, 盾壍),
    ], [嚗壍, 氱壍.length, 盾壍]);
    if (!覨壍.keywords.length)
        return <EmptyState>{絣壍[覨壍.campaign.type] ?? "No keywords with data in this range."}</EmptyState>;
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Keywords" sub={`${覨壍.keywords.length} keywords · ${rangeShortLabel(疆壍.rangeKey, 疆壍.range)}${闭壍 !== null ? ` · avg. quality score ${闭壍.toFixed(1)} (impression-weighted)` : ""}`}/>
      <div className="flex flex-wrap items-center gap-2.5">
        <Input type="search" value={鑵壍} onChange={(冪壍) => 慤壍(冪壍.target.value)} placeholder="Filter keywords or ad groups" aria-label="Filter keywords" className="min-w-[200px] flex-1 py-2 text-[13px] sm:max-w-[300px]"/>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Match type">
          {檹壍.map((炙壍) => (<Chip key={炙壍} active={聓壍 === 炙壍} onClick={() => 齂壍(炙壍)}>
              {炙壍}
            </Chip>))}
        </div>
        <span className="flex-1"/>
        <span className="font-mono text-micro tracking-label text-faint uppercase">[exact] · &quot;phrase&quot; · broad</span>
      </div>
      <DataTable rows={氱壍} columns={靥壍} rowKey={(辈壍) => 辈壍.id} ariaLabel="Keywords" initialSort={{ key: "cost", dir: "desc" }} minWidth={1080} empty="No keywords match this filter."/>
    </Card>);
}
const 屷壍: Record<string, string> = {
    Display: "Display campaigns don’t serve on searches, so there are no search terms.",
    Video: "Video campaigns don’t report search terms here.",
    "Demand Gen": "Demand Gen campaigns don’t serve on searches, so there are no search terms.",
    App: "App campaigns don’t expose search terms.",
};
const 筦壍: Record<SearchTerm["status"], {
    label: string;
    tone: "accent" | "muted" | "faint";
}> = {
    added: { label: "Added", tone: "accent" },
    excluded: { label: "Excluded", tone: "muted" },
    added_excluded: { label: "Added · excluded", tone: "muted" },
    none: { label: "—", tone: "faint" },
};
type StatusFilterKey = "all" | "none" | "added" | "excluded";
const 驕壍: {
    key: StatusFilterKey;
    label: string;
}[] = [
    { key: "all", label: "All" },
    { key: "none", label: "Not added" },
    { key: "added", label: "Added" },
    { key: "excluded", label: "Excluded" },
];
const 杄壍 = ["Exact", "Phrase", "Broad"] as const;
type NegMatch = (typeof 杄壍)[number];
const 蘳壍 = (匢壍: SearchTerm) => 匢壍.status === "excluded" || 匢壍.status === "added_excluded";
const 爑壍 = (鄀壍: SearchTerm) => `${鄀壍.term}\u0000${鄀壍.matchType}\u0000${鄀壍.status}`;
export function SearchTermsTab({ detail: 巯壍 }: {
    detail: CampaignDetail;
}) {
    const { money: 糞壍, filters: 鯍壍 } = useCampaignContext();
    const 梼壍 = useCampaignWrites();
    const [螫壍, 咚壍] = useState("");
    const [玉壍, 鉸壍] = useState<StatusFilterKey>("all");
    const [彧壍, 繖壍] = useState(false);
    const [鵅壍, 樴壍] = useState<NegMatch>("Exact");
    const [褣壍, 嘒壍] = useState<Set<string>>(() => new Set());
    const 甁壍 = useMemo(() => {
        const 鏰壍 = 螫壍.trim().toLowerCase();
        return 巯壍.searchTerms.filter((惟壍) => (!鏰壍 || 惟壍.term.toLowerCase().includes(鏰壍)) &&
            (玉壍 === "all" || (玉壍 === "none" ? 惟壍.status === "none" : 玉壍 === "added" ? 惟壍.status === "added" || 惟壍.status === "added_excluded" : 蘳壍(惟壍))) &&
            (!彧壍 || (惟壍.conversions <= 0 && 惟壍.cost > 0)));
    }, [巯壍.searchTerms, 螫壍, 玉壍, 彧壍]);
    const 翎壍 = useMemo(() => totalsOf(甁壍), [甁壍]);
    const 麽壍 = useMemo(() => 巯壍.searchTerms.filter((殬壍) => 殬壍.conversions <= 0 && 殬壍.cost > 0 && !蘳壍(殬壍)), [巯壍.searchTerms]);
    const 誛壍 = 甁壍.filter((垊壍) => 褣壍.has(爑壍(垊壍)) && !蘳壍(垊壍));
    const 癹壍 = async (镨壍: SearchTerm[]) => {
        const 扗壍 = [...new Set(镨壍.map((腆壍) => 腆壍.term.trim().slice(0, 80)).filter(Boolean))];
        const 丵壍 = await 梼壍.addNegatives(扗壍.map((洤壍) => ({ text: 洤壍, matchType: 鵅壍, campaignId: 巯壍.campaign.id })));
        if (丵壍)
            嘒壍(new Set());
    };
    const 谓壍: Column<SearchTerm>[] = [
        {
            key: "term",
            header: "Search term",
            width: "minmax(220px,2.4fr)",
            sortValue: (夂壍) => 夂壍.term,
            cell: (矱壍) => (<span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium" title={矱壍.term}>
            {矱壍.term}
          </span>
          <span className="font-mono text-micro tracking-[0.08em] text-faint uppercase">{矱壍.matchType === "Unknown" ? "Match type n/a" : `${矱壍.matchType} match`}</span>
        </span>),
            total: `Total · ${甁壍.length} term${甁壍.length === 1 ? "" : "s"}`,
        },
        {
            key: "status",
            header: "Status",
            width: "118px",
            sortValue: (雠壍) => 雠壍.status,
            cell: (描壍) => (描壍.status === "none" ? <span className="text-faint">—</span> : <Pill tone={筦壍[描壍.status].tone}>{筦壍[描壍.status].label}</Pill>),
        },
        ...菈壍<SearchTerm>(["cost", "impressions", "clicks", "ctr", "conversions", "cpa", "cvr"], 糞壍, 翎壍),
        {
            key: "action",
            header: <span className="sr-only">Actions</span>,
            width: "112px",
            align: "right",
            cell: (芾壍) => 蘳壍(芾壍) ? (<span className="font-mono text-micro tracking-label text-faint uppercase">Negative</span>) : (<LiveGuard>
            <Button size="xs" variant="ghost" disabled={!!梼壍.busy} onClick={() => void 癹壍([芾壍])} title={`Add “${芾壍.term}” as a ${鵅壍.toLowerCase()} match negative keyword`}>
              − Negative
            </Button>
          </LiveGuard>),
        },
    ];
    if (!巯壍.searchTerms.length)
        return <EmptyState>{屷壍[巯壍.campaign.type] ?? "No search terms with data in this range."}</EmptyState>;
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Search terms" sub={`Top ${巯壍.searchTerms.length} by spend · ${rangeShortLabel(鯍壍.rangeKey, 鯍壍.range)}${麽壍.length ? ` · ${麽壍.length} without conversions (${money(麽壍.reduce((侭壍, 溜壍) => 侭壍 + 溜壍.cost, 0), 糞壍)})` : ""}`}/>
      <div className="flex flex-wrap items-center gap-2.5">
        <Input type="search" value={螫壍} onChange={(趋壍) => 咚壍(趋壍.target.value)} placeholder="Filter search terms" aria-label="Filter search terms" className="min-w-[200px] flex-1 py-2 text-[13px] sm:max-w-[280px]"/>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
          {驕壍.map((婺壍) => (<Chip key={婺壍.key} active={玉壍 === 婺壍.key} onClick={() => 鉸壍(婺壍.key)}>
              {婺壍.label}
            </Chip>))}
          <Chip active={彧壍} onClick={() => 繖壍(!彧壍)} title="Terms that spent without converting">
            No conversions
          </Chip>
        </div>
        <span className="flex-1"/>
        <span className="flex items-center gap-2">
          <span className="font-mono text-micro tracking-label text-faint uppercase">Negative match</span>
          <Segmented ariaLabel="Negative keyword match type" options={杄壍.map((祩壍) => ({ value: 祩壍, label: 祩壍 }))} value={鵅壍} onChange={樴壍}/>
        </span>
      </div>
      {誛壍.length ? (<div className="flex flex-wrap items-center gap-2.5 rounded-mini border border-teal/30 bg-teal/6 px-3.5 py-2.5 animate-fade-up-fast" role="region" aria-label="Selected search terms">
          <span className="text-[13px] font-semibold">{`${誛壍.length} selected`}</span>
          <button type="button" className="text-xs text-muted-3 hover:text-fg" onClick={() => 嘒壍(new Set())}>
            Clear
          </button>
          <LiveGuard>
            <Button size="xs" variant="accent" disabled={!!梼壍.busy} loading={梼壍.busy === "negatives"} onClick={() => void 癹壍(誛壍)}>
              {`Add ${誛壍.length} as ${鵅壍.toLowerCase()} negative${誛壍.length === 1 ? "" : "s"}`}
            </Button>
          </LiveGuard>
          <span className="text-xs text-muted-3">{READ_ONLY_COPY}</span>
          <span className="text-xs text-muted-3">Campaign-level negatives</span>
        </div>) : null}
      <DataTable rows={甁壍} columns={谓壍} rowKey={爑壍} ariaLabel="Search terms" selectable selected={褣壍} onSelectedChange={嘒壍} initialSort={{ key: "cost", dir: "desc" }} minWidth={1060} empty="No search terms match these filters." rowClassName={(願壍) => (蘳壍(願壍) ? "opacity-60" : undefined)}/>
      {梼壍.dialog}
    </Card>);
}
