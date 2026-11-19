"use client";

import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { Chip, Segmented } from "@/components/ui/controls";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState, Refetching, Skeleton } from "@/components/ui/feedback";
import { Select } from "@/components/ui/inputs";
import { LiveGuard, useWriteAction } from "@/components/ui/live-guard";
import { Pill } from "@/components/ui/status";
import { Card, CardHeader, StatTile, TileGrid } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useIsLive } from "@/lib/api/actions";
import { useNegatives } from "@/lib/api/ai";
import { useSettings, useStatus } from "@/lib/api/hooks";
import type { NegativeCandidate, NegativeRuleId } from "@/lib/domain/contracts/ai";
import { formatNumber } from "@/lib/domain/metrics/registry";
import { RANGE_LABELS, useFilters } from "@/lib/filters";
import { displayMoney, moneyFromStatus } from "@/lib/money";
import { shortCampaignName } from "./ideas-model";
import {
  brandHit,
  buildNegativesPayload,
  candidateKey,
  countCandidates,
  filterCandidates,
  LEVEL_LABELS,
  NEGATIVE_MATCH_TYPES,
  negativeTextOf,
  notation,
  REASON_LABELS,
  REASON_ORDER,
  rulesOf,
  selectedSavings,
  VERDICT_META,
  VERDICTS,
  verdictOf,
  type MatchType,
  type Verdict,
} from "./negatives-model";
import { AiSourceLine, useCampaignIndex } from "./shared";

// 05 · AI studio — Negative keywords. Rules flag wasteful search terms and n-grams (spend without conversions,
// irrelevant modifiers, competitor terms, low CTR); the AI (or rule-based demo verdicts) classifies each candidate.
// Selected negatives go through the write guard: simulated in demo, read-only alternatives (Editor CSV) when live.

const REASON_VALUES = ["all", ...REASON_ORDER] as const;
const VERDICT_VALUES = ["all", ...VERDICTS] as const;

export function NegativesScreen() {
  const status = useStatus();
  const today = status.data?.today;
  const live = useIsLive();
  const filters = useFilters(today);
  const settings = useSettings();
  const brandTerms = useMemo(() => settings.data?.brandTerms ?? [], [settings.data?.brandTerms]);
  const campaigns = useCampaignIndex();
  const [reason, setReason] = useQueryState("reason", parseAsStringEnum([...REASON_VALUES]).withDefault("all").withOptions({ history: "replace", scroll: false }));
  const [verdict, setVerdict] = useQueryState("verdict", parseAsStringEnum([...VERDICT_VALUES]).withDefault("all").withOptions({ history: "replace", scroll: false }));
  const [cid, setCid] = useQueryState("cid", parseAsString.withOptions({ history: "replace", scroll: false }));
  const [, setCampaign] = useQueryState("campaign", parseAsString.withOptions({ history: "push", scroll: false }));
  const custom = filters.rangeKey === "custom";
  const q = useNegatives({ range: custom ? undefined : filters.rangeKey, campaignId: cid ?? undefined });
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [match, setMatch] = useState<Record<string, MatchType>>({});
  const write = useWriteAction();
  const display = useMemo(() => moneyFromStatus(status.data), [status.data]);
  const money = (v: number) => displayMoney(v, display);

  const all = useMemo(() => q.data?.candidates ?? [], [q.data]);
  const rows = useMemo(() => filterCandidates(all, { reason: reason as NegativeRuleId | "all", verdict: verdict as Verdict | "all" }), [all, reason, verdict]);
  const counts = useMemo(() => countCandidates(all), [all]);
  const chosen = all.filter((c) => selected.has(candidateKey(c)));
  const hidden = chosen.filter((c) => !rows.includes(c)).length;
  const savings = selectedSavings(all, selected);
  const recommended = all.filter((c) => verdictOf(c) === "negative" && !brandHit(negativeTextOf(c), brandTerms));
  const rangeLabel = RANGE_LABELS[custom ? "30d" : filters.rangeKey];

  const add = async () => {
    const payload = buildNegativesPayload(chosen, { match, campaignIds: campaigns.list.map((c) => c.id), brandTerms });
    if (payload.skippedBrand.length) toast(`Skipped ${payload.skippedBrand.length} negative${payload.skippedBrand.length === 1 ? "" : "s"} containing a brand term`, { tone: "warn" });
    if (payload.truncated) toast(`Only the first ${payload.negatives.length} lines fit in one action — add the rest next.`, { tone: "warn" });
    if (!payload.negatives.length) return;
    const n = payload.negatives.length;
    const campaignsHit = new Set(payload.negatives.map((x) => x.campaignId)).size;
    const action = await write.run({ type: "keywords.add_negatives", negatives: payload.negatives }, { success: `Added ${n} negative keyword${n === 1 ? "" : "s"} to ${campaignsHit} campaign${campaignsHit === 1 ? "" : "s"} · simulated` });
    if (action) setSelected(new Set());
  };

  const columns: Column<NegativeCandidate>[] = [
    {
      key: "term",
      header: "Search term",
      width: "minmax(210px,2.2fr)",
      sortValue: (c) => c.term,
      cell: (c) => {
        const m = match[candidateKey(c)] ?? c.suggestedMatch;
        const text = negativeTextOf(c);
        const brand = brandHit(text, brandTerms);
        return (
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-medium text-fg" title={c.term}>
              {c.term}
            </span>
            <span className="truncate font-mono text-micro text-faint" title="The negative keyword that will be added">
              {c.kind === "ngram" ? "n-gram · " : ""}
              {`adds −${notation(text, m)}`}
              {brand ? <span className="text-crit">{` · contains brand “${brand}”`}</span> : null}
            </span>
          </span>
        );
      },
    },
    {
      key: "campaign",
      header: "Campaign / level",
      width: "minmax(150px,1.4fr)",
      sortValue: (c) => c.campaignName,
      cell: (c) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          {c.campaignId ? (
            <button type="button" onClick={() => void setCampaign(c.campaignId)} className="truncate text-left text-fg hover:text-accent" title={c.campaignName}>
              {shortCampaignName(c.campaignName)}
            </button>
          ) : (
            <span className="truncate text-muted">{c.campaignName || "All campaigns"}</span>
          )}
          <span className="truncate font-mono text-micro text-faint">{[LEVEL_LABELS[c.suggestedLevel], c.suggestedLevel === "ad_group" ? c.adGroupId : null].filter(Boolean).join(" · ")}</span>
        </span>
      ),
    },
    {
      key: "reasons",
      header: "Reasons",
      width: "minmax(160px,1.4fr)",
      cell: (c) => {
        const rules = rulesOf(c);
        return (
          <span className="flex flex-wrap gap-1" title={c.reasons.join("\n")}>
            {rules.slice(0, 2).map((r) => (
              <span key={r} className="rounded-pill border border-line px-2 py-0.5 text-[11px] whitespace-nowrap text-muted">
                {REASON_LABELS[r]}
              </span>
            ))}
            {rules.length > 2 ? <span className="px-1 py-0.5 text-[11px] text-faint">{`+${rules.length - 2}`}</span> : null}
            {!rules.length && c.reasons[0] ? <span className="truncate text-[11px] text-muted">{c.reasons[0]}</span> : null}
          </span>
        );
      },
    },
    { key: "cost", header: "Cost", width: "84px", align: "right", sortValue: (c) => c.cost, cell: (c) => money(c.cost) },
    { key: "clicks", header: "Clicks", width: "64px", align: "right", sortValue: (c) => c.clicks, cell: (c) => formatNumber(c.clicks) },
    { key: "conv", header: "Conv.", width: "58px", align: "right", sortValue: (c) => c.conversions, cell: (c) => formatNumber(c.conversions, { decimals: c.conversions % 1 ? 1 : 0 }) },
    { key: "savings", header: "Savings / mo", width: "96px", align: "right", sortValue: (c) => c.monthlySavings, cell: (c) => <span className="font-semibold">{money(c.monthlySavings)}</span> },
    {
      key: "verdict",
      header: "AI verdict",
      width: "minmax(180px,1.6fr)",
      sortValue: (c) => VERDICTS.indexOf(verdictOf(c)),
      cell: (c) => {
        const v = VERDICT_META[verdictOf(c)];
        return (
          <span className="flex min-w-0 flex-col items-start gap-1">
            <Pill tone={v.tone}>{v.label}</Pill>
            {c.aiReason ? (
              <span className="line-clamp-2 text-[11px] leading-snug text-muted-3" title={c.aiReason}>
                {c.aiReason}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: "match",
      header: "Match",
      width: "104px",
      cell: (c) => (
        <Select
          aria-label={`Match type for “${c.term}”`}
          value={match[candidateKey(c)] ?? c.suggestedMatch}
          onChange={(e) => setMatch((m) => ({ ...m, [candidateKey(c)]: e.target.value as MatchType }))}
          className="w-full px-2 py-1.5 text-xs"
        >
          {NEGATIVE_MATCH_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      ),
    },
  ];

  const t = q.data?.thresholds;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader />

      {q.data ? (
        <TileGrid min={170}>
          <StatTile label="Candidates" value={<span className="tabular">{formatNumber(q.data.totals.candidates)}</span>}>
            <span className="text-xs text-muted-3">{`Search terms & n-grams · ${rangeLabel.toLowerCase()}`}</span>
          </StatTile>
          <StatTile label="Potential savings / mo" value={<span className="tabular text-accent">{money(q.data.totals.monthlySavings)}</span>}>
            <span className="text-xs text-muted-3">Spend on flagged terms, per 30 days</span>
          </StatTile>
          <StatTile label="AI says negative" value={<span className="tabular">{counts.verdicts.negative}</span>}>
            <span className="text-xs text-muted-3">{`${counts.verdicts.review} to review · ${counts.verdicts.keep} to keep`}</span>
          </StatTile>
          <StatTile label="Selected" value={<span className="tabular">{chosen.length}</span>}>
            <span className="text-xs text-muted-3">{chosen.length ? `Up to ${money(savings)} / mo` : "Pick rows to add as negatives"}</span>
          </StatTile>
        </TileGrid>
      ) : null}

      <div className="flex flex-wrap items-start gap-3.5 rounded-mini border border-teal/30 bg-teal/6 px-[18px] py-3" role="note">
        <span className="rounded-pill bg-accent px-2.5 py-[3px] font-mono text-micro tracking-eyebrow text-on-accent uppercase">Brand protected</span>
        <span className="min-w-[240px] flex-1 text-[13px] leading-normal text-muted">
          {brandTerms.length ? (
            <>
              Terms containing your brand ({brandTerms.map((b, i) => (
                <span key={b}>
                  {i ? ", " : ""}
                  <span className="font-medium text-fg">{b}</span>
                </span>
              ))}) are never suggested unless they carry an irrelevant modifier — then only the modifier is added (e.g. “careers”), never the brand. Negatives containing a brand term are refused.
            </>
          ) : (
            "No brand terms are configured, so brand searches aren't protected. Add them in settings before adding negatives."
          )}
        </span>
      </div>

      <Card className="flex flex-col gap-4">
        <CardHeader
          title="Negative keyword candidates"
          sub={`${rangeLabel}${custom ? " (custom ranges use the last 30 days)" : ""} · most savings first`}
          action={
            <Select aria-label="Campaign" value={cid ?? ""} onChange={(e) => void setCid(e.target.value || null)} className="max-w-[240px] py-2">
              <option value="">All campaigns</option>
              {campaigns.list.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          }
        />
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            ariaLabel="AI verdict"
            variant="sans"
            value={verdict}
            onChange={(v) => void setVerdict(v)}
            options={VERDICT_VALUES.map((v) => ({ value: v, label: v === "all" ? `All · ${all.length}` : `${VERDICT_META[v].label} · ${counts.verdicts[v]}` }))}
          />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Reason">
            <Chip active={reason === "all"} onClick={() => void setReason("all")}>
              All reasons
            </Chip>
            {REASON_ORDER.filter((r) => counts.reasons[r]).map((r) => (
              <Chip key={r} active={reason === r} count={counts.reasons[r]} onClick={() => void setReason(reason === r ? "all" : r)}>
                {REASON_LABELS[r]}
              </Chip>
            ))}
          </div>
        </div>

        {q.error && !q.data ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : !q.data ? (
          <Skeleton height={360} className="w-full" />
        ) : all.length === 0 ? (
          <EmptyState>{`No wasteful search terms in this range — nothing crossed the thresholds${t ? ` (${money(t.costThreshold)} without conversions, ${t.clicksThreshold} clicks)` : ""}.`}</EmptyState>
        ) : (
          <Refetching active={q.isFetching && q.isPlaceholderData}>
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={candidateKey}
              selectable
              selected={selected}
              onSelectedChange={setSelected}
              initialSort={{ key: "savings", dir: "desc" }}
              minWidth={1180}
              maxHeight={620}
              ariaLabel="Negative keyword candidates"
              empty="No candidates match these filters."
              rowClassName={(c) => (verdictOf(c) === "keep" ? "opacity-70" : undefined)}
            />
          </Refetching>
        )}

        {q.data && all.length ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
            <Button variant="link" className="text-xs" disabled={!recommended.length} onClick={() => setSelected(new Set(recommended.map(candidateKey)))}>
              {`Select AI negatives (${recommended.length})`}
            </Button>
            {selected.size ? (
              <Button variant="link" className="text-xs text-muted-3" onClick={() => setSelected(new Set())}>
                Clear selection
              </Button>
            ) : null}
            <span className="flex-1" />
            <span className="text-[13px] text-muted">
              {chosen.length ? `${chosen.length} selected${hidden ? ` (${hidden} hidden by filters)` : ""} · up to ${money(savings)} / mo` : "Nothing selected"}
            </span>
            <LiveGuard>
              <Button variant="accent" onClick={() => void add()} loading={write.pending} disabled={!chosen.length}>
                {chosen.length ? `Add ${chosen.length} negative${chosen.length === 1 ? "" : "s"}` : "Add negatives"}
              </Button>
            </LiveGuard>
            {live ? (
              <Button variant="outline" onClick={() => void add()} disabled={!chosen.length}>
                Get Editor CSV…
              </Button>
            ) : null}
          </div>
        ) : null}
      </Card>

      {q.data ? (
        <AiSourceLine source={q.data.source} model={q.data.model} fallbackReason={q.data.fallbackReason} warnings={q.data.warnings} demoLabel="Rule-based verdicts · demo engine" aiLabel="Verdicts by">
          {t ? (
            <span className="font-mono text-meta tracking-label text-faint uppercase">
              {`· flagged at ${money(t.costThreshold)} without conversions · ${t.clicksThreshold}+ clicks · CTR under ${Math.round(t.lowCtrFactor * 100)}% of the campaign's`}
            </span>
          ) : null}
        </AiSourceLine>
      ) : null}
      {write.dialog}
    </div>
  );
}
