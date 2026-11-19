"use client";

import { cn } from "@/components/ui/cn";
import { ErrorState, SkeletonLines } from "@/components/ui/feedback";
import { Drawer } from "@/components/ui/overlays";
import { Sparkline } from "@/components/ui/spark";
import { Pill, SEVERITY_META } from "@/components/ui/status";
import { useSignalExplain } from "@/lib/api/anomalies-ui";
import type { AiProviderId, ExplainFacts } from "@/lib/domain/contracts/ai";
import type { SignalView } from "@/lib/domain/contracts/anomaly";
import { formatShort, isCivilDate } from "@/lib/domain/dates";
import { formatDelta } from "@/lib/domain/metrics/registry";
import type { MetricFormat } from "@/lib/domain/types";
import { useUi } from "@/stores/ui";
import { changeMeta, lagLabel, metricLabel, openTarget, severityLabel } from "./helpers/signals";
import { ActionLink } from "./shared";
import { ChangeContextLine } from "./signal-card";

// "Explain" drawer: the server's observed facts (windows, CPA decomposition, segment contributions, change events
// with the change-history verdict and its change highlighted) and the possible causes, checks and actions — from
// the configured AI provider or the demo rule library.

const PROVIDER: Record<AiProviderId, string> = { anthropic: "Claude", openai: "OpenAI", gemini: "Gemini", demo: "Demo" };
const SERIES_KEY: Record<string, keyof ExplainFacts["series"][number]> = { spend: "cost", cost: "cost", conversions: "conversions", cpa: "cpa", ctr: "ctr", cpc: "cpc", cvr: "cvr", clicks: "clicks", impressions: "impressions" };

type Fmt = (format: MetricFormat, v: number | null | undefined) => string;

const range = (a: string, b: string) => (isCivilDate(a) && isCivilDate(b) ? `${formatShort(a)} – ${formatShort(b)}` : `${a} – ${b}`);

function FactRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div role="row" className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-line-soft py-2 text-[13px]">
      <span role="rowheader" className="text-muted">
        {label}
      </span>
      <span role="cell" className="text-right tabular">
        {children}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="m-0 font-mono text-micro font-normal tracking-meta text-faint uppercase">{title}</h3>
      {children}
    </section>
  );
}

/** Arrow follows the direction, color follows good/bad (e.g. CPA ▲ +70% in red). */
function Delta({ pct, bad }: { pct: number | null; bad: boolean | null }) {
  if (pct === null || !Number.isFinite(pct)) return <span className="text-faint">—</span>;
  return <span className={cn("font-mono text-meta whitespace-nowrap", bad === null ? "text-muted" : bad ? "text-crit" : "text-accent")}>{`${pct >= 0 ? "▲" : "▼"} ${formatDelta(pct)}`}</span>;
}

function Decomposition({ d, fmt }: { d: NonNullable<ExplainFacts["decomposition"]>; fmt: Fmt }) {
  const rows: { key: "cpa" | "cpc" | "cvr" | "ctr"; label: string; format: MetricFormat; direction: "down_good" | "up_good" }[] = [
    { key: "cpa", label: "CPA", format: "money", direction: "down_good" },
    { key: "cpc", label: "CPC", format: "money", direction: "down_good" },
    { key: "cvr", label: "Conv. rate", format: "percent", direction: "up_good" },
    { key: "ctr", label: "CTR", format: "percent", direction: "up_good" },
  ];
  const share = (v: number | null) => (v === null ? null : `${Math.round(v * 100)}%`);
  return (
    <div className="flex flex-col">
      <div role="table" aria-label="CPA decomposition" className="flex flex-col">
        <div role="row" className="grid grid-cols-[minmax(0,1fr)_repeat(3,80px)] gap-2 border-b border-line pb-2 font-mono text-micro tracking-label text-faint uppercase">
          <span role="columnheader">Metric</span>
          <span role="columnheader" className="text-right">
            Baseline
          </span>
          <span role="columnheader" className="text-right">
            Recent
          </span>
          <span role="columnheader" className="text-right">
            Change
          </span>
        </div>
        {rows.map((r) => {
          const b = d.baseline[r.key];
          const c = d.recent[r.key];
          const pct = b && c !== null ? c / b - 1 : null;
          const bad = pct === null || Math.abs(pct) < 0.005 ? null : r.direction === "down_good" ? pct > 0 : pct < 0;
          return (
            <div key={r.key} role="row" className="grid grid-cols-[minmax(0,1fr)_repeat(3,80px)] gap-2 border-b border-line-soft py-2 text-[13px] tabular">
              <span role="rowheader" className="text-muted">
                {r.label}
              </span>
              <span role="cell" className="text-right">
                {fmt(r.format, b)}
              </span>
              <span role="cell" className="text-right">
                {fmt(r.format, c)}
              </span>
              <span role="cell" className="text-right">
                <Delta pct={pct} bad={bad} />
              </span>
            </div>
          );
        })}
      </div>
      {d.dlnCpa !== null && d.cvrShare !== null && d.cpcShare !== null ? (
        <p className="m-0 mt-2.5 text-xs leading-relaxed text-muted-3">{`CPA = CPC ÷ conversion rate: conversion rate explains ${share(d.cvrShare)} of the CPA change, CPC ${share(d.cpcShare)}.`}</p>
      ) : null}
    </div>
  );
}

export function ExplainDrawer({ id, signal, onClose, fmt, onOpen }: { id: string | null; signal: SignalView | undefined; onClose: () => void; fmt: Fmt; onOpen: (target: NonNullable<ReturnType<typeof openTarget>>) => void }) {
  const q = useSignalExplain(id);
  const openChat = useUi((s) => s.openChat);
  const facts = q.data?.facts;
  const sig = facts?.signal;
  const title = signal?.title ?? sig?.title ?? "Explain signal";
  const severity = signal?.severity ?? (sig?.severity as SignalView["severity"] | undefined);
  const format: MetricFormat = signal?.format ?? "number";
  const target = signal ? openTarget(signal) : null;
  const seriesKey = SERIES_KEY[signal?.metric ?? sig?.metric ?? ""] ?? (sig?.kind === "tracking_break" ? "conversions" : "cost");
  const series = (facts?.series ?? []).map((r) => {
    const v = r[seriesKey];
    return typeof v === "number" ? v : null;
  });
  const demo = q.data?.source === "demo";
  const ai = q.data?.ai;
  const verdictContext = facts?.changeContext ?? signal?.changeContext ?? null;
  const verdict = verdictContext && verdictContext.verdict !== "none" ? verdictContext : null;
  const contributions = [...(facts?.contributions ?? [])].filter((c) => c.share !== null).sort((a, b) => Math.abs(b.share ?? 0) - Math.abs(a.share ?? 0)).slice(0, 4);

  return (
    <Drawer open={!!id} onOpenChange={(o) => !o && onClose()} eyebrow={`Explain${severity ? ` · ${signal ? severityLabel(signal) : SEVERITY_META[severity].label}` : ""}`} title={title} width={520}>
      {signal ? <div className="-mt-3 text-[13px] text-muted">{signal.entity.name}</div> : null}

      {q.isPending && id ? <SkeletonLines lines={10} /> : null}
      {q.error ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : null}

      {q.data && facts && sig ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={demo ? "muted" : "accent"}>{demo ? "Demo explanation" : `${PROVIDER[q.data.source]}${q.data.model ? ` · ${q.data.model}` : ""}`}</Pill>
            {q.data.cached ? <Pill tone="faint">Cached</Pill> : null}
          </div>
          {q.data.fallbackReason ? <p className="-mt-3 text-xs leading-relaxed text-muted-3">{q.data.fallbackReason}</p> : null}

          <Section title="Observed facts · from your data">
            {series.some((v) => v !== null) ? (
              <div className="flex flex-col gap-1.5" role="img" aria-label={`${metricLabel(signal?.metric ?? sig.metric ?? undefined)} per day over the last ${series.length} days`}>
                <Sparkline values={series} height={48} color={severity ? `var(--${SEVERITY_META[severity].tone === "accent" ? "accent-line" : SEVERITY_META[severity].tone})` : undefined} />
                <span className="font-mono text-[9px] text-faint">{`${series.length} days · ${metricLabel(signal?.metric ?? sig.metric ?? undefined)}`}</span>
              </div>
            ) : null}
            <div role="table" aria-label="Signal facts" className="flex flex-col">
              <FactRow label="Observed">{fmt(format, sig.observed)}</FactRow>
              <FactRow label="Expected">{fmt(format, sig.expected)}</FactRow>
              <FactRow label="Change">
                <Delta pct={sig.changePct} bad={sig.polarity === "bad"} />
              </FactRow>
              <FactRow label="Recent window">{range(sig.window.recentStart, sig.window.recentEnd)}</FactRow>
              <FactRow label="Baseline window">{range(sig.window.baselineStart, sig.window.baselineEnd)}</FactRow>
            </div>
          </Section>

          {facts.decomposition ? (
            <Section title="What moved">
              <Decomposition d={facts.decomposition} fmt={fmt} />
            </Section>
          ) : null}

          {contributions.length ? (
            <Section title="Where it happened">
              <div role="table" aria-label="Segment contributions" className="flex flex-col">
                {contributions.map((c) => (
                  <FactRow key={`${c.dimension}:${c.segment}`} label={`${c.segment} · ${c.dimension}`}>
                    <span className="text-muted">{`${Math.round((c.share ?? 0) * 100)}% of the change`}</span>
                    {c.changePct !== null ? <span className="ml-2 font-mono text-meta text-muted-3">{formatDelta(c.changePct)}</span> : null}
                  </FactRow>
                ))}
              </div>
            </Section>
          ) : null}

          {facts.changes.length || verdict ? (
            <Section title="Change history in the window">
              {verdict ? <ChangeContextLine context={verdict} /> : null}
              {facts.changes.length ? (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {facts.changes.map((c) => {
                    const primary = c.primary || c.id === verdict?.eventId;
                    const meta = [changeMeta(c), typeof c.lagDays === "number" ? lagLabel(c.lagDays) : null].filter(Boolean).join(" · ");
                    return (
                      <li key={c.id} className={cn("flex gap-3 text-[13px]", primary && "-mx-2.5 rounded-mini border border-teal/30 bg-teal-t px-2.5 py-2")} aria-current={primary || undefined}>
                        <span className="w-14 shrink-0 font-mono text-meta text-faint">{isCivilDate(c.date) ? formatShort(c.date) : c.date}</span>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className={primary ? "font-medium text-fg" : "text-muted"}>{c.summary}</span>
                          {meta ? <span className="font-mono text-micro tracking-label text-faint uppercase">{meta}</span> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </Section>
          ) : null}

          {ai ? (
            <>
              <Section title={demo ? "Possible causes · rule library" : "Possible causes"}>
                {ai.possibleCauses.map((c, i) => (
                  <div key={`${c.cause}-${i}`} className="flex flex-col gap-2.5 rounded-mini border border-tone/8 bg-fill p-3.5">
                    <div className="flex items-start gap-3">
                      <span className="min-w-0 flex-1 text-sm font-semibold">{c.cause}</span>
                      <Pill tone={c.likelihood === "high" ? "accent" : c.likelihood === "medium" ? "muted" : "faint"}>{`${c.likelihood} likelihood`}</Pill>
                    </div>
                    {c.evidence.length ? (
                      <ul className="m-0 flex list-disc flex-col gap-1 pl-4 text-xs leading-relaxed text-muted marker:text-faint">
                        {c.evidence.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    ) : null}
                    {c.checks.length ? (
                      <div className="flex flex-col gap-1">
                        <span className="label-mono">Check</span>
                        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs leading-relaxed">
                          {c.checks.map((x) => (
                            <li key={x} className="flex gap-2">
                              <span aria-hidden className="text-accent">
                                ✓
                              </span>
                              <span>{x}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ))}
              </Section>

              {ai.actions.length ? (
                <Section title="Suggested actions">
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {ai.actions.map((a, i) => (
                      <li key={`${a.action}-${i}`} className="flex flex-col gap-1 border-b border-line-soft pb-3 last:border-b-0">
                        <div className="flex items-start gap-3">
                          <span className="min-w-0 flex-1 text-[13px] font-semibold">{`→ ${a.action}`}</span>
                          <Pill tone={a.risk === "low" ? "accent" : "muted"}>{`${a.risk} risk`}</Pill>
                        </div>
                        <span className="text-xs leading-relaxed text-muted">{a.rationale}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              {ai.confidenceNote ? <p className="m-0 font-serif text-[15px] leading-[1.45] text-muted italic">{ai.confidenceNote}</p> : null}
            </>
          ) : (
            <p className="m-0 text-[13px] text-muted-3">No explanation was produced — the facts above are all the server could establish.</p>
          )}

          {q.data.warnings.length ? <p className="m-0 text-xs text-muted-3">{q.data.warnings.join(" ")}</p> : null}

          <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4">
            <ActionLink tone="accent" onClick={() => openChat(`Help me investigate "${title}" on ${signal?.entity.name ?? sig.campaignName}. What should I check first?`)}>
              Ask AI about this →
            </ActionLink>
            {target ? <ActionLink onClick={() => onOpen(target)}>{target.kind === "budget" ? "Open budget planner →" : "Open campaign →"}</ActionLink> : null}
          </div>
        </>
      ) : null}
    </Drawer>
  );
}
