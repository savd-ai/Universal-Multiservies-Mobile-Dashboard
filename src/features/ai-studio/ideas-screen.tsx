"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { PullQuote } from "@/components/brand/brand";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Segmented } from "@/components/ui/controls";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input } from "@/components/ui/inputs";
import { Pill } from "@/components/ui/status";
import { Card, CardHeader, MetaStat } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useIdeaSet } from "@/lib/api/ai";
import { useGenerateIdeas, useIdeaSets, useNarrative, usePatchIdea } from "@/lib/api/analytics";
import { useSettings, useStatus } from "@/lib/api/hooks";
import type { IdeaSet } from "@/lib/domain/contracts/ai";
import { formatShort } from "@/lib/domain/dates";
import { AI_GOALS, type AiGoal } from "@/lib/domain/demo/scenario";
import { RANGE_LABELS, useFilters } from "@/lib/filters";
import { displayMoney, moneyFromStatus } from "@/lib/money";
import { clampBudget, ideaCounts, ideaSourceLabel, modelLabel, nextMonthName, PLAN_HREF, relativeTime, shortCampaignName, visibleIdeas, type StoredIdea } from "./ideas-model";
import { AiSourceLine, useCampaignIndex, useNow, type CampaignRef } from "./shared";
import { useCan } from "@/lib/api/auth";

// 05 · AI studio — Ideas. The prototype's AI page: goal / test budget / context panel, six idea cards (add to plan,
// dismiss, build blueprint), plus the account narrative insight and the idea-set history (restore any generation).

interface GenerateBody {
  goal: AiGoal;
  testBudget: number;
  context: string;
}

const isGoal = (g: string): g is AiGoal => (AI_GOALS as readonly string[]).includes(g);

export function IdeasScreen() {
  const router = useRouter();
  const status = useStatus();
  const today = status.data?.today;
  const filters = useFilters(today);
  const settings = useSettings();
  const sets = useIdeaSets();
  const [setId, setSetId] = useQueryState("set", parseAsString.withOptions({ history: "replace", scroll: false }));
  const [, setCampaign] = useQueryState("campaign", parseAsString.withOptions({ history: "push", scroll: false }));
  const [showDismissed, setShowDismissed] = useState(false);
  const listed = setId ? sets.data?.find((s) => s.id === setId) : undefined;
  const single = useIdeaSet(setId && sets.data && !listed ? setId : null);
  const latest = sets.data?.[0] ?? null;
  const viewed: IdeaSet | null = setId ? (listed ?? single.data ?? null) : latest;
  const gen = useGenerateIdeas();
  const patch = usePatchIdea();
  const narrativeRange = filters.rangeKey === "custom" ? "30d" : filters.rangeKey;
  const narrative = useNarrative(narrativeRange);
  const campaigns = useCampaignIndex();
  const planMonth = nextMonthName(today);
  const display = useMemo(() => moneyFromStatus(status.data), [status.data]);
  const money = (v: number) => displayMoney(v, display);

  const generate = (body: GenerateBody) => {
    if (gen.isPending) return;
    gen.mutate(body, {
      onSuccess: (set) => {
        void setSetId(null);
        setShowDismissed(false);
        toast(set.source === "demo" ? "AI unavailable — showing demo ideas" : `Generated ${set.ideas.length} ideas with ${modelLabel(set.source, set.model)}`);
      },
      onError: (e) => toast((e as Error).message || "Couldn't generate ideas", { tone: "crit" }),
    });
  };

  const togglePlan = (idea: StoredIdea) => {
    if (!viewed) return;
    patch.mutate({ setId: viewed.id, ideaId: idea.id, patch: { inPlan: !idea.inPlan } }, { onError: () => toast("Couldn't update the plan", { tone: "crit" }) });
    if (!idea.inPlan) toast(`Added “${idea.title}” to the ${planMonth} plan`, { action: { label: "Open plan", onClick: () => router.push(PLAN_HREF) } });
  };

  const setDismissed = (idea: StoredIdea, dismissed: boolean) => {
    if (!viewed) return;
    const setKey = viewed.id;
    patch.mutate({ setId: setKey, ideaId: idea.id, patch: { dismissed } }, { onError: () => toast("Couldn't update the idea", { tone: "crit" }) });
    if (dismissed) toast(`Dismissed “${idea.title}”`, { action: { label: "Undo", onClick: () => patch.mutate({ setId: setKey, ideaId: idea.id, patch: { dismissed: false } }) } });
  };

  const counts = ideaCounts(viewed);
  const ideas = visibleIdeas(viewed, showDismissed);
  const loadingSets = !sets.data && !sets.error;
  const initial: GenerateBody = viewed ? { goal: isGoal(viewed.goal) ? viewed.goal : "Scale conversions", testBudget: viewed.testBudget, context: viewed.context } : { goal: "Scale conversions", testBudget: 3000, context: "" };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader />

      <Insight narrative={narrative} rangeLabel={RANGE_LABELS[filters.rangeKey === "custom" ? "30d" : filters.rangeKey]} />

      <IdeaControls
        key={viewed?.id ?? "new"}
        initial={initial}
        currency={status.data?.account.currency ?? "USD"}
        businessContext={settings.data?.businessContext}
        pending={gen.isPending}
        onGenerate={generate}
      />

      <AiSourceLine
        source={gen.isPending ? undefined : viewed?.source}
        model={viewed?.model}
        fallbackReason={viewed?.fallbackReason}
        warnings={viewed?.warnings}
        demoLabel={`Demo suggestions · goal: ${viewed?.goal ?? ""}`}
        aiLabel="Generated by"
      >
        {viewed && viewed.source !== "demo" ? <span className="font-mono text-meta tracking-label text-faint uppercase">· goal: {viewed.goal}</span> : null}
        <SetMeta viewed={viewed} latestId={latest?.id} onLatest={() => void setSetId(null)} />
        <span className="flex-1" />
        {counts.dismissed ? (
          <Button variant="link" className="text-xs" onClick={() => setShowDismissed((v) => !v)} aria-pressed={showDismissed}>
            {showDismissed ? "Hide dismissed" : `Show dismissed (${counts.dismissed})`}
          </Button>
        ) : null}
      </AiSourceLine>
      {gen.isPending || (!viewed && !loadingSets) ? (
        <div className="font-mono text-meta tracking-label text-faint uppercase" aria-live="polite">
          {ideaSourceLabel(null, { loading: gen.isPending, campaigns: campaigns.loaded ? campaigns.list.length : null, goal: gen.variables?.goal ?? initial.goal })}
        </div>
      ) : null}

      {gen.isPending || loadingSets || (setId && !viewed && single.isLoading) ? (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]" aria-busy="true" aria-label="Generating ideas">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-[280px] animate-shimmer rounded-card border border-tone/8 bg-card" />
          ))}
        </div>
      ) : sets.error && !sets.data ? (
        <ErrorState error={sets.error} onRetry={() => void sets.refetch()} />
      ) : setId && !viewed ? (
        <EmptyState action={<Button variant="link" onClick={() => void setSetId(null)}>Show the latest ideas →</Button>}>That idea set no longer exists.</EmptyState>
      ) : !viewed ? (
        <EmptyState>No ideas yet. Pick a goal and generate six campaign ideas grounded in the last 30 days of account data.</EmptyState>
      ) : ideas.length === 0 ? (
        <EmptyState action={<Button variant="link" onClick={() => setShowDismissed(true)}>Show dismissed ideas →</Button>}>All ideas in this set were dismissed.</EmptyState>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
          {ideas.map((idea, i) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              n={i + 1}
              money={money}
              campaigns={campaigns.byId}
              planMonth={planMonth}
              blueprintHref={`/ai/blueprint?set=${encodeURIComponent(viewed.id)}&idea=${encodeURIComponent(idea.id)}`}
              onTogglePlan={() => togglePlan(idea)}
              onDismiss={() => setDismissed(idea, true)}
              onRestore={() => setDismissed(idea, false)}
              onOpenCampaign={(id) => void setCampaign(id)}
            />
          ))}
        </div>
      )}

      {sets.data && sets.data.length > 1 ? (
        <IdeaHistory
          sets={sets.data}
          viewedId={viewed?.id}
          money={money}
          onRestore={(s, isLatest) => {
            void setSetId(isLatest ? null : s.id);
            setShowDismissed(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      ) : null}
    </div>
  );
}

function Insight({ narrative, rangeLabel }: { narrative: ReturnType<typeof useNarrative>; rangeLabel: string }) {
  if (narrative.error && !narrative.data) return null;
  if (!narrative.data)
    return (
      <div className="rounded-mini border border-teal/30 bg-teal/6 px-4 py-3.5" aria-busy="true">
        <Skeleton height={20} className="w-4/5" />
      </div>
    );
  const d = narrative.data;
  return (
    <PullQuote attribution={`Account narrative · ${rangeLabel} · ${d.source === "demo" || !d.source ? "Demo engine" : modelLabel(d.source, d.model)}`}>
      {d.headline}
    </PullQuote>
  );
}

function SetMeta({ viewed, latestId, onLatest }: { viewed: IdeaSet | null; latestId?: string; onLatest: () => void }) {
  const now = useNow();
  if (!viewed) return null;
  const when = now ? relativeTime(viewed.createdAt, now) : formatShort(viewed.createdAt.slice(0, 10));
  if (!latestId || viewed.id === latestId) return <span className="font-mono text-meta tracking-label text-faint uppercase">· {when}</span>;
  return (
    <span className="flex items-center gap-2 text-xs text-muted-3">
      <Pill tone="muted">Previous generation</Pill>
      <span>{when}</span>
      <Button variant="link" className="text-xs" onClick={onLatest}>
        Back to latest →
      </Button>
    </span>
  );
}

const LABEL = "font-mono text-micro tracking-meta text-muted-3 uppercase";

function IdeaControls({ initial, currency, businessContext, pending, onGenerate }: { initial: GenerateBody; currency: string; businessContext?: string; pending: boolean; onGenerate: (b: GenerateBody) => void }) {
  const [goal, setGoal] = useState<AiGoal>(initial.goal);
  const [budget, setBudget] = useState(String(initial.testBudget));
  const [context, setContext] = useState(initial.context);
  const submit = () => onGenerate({ goal, testBudget: clampBudget(Number(budget)), context: context.trim().slice(0, 1000) });
  const submitOnMetaEnter = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };
  return (
    <Card accent flat className="flex flex-wrap items-end gap-5">
      <div className="flex flex-col gap-2.5">
        <span className={LABEL}>Goal</span>
        <Segmented options={AI_GOALS.map((g) => ({ value: g, label: g }))} value={goal} onChange={setGoal} ariaLabel="Goal" variant="sans" size="md" className="bg-transparent" />
      </div>
      <label className="flex flex-col gap-2.5">
        <span className={LABEL}>{`Test budget / month (${currency})`}</span>
        <Input
          type="number"
          min={0}
          step={100}
          inputMode="numeric"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className="w-[140px] px-3.5 py-[9px]"
        />
      </label>
      <label className="flex min-w-[220px] flex-1 flex-col gap-2.5">
        <span className={LABEL}>Extra context</span>
        <textarea
          rows={1}
          value={context}
          maxLength={1000}
          onChange={(e) => setContext(e.target.value)}
          onKeyDown={submitOnMetaEnter}
          placeholder="New trail collection launches Oct 15"
          className="max-h-32 min-h-[38px] resize-none rounded-[19px] border border-line bg-fill px-3.5 py-[9px] text-sm leading-5 text-fg outline-none [field-sizing:content] placeholder:text-faint focus:border-accent/60"
        />
      </label>
      <Button variant="brand" size="sm" loading={pending} onClick={submit} className="min-w-[170px] justify-center">
        {pending ? "Thinking…" : "Generate ideas"}
      </Button>
      {businessContext ? (
        <p className="m-0 w-full text-xs leading-normal text-muted-3">
          <span className={cn(LABEL, "mr-2")}>Business context</span>
          {businessContext}
        </p>
      ) : null}
    </Card>
  );
}

interface IdeaCardProps {
  idea: StoredIdea;
  n: number;
  money: (v: number) => string;
  campaigns: Map<string, CampaignRef>;
  planMonth: string;
  blueprintHref: string;
  onTogglePlan: () => void;
  onDismiss: () => void;
  onRestore: () => void;
  onOpenCampaign: (id: string) => void;
}

function IdeaCard({ idea, n, money, campaigns, planMonth, blueprintHref, onTogglePlan, onDismiss, onRestore, onOpenCampaign }: IdeaCardProps) {
  const added = !!idea.inPlan;
  const canPlan = useCan()("budget.plan");
  const confidence = Math.max(0, Math.min(100, Math.round(idea.confidence)));
  return (
    <article className={cn("flex animate-fade-up flex-col gap-3.5 rounded-card border bg-card p-[22px] shadow-card", added ? "border-teal/30" : "border-line", idea.dismissed && "opacity-55")} aria-label={idea.title}>
      <div className="flex justify-between gap-3 font-mono text-meta tracking-label uppercase">
        <span className="text-accent">
          {String(n).padStart(2, "0")}
          {idea.topUp ? (
            <span className="text-faint" title="Added from the idea library to reach six ideas">
              {" "}
              · library
            </span>
          ) : null}
        </span>
        <span className="text-muted-3">{idea.type}</span>
      </div>
      <h3 className="m-0 font-display text-[21px] leading-[1.15] font-semibold tracking-title">{idea.title}</h3>
      <p className="m-0 text-[13px] leading-[1.6] text-muted">{idea.rationale}</p>
      {idea.citedCampaignIds.length ? (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
          <span className="font-mono text-micro tracking-label text-faint uppercase">Based on</span>
          {idea.citedCampaignIds.map((id) => (
            <button key={id} type="button" onClick={() => onOpenCampaign(id)} className="text-accent hover:opacity-85" title={campaigns.get(id)?.name ?? id}>
              {shortCampaignName(campaigns.get(id)?.name ?? id)} ↗
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5 text-xs">
        <span className="font-mono text-micro tracking-label text-faint uppercase">Audience</span>
        <span className="text-fg">{idea.audience}</span>
      </div>
      {idea.keywords.length ? (
        <div className="flex flex-wrap gap-1.5">
          {idea.keywords.map((kw) => (
            <span key={kw} className="rounded-pill border border-line px-2.5 py-1 text-meta text-muted">
              {kw}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-auto grid grid-cols-2 gap-3 border-t border-tone/8 pt-3.5">
        <MetaStat label="Daily budget" value={money(idea.dailyBudget)} />
        <MetaStat label="Expected" value={idea.impact || "—"} tone="accent" />
      </div>
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-micro text-faint">Confidence</span>
        <div className="h-1 flex-1 rounded-pill bg-tone/6" role="meter" aria-label="Confidence" aria-valuenow={confidence} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-pill bg-accent" style={{ width: `${confidence}%` }} />
        </div>
        <span className="font-mono text-micro text-muted">{confidence}%</span>
      </div>
      <div className="flex gap-2.5">
        {idea.dismissed ? (
          <button type="button" onClick={onRestore} className="flex-1 rounded-pill border border-line p-2.5 text-center text-[13px] text-muted transition-colors hover:border-tone/30 hover:text-fg">
            Restore idea
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onTogglePlan}
              disabled={!canPlan}
              title={canPlan ? undefined : "Your role can't change budget plans"}
              aria-pressed={added}
              className={cn(
                "flex-1 rounded-pill border p-2.5 text-center text-[13px] font-semibold transition-[filter,border-color,color] disabled:cursor-not-allowed disabled:opacity-45",
                added ? "border-tone/12 bg-transparent text-muted hover:border-tone/30" : "border-accent bg-accent text-on-accent hover:brightness-105",
              )}
            >
              {added ? `In ${planMonth} plan ✓` : "Add to plan →"}
            </button>
            <button type="button" onClick={onDismiss} aria-label={`Dismiss “${idea.title}”`} className="rounded-pill border border-line px-4 py-2.5 text-[13px] text-muted-3 transition-colors hover:border-tone/30 hover:text-fg">
              Dismiss ×
            </button>
          </>
        )}
      </div>
      <Link href={blueprintHref} className="self-start text-[13px]">
        Build blueprint →
      </Link>
    </article>
  );
}

function IdeaHistory({ sets, viewedId, money, onRestore }: { sets: IdeaSet[]; viewedId?: string; money: (v: number) => string; onRestore: (s: IdeaSet, isLatest: boolean) => void }) {
  const now = useNow();
  const [all, setAll] = useState(false);
  const shown = all ? sets : sets.slice(0, 8);
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader title="Idea history" sub={`${sets.length} generations · latest first · restore any set`} />
      <div className="flex flex-col" role="list">
        {shown.map((s, i) => {
          const c = ideaCounts(s);
          const current = s.id === viewedId;
          return (
            <div key={s.id} role="listitem" className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line-soft py-3 last:border-0">
              <span className="w-24 shrink-0 font-mono text-micro tracking-label text-faint uppercase">{now ? relativeTime(s.createdAt, now) : formatShort(s.createdAt.slice(0, 10))}</span>
              <span className="min-w-[200px] flex-1 truncate text-[13px]" title={s.context || undefined}>
                <span className="font-medium text-fg">{s.goal}</span>
                <span className="text-muted-3">
                  {` · ${money(s.testBudget)} / mo`}
                  {s.context ? ` · “${s.context}”` : ""}
                </span>
              </span>
              <span className="font-mono text-micro tracking-label text-muted-3 uppercase">{s.source === "demo" ? "Demo" : modelLabel(s.source, s.model)}</span>
              <span className="w-20 text-right text-xs text-muted-3">{c.inPlan ? `${c.inPlan} in plan` : ""}</span>
              {current ? (
                <Pill tone="accent">{i === 0 ? "Latest" : "Viewing"}</Pill>
              ) : (
                <Button variant="link" className="text-[13px]" onClick={() => onRestore(s, i === 0)}>
                  {i === 0 ? "Latest →" : "Restore →"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {sets.length > 8 ? (
        <Button variant="link" className="self-start text-xs" onClick={() => setAll((v) => !v)}>
          {all ? "Show fewer" : `Show all ${sets.length}`}
        </Button>
      ) : null}
    </Card>
  );
}
