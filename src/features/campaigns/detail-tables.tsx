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
function metricColumns<T extends CampaignMetrics>(keys: MetricKey[], m: MoneyFmt, totals?: CampaignMetrics): Column<T>[] {
    return keys.map((k) => ({
        key: k,
        header: METRIC_META[k].label,
        width: "minmax(64px,1fr)",
        align: "right" as const,
        sortValue: (r: T) => r[k],
        cell: (r: T) => formatMetric(k, r[k], m),
        total: totals ? formatMetric(k, totals[k], m) : undefined,
    }));
}
function ShareBar({ share }: {
    share: number;
}) {
    const pct = Math.max(0, Math.min(1, share));
    return (<span className="block h-1 w-full max-w-[160px] rounded-pill bg-tone/5" title={`${(pct * 100).toFixed(0)}% of campaign spend`}>
      <span className="block h-full rounded-pill bg-accent" style={{ width: `${pct * 100}%` }}/>
    </span>);
}
export function AdGroupsTab({ detail: d }: {
    detail: CampaignDetail;
}) {
    const { money: m, filters } = useCampaignContext();
    const noun = d.campaign.type === "PMax" ? "asset group" : "ad group";
    const totals = useMemo(() => totalsOf(d.adGroups), [d.adGroups]);
    const columns = useMemo<Column<AdGroup>[]>(() => [
        {
            key: "name",
            header: noun === "asset group" ? "Asset group" : "Ad group",
            width: "minmax(200px,2.2fr)",
            sortValue: (r) => r.name,
            cell: (r) => (<span className="flex min-w-0 flex-col gap-1.5">
            <span className="truncate font-medium" title={r.name}>
              {r.name}
            </span>
            <ShareBar share={totals.cost > 0 ? r.cost / totals.cost : 0}/>
          </span>),
            total: `Total · ${d.adGroups.length} ${noun}${d.adGroups.length === 1 ? "" : "s"}`,
        },
        { key: "status", header: "Status", width: "92px", sortValue: (r) => r.status, cell: (r) => <StatusPill on={r.status === "Enabled"}>{r.status}</StatusPill> },
        ...metricColumns<AdGroup>(["cost", "impressions", "clicks", "ctr", "cpc", "conversions", "cpa", "roas"], m, totals),
    ], [d.adGroups.length, m, noun, totals]);
    if (!d.adGroups.length)
        return <EmptyState>{`No ${noun}s with data in this range.`}</EmptyState>;
    return (<Card className="flex flex-col gap-4">
      <CardHeader title={noun === "asset group" ? "Asset groups" : "Ad groups"} sub={`${d.adGroups.length} ${noun}${d.adGroups.length === 1 ? "" : "s"} · ${rangeShortLabel(filters.rangeKey, filters.range)}`}/>
      <DataTable rows={d.adGroups} columns={columns} rowKey={(r) => r.id} ariaLabel={noun === "asset group" ? "Asset groups" : "Ad groups"} initialSort={{ key: "cost", dir: "desc" }} minWidth={900}/>
    </Card>);
}
const KEYWORDLESS: Record<string, string> = {
    PMax: "Performance Max campaigns don’t use keywords — Google matches search themes, audience signals and assets instead. The queries it matched are under Search terms.",
    Shopping: "Shopping campaigns match products from your feed to searches, so there are no keywords. The queries they matched are under Search terms.",
    Display: "Display campaigns target audiences, topics and placements rather than keywords.",
    Video: "Video campaigns target audiences and placements rather than keywords.",
    "Demand Gen": "Demand Gen campaigns target audiences rather than keywords.",
    App: "App campaigns are automated across Google’s networks; keywords aren’t exposed.",
};
const QS_GLYPH: Record<string, string> = { Above: "▲", Average: "●", Below: "▼" };
const QS_TONE = { Above: "accent", Average: "muted", Below: "warn" } as const;
function QsPill({ short, label, value }: {
    short: string;
    label: string;
    value: string | null;
}) {
    if (!value)
        return null;
    const tone = QS_TONE[value as keyof typeof QS_TONE] ?? "faint";
    return (<span title={`${label}: ${value === "Average" ? "average" : `${value.toLowerCase()} average`}`}>
      <Pill tone={tone} className="gap-1 px-1.5 py-px text-[9px] tracking-[0.08em]">
        {short}
        <span aria-hidden>{QS_GLYPH[value] ?? ""}</span>
        <span className="sr-only">{` ${label} ${value}`}</span>
      </Pill>
    </span>);
}
function QsCell({ k }: {
    k: Keyword;
}) {
    if (k.qs === null)
        return <span className="text-faint">—</span>;
    return (<span className="flex flex-col gap-1">
      <span className="flex items-baseline gap-0.5">
        <span className="font-display text-[15px] font-semibold">{k.qs}</span>
        <span className="font-mono text-micro text-faint">/10</span>
      </span>
      <span className="flex flex-wrap gap-1">
        <QsPill short="CTR" label="Expected CTR" value={k.qsCtr}/>
        <QsPill short="AD" label="Ad relevance" value={k.qsRelevance}/>
        <QsPill short="LP" label="Landing page experience" value={k.qsLanding}/>
      </span>
    </span>);
}
const MATCHES = ["All", "Exact", "Phrase", "Broad"] as const;
export function KeywordsTab({ detail: d }: {
    detail: CampaignDetail;
}) {
    const { money: m, filters } = useCampaignContext();
    const [q, setQ] = useState("");
    const [match, setMatch] = useState<(typeof MATCHES)[number]>("All");
    const rows = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return d.keywords.filter((k) => (match === "All" || k.matchType === match) && (!needle || k.text.toLowerCase().includes(needle) || k.adGroupName.toLowerCase().includes(needle)));
    }, [d.keywords, q, match]);
    const totals = useMemo(() => totalsOf(rows), [rows]);
    const avgQs = useMemo(() => {
        const scored = d.keywords.filter((k) => k.qs !== null && k.impressions > 0);
        const w = scored.reduce((s, k) => s + k.impressions, 0);
        return w > 0 ? scored.reduce((s, k) => s + (k.qs ?? 0) * k.impressions, 0) / w : null;
    }, [d.keywords]);
    const columns = useMemo<Column<Keyword>[]>(() => [
        {
            key: "text",
            header: "Keyword",
            width: "minmax(200px,2.2fr)",
            sortValue: (r) => r.text,
            cell: (r) => (<span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium" title={keywordNotation(r.text, r.matchType)}>
              {keywordNotation(r.text, r.matchType)}
            </span>
            <span className="truncate font-mono text-micro tracking-[0.08em] text-faint uppercase">{r.adGroupName}</span>
          </span>),
            total: `Total · ${rows.length} keyword${rows.length === 1 ? "" : "s"}`,
        },
        { key: "match", header: "Match", width: "70px", sortValue: (r) => r.matchType, cell: (r) => <span className="text-muted">{r.matchType}</span> },
        { key: "status", header: "Status", width: "84px", sortValue: (r) => r.status, cell: (r) => <StatusPill on={r.status === "Enabled"}>{r.status}</StatusPill> },
        { key: "qs", header: "Quality", width: "124px", sortValue: (r) => r.qs, cell: (r) => <QsCell k={r}/> },
        { key: "bid", header: "Max CPC", width: "minmax(64px,1fr)", align: "right", sortValue: (r) => r.cpcBid, cell: (r) => money(r.cpcBid, m, 2) },
        ...metricColumns<Keyword>(["cost", "impressions", "clicks", "ctr", "cpc", "conversions", "cpa"], m, totals),
    ], [m, rows.length, totals]);
    if (!d.keywords.length)
        return <EmptyState>{KEYWORDLESS[d.campaign.type] ?? "No keywords with data in this range."}</EmptyState>;
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Keywords" sub={`${d.keywords.length} keywords · ${rangeShortLabel(filters.rangeKey, filters.range)}${avgQs !== null ? ` · avg. quality score ${avgQs.toFixed(1)} (impression-weighted)` : ""}`}/>
      <div className="flex flex-wrap items-center gap-2.5">
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter keywords or ad groups" aria-label="Filter keywords" className="min-w-[200px] flex-1 py-2 text-[13px] sm:max-w-[300px]"/>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Match type">
          {MATCHES.map((x) => (<Chip key={x} active={match === x} onClick={() => setMatch(x)}>
              {x}
            </Chip>))}
        </div>
        <span className="flex-1"/>
        <span className="font-mono text-micro tracking-label text-faint uppercase">[exact] · &quot;phrase&quot; · broad</span>
      </div>
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} ariaLabel="Keywords" initialSort={{ key: "cost", dir: "desc" }} minWidth={1080} empty="No keywords match this filter."/>
    </Card>);
}
const NO_TERMS: Record<string, string> = {
    Display: "Display campaigns don’t serve on searches, so there are no search terms.",
    Video: "Video campaigns don’t report search terms here.",
    "Demand Gen": "Demand Gen campaigns don’t serve on searches, so there are no search terms.",
    App: "App campaigns don’t expose search terms.",
};
const TERM_STATUS: Record<SearchTerm["status"], {
    label: string;
    tone: "accent" | "muted" | "faint";
}> = {
    added: { label: "Added", tone: "accent" },
    excluded: { label: "Excluded", tone: "muted" },
    added_excluded: { label: "Added · excluded", tone: "muted" },
    none: { label: "—", tone: "faint" },
};
type StatusFilterKey = "all" | "none" | "added" | "excluded";
const STATUS_FILTERS: {
    key: StatusFilterKey;
    label: string;
}[] = [
    { key: "all", label: "All" },
    { key: "none", label: "Not added" },
    { key: "added", label: "Added" },
    { key: "excluded", label: "Excluded" },
];
const NEG_MATCH = ["Exact", "Phrase", "Broad"] as const;
type NegMatch = (typeof NEG_MATCH)[number];
const isExcluded = (t: SearchTerm) => t.status === "excluded" || t.status === "added_excluded";
const termKey = (t: SearchTerm) => `${t.term}\u0000${t.matchType}\u0000${t.status}`;
export function SearchTermsTab({ detail: d }: {
    detail: CampaignDetail;
}) {
    const { money: m, filters } = useCampaignContext();
    const writes = useCampaignWrites();
    const [q, setQ] = useState("");
    const [status, setStatus] = useState<StatusFilterKey>("all");
    const [noConv, setNoConv] = useState(false);
    const [negMatch, setNegMatch] = useState<NegMatch>("Exact");
    const [selected, setSelected] = useState<Set<string>>(() => new Set());
    const rows = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return d.searchTerms.filter((t) => (!needle || t.term.toLowerCase().includes(needle)) &&
            (status === "all" || (status === "none" ? t.status === "none" : status === "added" ? t.status === "added" || t.status === "added_excluded" : isExcluded(t))) &&
            (!noConv || (t.conversions <= 0 && t.cost > 0)));
    }, [d.searchTerms, q, status, noConv]);
    const totals = useMemo(() => totalsOf(rows), [rows]);
    const wasted = useMemo(() => d.searchTerms.filter((t) => t.conversions <= 0 && t.cost > 0 && !isExcluded(t)), [d.searchTerms]);
    const chosen = rows.filter((t) => selected.has(termKey(t)) && !isExcluded(t));
    const addNegatives = async (terms: SearchTerm[]) => {
        const texts = [...new Set(terms.map((t) => t.term.trim().slice(0, 80)).filter(Boolean))];
        const res = await writes.addNegatives(texts.map((text) => ({ text, matchType: negMatch, campaignId: d.campaign.id })));
        if (res)
            setSelected(new Set());
    };
    const columns: Column<SearchTerm>[] = [
        {
            key: "term",
            header: "Search term",
            width: "minmax(220px,2.4fr)",
            sortValue: (r) => r.term,
            cell: (r) => (<span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium" title={r.term}>
            {r.term}
          </span>
          <span className="font-mono text-micro tracking-[0.08em] text-faint uppercase">{r.matchType === "Unknown" ? "Match type n/a" : `${r.matchType} match`}</span>
        </span>),
            total: `Total · ${rows.length} term${rows.length === 1 ? "" : "s"}`,
        },
        {
            key: "status",
            header: "Status",
            width: "118px",
            sortValue: (r) => r.status,
            cell: (r) => (r.status === "none" ? <span className="text-faint">—</span> : <Pill tone={TERM_STATUS[r.status].tone}>{TERM_STATUS[r.status].label}</Pill>),
        },
        ...metricColumns<SearchTerm>(["cost", "impressions", "clicks", "ctr", "conversions", "cpa", "cvr"], m, totals),
        {
            key: "action",
            header: <span className="sr-only">Actions</span>,
            width: "112px",
            align: "right",
            cell: (r) => isExcluded(r) ? (<span className="font-mono text-micro tracking-label text-faint uppercase">Negative</span>) : (<LiveGuard>
            <Button size="xs" variant="ghost" disabled={!!writes.busy} onClick={() => void addNegatives([r])} title={`Add “${r.term}” as a ${negMatch.toLowerCase()} match negative keyword`}>
              − Negative
            </Button>
          </LiveGuard>),
        },
    ];
    if (!d.searchTerms.length)
        return <EmptyState>{NO_TERMS[d.campaign.type] ?? "No search terms with data in this range."}</EmptyState>;
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Search terms" sub={`Top ${d.searchTerms.length} by spend · ${rangeShortLabel(filters.rangeKey, filters.range)}${wasted.length ? ` · ${wasted.length} without conversions (${money(wasted.reduce((s, t) => s + t.cost, 0), m)})` : ""}`}/>
      <div className="flex flex-wrap items-center gap-2.5">
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter search terms" aria-label="Filter search terms" className="min-w-[200px] flex-1 py-2 text-[13px] sm:max-w-[280px]"/>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
          {STATUS_FILTERS.map((s) => (<Chip key={s.key} active={status === s.key} onClick={() => setStatus(s.key)}>
              {s.label}
            </Chip>))}
          <Chip active={noConv} onClick={() => setNoConv(!noConv)} title="Terms that spent without converting">
            No conversions
          </Chip>
        </div>
        <span className="flex-1"/>
        <span className="flex items-center gap-2">
          <span className="font-mono text-micro tracking-label text-faint uppercase">Negative match</span>
          <Segmented ariaLabel="Negative keyword match type" options={NEG_MATCH.map((x) => ({ value: x, label: x }))} value={negMatch} onChange={setNegMatch}/>
        </span>
      </div>
      {chosen.length ? (<div className="flex flex-wrap items-center gap-2.5 rounded-mini border border-teal/30 bg-teal/6 px-3.5 py-2.5 animate-fade-up-fast" role="region" aria-label="Selected search terms">
          <span className="text-[13px] font-semibold">{`${chosen.length} selected`}</span>
          <button type="button" className="text-xs text-muted-3 hover:text-fg" onClick={() => setSelected(new Set())}>
            Clear
          </button>
          <LiveGuard>
            <Button size="xs" variant="accent" disabled={!!writes.busy} loading={writes.busy === "negatives"} onClick={() => void addNegatives(chosen)}>
              {`Add ${chosen.length} as ${negMatch.toLowerCase()} negative${chosen.length === 1 ? "" : "s"}`}
            </Button>
          </LiveGuard>
          <span className="text-xs text-muted-3">{READ_ONLY_COPY}</span>
          <span className="text-xs text-muted-3">Campaign-level negatives</span>
        </div>) : null}
      <DataTable rows={rows} columns={columns} rowKey={termKey} ariaLabel="Search terms" selectable selected={selected} onSelectedChange={setSelected} initialSort={{ key: "cost", dir: "desc" }} minWidth={1060} empty="No search terms match these filters." rowClassName={(r) => (isExcluded(r) ? "opacity-60" : undefined)}/>
      {writes.dialog}
    </Card>);
}
