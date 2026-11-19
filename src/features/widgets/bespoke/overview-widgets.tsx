"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { ErrorState, InlineEmpty, Refetching, Skeleton, SkeletonLines } from "@/components/ui/feedback";
import { MiddleTruncate } from "@/components/ui/middle-truncate";
import { Sparkline } from "@/components/ui/spark";
import { Dot, Meter, Pill, SEVERITY_META } from "@/components/ui/status";
import { MetaStat } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useAnomalies, useGenerateIdeas, useIdeaSets, useNarrative, usePacing, usePatchIdea } from "@/lib/api/analytics";
import { useCatalog, useQueryResult } from "@/lib/api/hooks";
import type { CampaignIdea } from "@/lib/domain/contracts/ai";
import type { SignalView } from "@/lib/domain/contracts/anomaly";
import { formatMetricValue } from "@/lib/domain/metrics/registry";
import type { QueryRow } from "@/lib/domain/query/spec";
import { displayMoney, type MoneyLike } from "@/lib/money";
import { resolveWidgetSpec } from "../resolve-spec";
import type { WidgetProps } from "../types";
import { useWidgetHints, useWidgetSubtitle } from "../widget-frame";
import { useCan } from "@/lib/api/auth";

// The prototype's bespoke Overview widgets, now on real APIs: Budget pacing, Anomalies, Campaign performance,
// AI campaign ideas and Cross-channel. Markup, copy and colors follow the reference HTML.

const money = (v: number | null | undefined, m: MoneyLike, decimals?: number) => displayMoney(v, m, decimals);

// ── Budget pacing ────────────────────────────────────────────────────────────────────────────────────

export function PacingWidget({ rt }: WidgetProps) {
  const q = usePacing();
  const r = q.data;
  useWidgetSubtitle(r ? `${r.monthLabel.split(" ")[0]} · month to date` : null);
  if (q.error && !r) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!r) return <SkeletonLines lines={5} />;
  const tot = r.totals;
  const pr = tot.monthlyTarget > 0 ? tot.projected / tot.monthlyTarget : 0;
  const over = pr > 1.05;
  const tone = (x: number) => (x > 1.05 ? "text-warn" : x < 0.9 ? "text-muted" : "text-accent");
  const worst = [...r.rows].filter((x) => x.monthlyTarget > 0 && (x.status === "overpacing" || x.status === "underpacing" || x.status === "on_track")).sort((a, b) => b.paceRatio - a.paceRatio).slice(0, 3);
  return (
    <Refetching active={q.isFetching && q.isPlaceholderData} className="flex flex-col gap-[18px]">
      <div className="flex items-baseline gap-2.5">
        <span className={cn("font-display text-[52px] leading-none font-semibold tracking-[-0.03em] tabular", over ? "text-warn" : "text-accent")}>{`${(pr * 100).toFixed(0)}%`}</span>
        <span className="text-[13px] text-muted-3">projected of budget</span>
      </div>
      <Meter
        value={tot.monthlyTarget ? tot.mtdSpend / tot.monthlyTarget : 0}
        projected={tot.monthlyTarget ? tot.projected / tot.monthlyTarget : 0}
        marker={r.daysInMonth ? r.elapsedDays / r.daysInMonth : undefined}
        tone={over ? "warn" : "accent"}
        label={`Spent ${money(tot.mtdSpend, rt.money)} of ${money(tot.monthlyTarget, rt.money)}; ${r.elapsedDays} of ${r.daysInMonth} days elapsed`}
      />
      <div className="grid grid-cols-3 gap-3">
        <MetaStat label="MTD" value={money(tot.mtdSpend, rt.money)} />
        <MetaStat label="Projected" value={money(tot.projected, rt.money)} tone={over ? "warn" : undefined} />
        <MetaStat label="Budget" value={money(tot.monthlyTarget, rt.money)} />
      </div>
      <div className="flex flex-col border-t border-tone/8">
        {worst.map((w) => (
          <button key={w.unitId} type="button" onClick={() => w.campaignIds[0] && rt.openCampaign(w.campaignIds[0])} className="flex items-center gap-2.5 border-b border-line-soft py-2.5 text-left text-[13px] hover:bg-fill">
            <MiddleTruncate text={w.name} className="flex-1 text-muted" />
            <span className={cn("font-mono text-meta", tone(w.paceRatio))}>{`${(w.paceRatio * 100).toFixed(0)}%`}</span>
          </button>
        ))}
      </div>
    </Refetching>
  );
}

// ── Anomalies ────────────────────────────────────────────────────────────────────────────────────────

export function signalTitle(s: SignalView): string {
  return s.title;
}

export function AnomalyFeedWidget({ config, rt }: WidgetProps<{ limit?: number }>) {
  const router = useRouter();
  const q = useAnomalies({ status: "open" });
  const limit = config.limit ?? 4;
  const list = useMemo(() => {
    const types = rt.filters.types;
    return (q.data?.signals ?? []).filter((s) => s.status === "open" && (!types.length || !s.entity.type || types.includes(s.entity.type as never)));
  }, [q.data, rt.filters.types]);
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return <SkeletonLines lines={6} />;
  if (!list.length) return <div className="p-5 text-center text-[13px] text-muted-3">No active signals at this sensitivity.</div>;
  return (
    <Refetching active={q.isFetching && q.isPlaceholderData} className="-mx-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-1 pb-1">
      {list.slice(0, limit).map((s) => {
        const meta = SEVERITY_META[s.severity];
        // The expected effect of the account's own change (e.g. a budget raise) is not an opportunity.
        const expected = s.changeContext?.verdict === "expected";
        const tone = expected ? "muted" : meta.tone;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => (s.scope === "campaign" ? rt.openCampaign(s.entity.id) : router.push(`/anomalies?focus=${encodeURIComponent(s.id)}`))}
            className="flex gap-3 rounded-mini border border-line-soft bg-fill px-3.5 py-3 text-left transition-colors hover:border-tone/18"
          >
            <Dot tone={tone} halo className="mt-[5px]" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-baseline gap-2">
                <span className="flex-1 text-sm font-semibold">{signalTitle(s)}</span>
                <span className="font-mono text-micro tracking-[0.1em] uppercase" style={{ color: `var(--${tone === "accent" ? "accent" : tone})` }}>
                  {expected ? "Expected" : meta.label}
                </span>
              </span>
              <MiddleTruncate text={s.entity.name} className="text-xs text-muted-3" />
            </span>
          </button>
        );
      })}
    </Refetching>
  );
}

// ── Campaign performance ─────────────────────────────────────────────────────────────────────────────

const CAMP_GRID = "minmax(200px,2.4fr) repeat(4,minmax(70px,1fr)) 100px";
const SEV_RANK = { critical: 3, warning: 2, info: 1 } as const;

export function CampaignPerformanceWidget({ config, rt, instance }: WidgetProps<{ limit?: number }>) {
  const catalog = useCatalog();
  const limit = config.limit ?? 6;
  const base = useMemo(
    () => resolveWidgetSpec({ source: "google_ads", metrics: ["cost", "conversions", "cpa", "roas"], dimensions: ["campaign", "campaign_type", "campaign_status"], sort: [{ key: "cost", dir: "desc" }] }, rt.filters, catalog.data, instance.filterOptOut),
    [rt.filters, catalog.data, instance.filterOptOut],
  );
  useWidgetHints(base.ignored);
  const q = useQueryResult(catalog.data ? { ...base.spec, limit, totals: true } : null);
  const topIds = (q.data?.rows ?? []).map((r) => String(r.campaign_id ?? r.campaign));
  const spark = useQueryResult(topIds.length ? { ...base.spec, metrics: ["cost"], dimensions: ["campaign", "date"], sort: [{ key: "date", dir: "asc" }], filters: [...(base.spec.filters ?? []), { dim: "campaign", op: "in", value: topIds }], fillGaps: false } : null);
  const signals = useAnomalies({ status: "open" });

  const sparkBy = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const r of spark.data?.rows ?? []) {
      const id = String(r.campaign_id ?? r.campaign);
      if (!m.has(id)) m.set(id, []);
      m.get(id)?.push(typeof r.cost === "number" ? r.cost : 0);
    }
    return m;
  }, [spark.data]);
  const sevBy = useMemo(() => {
    const m = new Map<string, "critical" | "warning" | "info">();
    for (const s of signals.data?.signals ?? []) {
      if (s.status !== "open" || s.scope !== "campaign") continue;
      const cur = m.get(s.entity.id);
      if (!cur || SEV_RANK[s.severity] > SEV_RANK[cur]) m.set(s.entity.id, s.severity);
    }
    return m;
  }, [signals.data]);

  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return <SkeletonLines lines={7} />;
  if (!q.data.rows.length) return <InlineEmpty>No campaigns match these filters.</InlineEmpty>;
  const avgCpa = q.data.totals?.cpa ?? null;

  return (
    <Refetching active={q.isFetching && q.isPlaceholderData} className="relative -mx-1 min-h-0 flex-1 overflow-auto px-1">
      <div className="flex min-w-[620px] flex-col tabular" role="table" aria-label="Campaign performance">
        <div role="row" className="grid gap-3 border-b border-line px-1 pb-2.5 font-mono text-micro tracking-label text-faint uppercase" style={{ gridTemplateColumns: CAMP_GRID }}>
          <span role="columnheader">Campaign</span>
          <span role="columnheader" className="text-right">Spend</span>
          <span role="columnheader" className="text-right">Conv.</span>
          <span role="columnheader" className="text-right">CPA</span>
          <span role="columnheader" className="text-right">ROAS</span>
          <span role="columnheader" className="text-right">Trend</span>
        </div>
        {q.data.rows.map((r: QueryRow) => {
          const id = String(r.campaign_id ?? r.campaign);
          const paused = String(r.campaign_status ?? "").toLowerCase() === "paused";
          const sev = sevBy.get(id);
          const cpa = typeof r.cpa === "number" ? r.cpa : null;
          return (
            <button
              key={id}
              type="button"
              role="row"
              onClick={() => rt.openCampaign(id)}
              className={cn("grid items-center gap-3 border-b border-line-soft px-1 py-3 text-left text-[13px] hover:bg-fill", paused && "opacity-55")}
              style={{ gridTemplateColumns: CAMP_GRID }}
            >
              <span role="cell" className="flex min-w-0 items-center gap-2.5">
                <Dot size={7} tone={paused ? "faint" : sev === "critical" ? "crit" : sev === "warning" ? "warn" : "accent"} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <MiddleTruncate text={String(r.campaign)} className="font-medium" />
                  <span className="font-mono text-micro tracking-[0.1em] text-faint uppercase">{String(r.campaign_type ?? "")}</span>
                </span>
              </span>
              <span role="cell" className="text-right">{money(r.cost as number, rt.money)}</span>
              <span role="cell" className="text-right">{formatMetricValue("decimal", r.conversions as number)}</span>
              <span role="cell" className={cn("text-right", cpa !== null && avgCpa !== null && cpa > avgCpa * 1.4 ? "text-warn" : "text-fg")}>{money(cpa, rt.money, 2)}</span>
              <span role="cell" className="text-right">{formatMetricValue("ratio", r.roas as number)}</span>
              <span role="cell">
                <Sparkline values={sparkBy.get(id) ?? []} height={26} />
              </span>
            </button>
          );
        })}
      </div>
    </Refetching>
  );
}

// ── AI campaign ideas ────────────────────────────────────────────────────────────────────────────────

type StoredIdea = CampaignIdea & { id: string; dismissed?: boolean; inPlan?: boolean };

export function AiIdeasWidget({ config, rt }: WidgetProps<{ count?: number }>) {
  const canPlan = useCan()("budget.plan");
  const router = useRouter();
  const sets = useIdeaSets();
  const gen = useGenerateIdeas();
  const patch = usePatchIdea();
  const narrative = useNarrative(rt.filters.rangeKey);
  const latest = sets.data?.[0];
  const ideas = (latest?.ideas ?? []).filter((i) => !i.dismissed).slice(0, config.count ?? 3) as StoredIdea[];
  const aiLabel = latest ? (latest.source === "demo" ? "Demo suggestions" : `Generated by ${latest.model ?? latest.source}`) : "No ideas yet";

  const generate = () =>
    gen.mutate(
      { goal: (latest?.goal as never) ?? "Scale conversions", testBudget: latest?.testBudget ?? 3000 },
      {
        onSuccess: (set) => toast(set.source === "demo" ? "AI unavailable — showing demo ideas" : `Generated ${set.ideas.length} ideas with ${set.model ?? set.source}`),
        onError: (e) => toast((e as Error).message || "Could not generate ideas", { tone: "crit" }),
      },
    );

  const toggle = (idea: StoredIdea) => {
    if (!latest) return;
    patch.mutate({ setId: latest.id, ideaId: idea.id, patch: { inPlan: !idea.inPlan } });
    if (!idea.inPlan) toast(`Added “${idea.title}” to next month's plan`, { action: { label: "Open plan", onClick: () => router.push("/budget?tab=plans") } });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3.5">
      <div className="rounded-mini border border-teal/30 bg-teal/6 px-4 py-3.5 font-serif text-[17px] leading-[1.45] text-fg italic">
        {narrative.data ? narrative.data.headline : narrative.error ? "Narrative unavailable — open AI studio for suggestions." : <Skeleton height={20} className="w-4/5" />}
      </div>
      {sets.error && !sets.data ? <ErrorState error={sets.error} onRetry={() => void sets.refetch()} compact /> : null}
      {!sets.data && !sets.error ? <Skeleton height={120} className="w-full" /> : null}
      {sets.data && !ideas.length ? <InlineEmpty>Generate ideas grounded in the last 30 days of account data.</InlineEmpty> : null}
      {ideas.length ? (
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {ideas.map((i, n) => (
            <div key={i.id} className={cn("flex flex-col gap-2 rounded-mini border bg-fill p-3.5", i.inPlan ? "border-teal/30" : "border-tone/8")}>
              <div className="flex justify-between font-mono text-micro tracking-label uppercase">
                <span className="text-accent">{`${String(n + 1).padStart(2, "0")} · ${i.type}`}</span>
                <span className="text-faint">{`${Math.round(i.confidence)}%`}</span>
              </div>
              <div className="font-display text-[15px] leading-[1.2] font-semibold">{i.title}</div>
              <div className="text-xs leading-normal text-muted-3">{`${i.impact} · ${money(i.dailyBudget, rt.money)}/day`}</div>
              {canPlan ? (
                <button type="button" onClick={() => toggle(i)} className={cn("mt-auto self-start text-xs", i.inPlan ? "text-muted-3" : "text-accent")}>
                  {i.inPlan ? "In plan ✓" : "Add to plan →"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-auto flex items-center gap-2.5">
        <Button variant="brand" size="sm" onClick={generate} loading={gen.isPending}>
          {gen.isPending ? "Generating…" : latest ? "Regenerate ideas" : "Generate ideas"}
        </Button>
        <span className="font-mono text-micro tracking-label text-faint uppercase">{aiLabel}</span>
      </div>
    </div>
  );
}

// ── Cross-channel ────────────────────────────────────────────────────────────────────────────────────

const ABBR: Record<string, string> = { "Google Ads": "GA", "Meta Ads": "MT", "Microsoft Advertising": "MS", "TikTok Ads": "TT", "LinkedIn Ads": "LI", "Amazon Ads": "AZ", "Pinterest Ads": "PI", "Snapchat Ads": "SC", "Reddit Ads": "RD" };
const abbrOf = (name: string) => ABBR[name] ?? name.replace(/[^A-Za-z ]/g, "").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export function ChannelsBlendWidget({ rt, instance }: WidgetProps) {
  const catalog = useCatalog();
  const { spec, ignored } = useMemo(
    () => resolveWidgetSpec({ source: "blended", metrics: ["cost", "roas"], dimensions: ["platform"], sort: [{ key: "cost", dir: "desc" }] }, rt.filters, catalog.data, instance.filterOptOut),
    [rt.filters, catalog.data, instance.filterOptOut],
  );
  useWidgetHints(ignored);
  const q = useQueryResult(catalog.data ? spec : null);
  const rows = (q.data?.rows ?? []).filter((r) => typeof r.cost === "number" && (r.cost as number) > 0);
  const max = Math.max(1, ...rows.map((r) => r.cost as number));
  // Live Google Ads next to a demo connector (built-ins run on demo data in v1): say which rows are made up
  const sources = q.data?.meta.sources ?? [];
  const googleLive = sources.some((s) => s.id === "google_ads" && s.mode === "live");
  const demoSource = (label: string) => (googleLive ? sources.find((s) => s.label === label && s.mode === "demo") : undefined);
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (!q.data) return <SkeletonLines lines={5} />;
  return (
    <Refetching active={q.isFetching && q.isPlaceholderData} className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto">
      {rows.map((r) => {
        const name = String(r.platform);
        const isGoogle = name === "Google Ads";
        return (
          <div key={name} className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5 text-[13px]">
              <span className="grid size-[26px] shrink-0 place-items-center rounded-full border border-tone/12 font-mono text-[9px] text-muted">{abbrOf(name)}</span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate font-medium">{name}</span>
                {demoSource(name) ? (
                  <span className="shrink-0" title={demoSource(name)?.reason ?? "Demo data"}>
                    <Pill tone="muted" className="px-1.5 py-px text-[9px]">
                      Demo
                    </Pill>
                  </span>
                ) : null}
              </span>
              <span className="tabular">{money(r.cost as number, rt.money)}</span>
              <span className="w-[58px] text-right font-mono text-meta text-muted-3">{formatMetricValue("ratio", r.roas as number)}</span>
            </div>
            <div className="h-1.5 rounded-pill bg-tone/5">
              <div className="h-full rounded-pill" style={{ width: `${((r.cost as number) / max) * 100}%`, background: isGoogle ? "var(--accent)" : "rgba(var(--fg-rgb),0.35)" }} />
            </div>
          </div>
        );
      })}
      <Link href="/plugins" className="rounded-mini border border-dashed border-tone/14 p-3 text-center text-xs text-muted-3 transition-colors hover:border-teal/40 hover:text-accent hover:opacity-100">
        + Connect another platform
      </Link>
    </Refetching>
  );
}
