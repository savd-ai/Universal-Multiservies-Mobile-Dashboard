"use client";

import Link from "next/link";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { SystemDiagram } from "@/components/brand/brand";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/inputs";
import { ConfirmDialog } from "@/components/ui/overlays";
import { Card, CardHeader } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useGenerateBlueprint, useIdeaSet } from "@/lib/api/ai";
import { useIdeaSets } from "@/lib/api/analytics";
import { useSettings, useStatus } from "@/lib/api/hooks";
import type { Blueprint, IdeaSet } from "@/lib/domain/contracts/ai";
import { formatMoney } from "@/lib/domain/metrics/registry";
import { displayMoney, moneyFromStatus } from "@/lib/money";
import {
  BIDDING_LABELS,
  blankIdea,
  blueprintChecks,
  blueprintIssues,
  blueprintRequestFor,
  blueprintStats,
  IDEA_TYPE_OPTIONS,
  ideaDraftFrom,
  ideaIssues,
  isEdited,
  mergeSection,
  splitList,
  STEPS,
  type IdeaDraft,
  type IdeaType,
  type Section,
  type Step,
} from "./blueprint-model";
import { AdsStep, ReviewStep, StructureStep } from "./blueprint-steps";
import { modelLabel } from "./ideas-model";
import { AiSourceLine } from "./shared";
import { useStudio, type BlueprintSession } from "./studio-store";

// 05 · AI studio — Blueprint. A four-step wizard that turns an idea into a launch-ready campaign: 1 idea (pick or
// edit), 2 structure (ad groups, keywords + match types, negatives), 3 ads (RSA, paths, sitelinks, callouts with
// live Google Ads counters), 4 review (bidding, targeting, budget, checklist) → Google Ads Editor CSV, all Paused.

const SECTION_LABEL: Record<Section, string> = { structure: "Structure", ads: "Ads", review: "Bidding & targeting" };

export function BlueprintScreen() {
  const status = useStatus();
  // blueprint amounts are campaign settings in the account currency (imported as-is); idea cards show display money
  const currency = status.data?.account.currency ?? "USD";
  const display = useMemo(() => moneyFromStatus(status.data), [status.data]);
  const settings = useSettings();
  const brandTerms = settings.data?.brandTerms;
  const [setId, setSetId] = useQueryState("set", parseAsString.withOptions({ history: "replace", scroll: false }));
  const [ideaId, setIdeaId] = useQueryState("idea", parseAsString.withOptions({ history: "replace", scroll: false }));
  const [stepParam, setStepParam] = useQueryState("step", parseAsInteger.withDefault(1).withOptions({ history: "push", scroll: false }));
  const sets = useIdeaSets();
  const listed = setId ? sets.data?.find((s) => s.id === setId) : undefined;
  const single = useIdeaSet(setId && sets.data && !listed ? setId : null);
  const set: IdeaSet | null = setId ? (listed ?? single.data ?? null) : null;
  const custom = ideaId === "custom";
  const storedIdea = set && ideaId && !custom ? (set.ideas.find((i) => i.id === ideaId) ?? null) : null;
  const key = custom ? "custom" : set && storedIdea ? `${set.id}:${storedIdea.id}` : null;

  const stored = useStudio((s) => (key ? s.blueprints[key] : undefined));
  const putBlueprint = useStudio((s) => s.putBlueprint);
  const fallback = useMemo<BlueprintSession | null>(() => {
    if (!key) return null;
    const original = storedIdea ? ideaDraftFrom(storedIdea) : null;
    return { idea: original ?? blankIdea(), original, finalUrl: "", checked: {} };
  }, [key, storedIdea]);
  const session = stored ?? fallback;
  const update = (fn: (s: BlueprintSession) => BlueprintSession) => {
    if (!key || !fallback) return;
    putBlueprint(key, fn(useStudio.getState().blueprints[key] ?? fallback));
  };
  const editBlueprint = (fn: (bp: Blueprint) => Blueprint) => update((s) => (s.blueprint ? { ...s, blueprint: fn(s.blueprint) } : s));

  const bp = session?.blueprint;
  const step = (bp ? Math.min(4, Math.max(1, stepParam)) : 1) as Step;
  const lint = useMemo(() => ({ allowCaps: brandTerms ?? [] }), [brandTerms]);
  const checks = useMemo(() => (bp ? blueprintChecks(bp, lint) : {}), [bp, lint]);
  const issues = useMemo(() => (bp ? blueprintIssues(bp, checks) : []), [bp, checks]);
  const gen = useGenerateBlueprint();
  const [confirm, setConfirm] = useState(false);
  const [rev, setRev] = useState(0);
  const go = (n: Step) => {
    void setStepParam(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const generate = async (section?: Section) => {
    if (!session || gen.isPending) return;
    const req = blueprintRequestFor({ setId: set?.id, ideaId: storedIdea?.id, original: session.original, draft: session.idea, finalUrl: session.finalUrl });
    try {
      const res = await gen.mutateAsync(req);
      const meta = { source: res.source, model: res.model, fallbackReason: res.fallbackReason, warnings: res.warnings ?? [] };
      update((s) => ({ ...s, generated: res.blueprint, blueprint: section && s.blueprint ? mergeSection(s.blueprint, res.blueprint, section) : res.blueprint, meta, checked: section ? s.checked : {} }));
      setRev((r) => r + 1);
      if (section) toast(`${SECTION_LABEL[section]} regenerated`);
      else {
        toast(res.source === "demo" ? "Blueprint ready — demo engine" : `Blueprint generated with ${modelLabel(res.source, res.model)}`);
        go(2);
      }
    } catch (e) {
      toast((e as Error).message || "Couldn't generate the blueprint", { tone: "crit" });
    }
  };

  const pick = (s: IdeaSet | null, id: string | null) => {
    void setSetId(s?.id ?? null);
    void setIdeaId(id);
    void setStepParam(1);
  };

  const pickerSet = set ?? sets.data?.[0] ?? null;
  const stats = bp ? blueprintStats(bp) : null;
  const stepIssues = (n: number) => issues.filter((i) => i.step === n).length;
  const nodes = STEPS.map((s) => {
    const caption =
      s.n === 1
        ? session?.idea.title || "Pick or write an idea"
        : !bp || !stats
          ? ["", "", "Ad groups, keywords, negatives", "Headlines, descriptions, assets", "Bidding, targeting, export"][s.n]
          : s.n === 2
            ? `${stats.groups} group${stats.groups === 1 ? "" : "s"} · ${stats.keywords} keywords${stepIssues(2) ? ` · ▲ ${stepIssues(2)}` : ""}`
            : s.n === 3
              ? `${stats.headlines} headlines · ${stats.descriptions} descriptions${stepIssues(3) ? ` · ▲ ${stepIssues(3)}` : ""}`
              : `${BIDDING_LABELS[bp.bidding.strategy]} · ${formatMoney(bp.dailyBudget, { currency })}/day`;
    return { num: `0${s.n}`, title: s.title, caption, active: step === s.n, onClick: s.n === 1 || bp ? () => go(s.n) : undefined };
  });

  const loading = (!sets.data && !sets.error) || (!!setId && !set && single.isLoading);
  const missing = !loading && ((setId && !set) || (ideaId && !custom && !storedIdea));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader />
      <SystemDiagram nodes={nodes} />

      {session?.meta ? (
        <AiSourceLine source={session.meta.source} model={session.meta.model} fallbackReason={session.meta.fallbackReason} warnings={session.meta.warnings} demoLabel="Demo blueprint · deterministic templates">
          {isEdited(bp, session.generated) ? <span className="font-mono text-meta tracking-label text-accent uppercase">· edited</span> : null}
        </AiSourceLine>
      ) : null}

      {loading ? (
        <Skeleton height={320} className="w-full rounded-card" />
      ) : sets.error && !sets.data ? (
        <ErrorState error={sets.error} onRetry={() => void sets.refetch()} />
      ) : missing ? (
        <EmptyState action={<Button variant="link" onClick={() => pick(null, null)}>Choose another idea →</Button>}>That idea is no longer available.</EmptyState>
      ) : !session ? (
        <IdeaPicker set={pickerSet} money={(v) => displayMoney(v, display)} onPick={(id) => pick(pickerSet, id)} onBlank={() => pick(null, "custom")} />
      ) : step === 1 ? (
        <IdeaStep
          key={key}
          session={session}
          currency={currency}
          fromSet={!!storedIdea}
          pending={gen.isPending}
          onIdea={(idea) => update((s) => ({ ...s, idea }))}
          onFinalUrl={(finalUrl) => update((s) => ({ ...s, finalUrl }))}
          onGenerate={() => (bp && isEdited(bp, session.generated) ? setConfirm(true) : void generate())}
          onContinue={() => go(2)}
          onChoose={() => pick(null, null)}
        />
      ) : bp && step === 2 ? (
        <StructureStep bp={bp} onChange={editBlueprint} onRegenerate={(s) => void generate(s)} regenerating={gen.isPending} rev={rev} />
      ) : bp && step === 3 ? (
        <AdsStep bp={bp} onChange={editBlueprint} onRegenerate={(s) => void generate(s)} regenerating={gen.isPending} rev={rev} checks={checks} finalUrl={session.finalUrl} />
      ) : bp ? (
        <ReviewStep
          bp={bp}
          onChange={editBlueprint}
          onRegenerate={(s) => void generate(s)}
          regenerating={gen.isPending}
          rev={rev}
          issues={issues}
          currency={currency}
          finalUrl={session.finalUrl}
          onFinalUrl={(finalUrl) => update((s) => ({ ...s, finalUrl }))}
          checked={session.checked}
          onChecked={(i, v) => update((s) => ({ ...s, checked: { ...s.checked, [i]: v } }))}
          onJump={go}
        />
      ) : null}

      {session && bp ? (
        <div className="flex flex-wrap items-center gap-2.5">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => go((step - 1) as Step)}>
              ← {STEPS[step - 2]?.title}
            </Button>
          ) : null}
          <span className="flex-1" />
          {issues.length ? <span className="text-xs text-muted-3">{`${issues.length} issue${issues.length === 1 ? "" : "s"} to review`}</span> : null}
          {step < 4 ? (
            <Button variant="accent" onClick={() => go((step + 1) as Step)}>
              {`Next: ${STEPS[step]?.title} →`}
            </Button>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Regenerate the whole blueprint?"
        description="Your edits to the structure, ads and settings will be replaced. To refresh one part only, use the ↻ button on that step."
        confirmLabel="Regenerate"
        danger
        onConfirm={() => void generate()}
      />
    </div>
  );
}

function IdeaPicker({ set, money, onPick, onBlank }: { set: IdeaSet | null; money: (v: number) => string; onPick: (ideaId: string) => void; onBlank: () => void }) {
  const ideas = (set?.ideas ?? []).filter((i) => !i.dismissed);
  return (
    <Card className="flex flex-col gap-4">
      <CardHeader title="Choose an idea" sub={set ? `From your latest ideas · goal: ${set.goal}` : "No ideas generated yet"} />
      {ideas.length ? (
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {ideas.map((i, n) => (
            <button key={i.id} type="button" onClick={() => onPick(i.id)} className={cn("flex flex-col gap-2 rounded-mini border bg-fill p-3.5 text-left transition-colors hover:border-teal/40", i.inPlan ? "border-teal/30" : "border-tone/8")}>
              <span className="flex justify-between font-mono text-micro tracking-label uppercase">
                <span className="text-accent">{`${String(n + 1).padStart(2, "0")} · ${i.type}`}</span>
                <span className="text-faint">{`${Math.round(i.confidence)}%`}</span>
              </span>
              <span className="font-display text-[15px] leading-[1.2] font-semibold text-fg">{i.title}</span>
              <span className="text-xs leading-normal text-muted-3">{`${i.impact} · ${money(i.dailyBudget)}/day`}</span>
              <span className="mt-auto text-xs text-accent">Build blueprint →</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="m-0 text-[13px] text-muted-3">
          <Link href="/ai">Generate ideas</Link> first, or start from a blank idea.
        </p>
      )}
      <button type="button" onClick={onBlank} className="rounded-mini border border-dashed border-tone/14 p-3 text-center text-xs text-muted-3 transition-colors hover:border-teal/40 hover:text-accent">
        + Start from a blank idea
      </button>
    </Card>
  );
}

function IdeaStep({ session, currency, fromSet, pending, onIdea, onFinalUrl, onGenerate, onContinue, onChoose }: { session: BlueprintSession; currency: string; fromSet: boolean; pending: boolean; onIdea: (d: IdeaDraft) => void; onFinalUrl: (v: string) => void; onGenerate: () => void; onContinue: () => void; onChoose: () => void }) {
  const d = session.idea;
  const set = <K extends keyof IdeaDraft>(k: K, v: IdeaDraft[K]) => onIdea({ ...d, [k]: v });
  const problems = ideaIssues(d);
  const has = !!session.blueprint;
  const changed = fromSet && session.original && JSON.stringify(session.original) !== JSON.stringify(d);
  return (
    <Card accent className="flex flex-col gap-5">
      <CardHeader
        title="The idea"
        sub={fromSet ? (changed ? (has ? "Edited — regenerate to apply your changes" : "Edited — the blueprint follows your version") : "From your idea set") : "Blank idea"}
        action={
          <Button variant="link" className="text-xs" onClick={onChoose}>
            Choose another idea
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 wide:grid-cols-[2fr_1fr_1fr]">
        <Field label="Title">{(id) => <Input id={id} variant="field" value={d.title} maxLength={120} placeholder="Brand defense on competitor surge" onChange={(e) => set("title", e.target.value)} />}</Field>
        <Field label="Campaign type">
          {(id) => (
            <Select id={id} value={d.type} onChange={(e) => set("type", e.target.value as IdeaType)}>
              {IDEA_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={`Daily budget (${currency})`}>
          {(id) => <Input id={id} variant="field" type="number" min={0} step={5} defaultValue={d.dailyBudget} onChange={(e) => Number.isFinite(e.target.valueAsNumber) && set("dailyBudget", e.target.valueAsNumber)} />}
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 wide:grid-cols-2">
        <Field label="Audience">{(id) => <Input id={id} variant="field" value={d.audience} maxLength={200} onChange={(e) => set("audience", e.target.value)} />}</Field>
        <Field label="Keyword themes" hint="Comma-separated · each becomes an ad group">
          {(id) => <Input id={id} variant="field" defaultValue={d.keywords.join(", ")} placeholder="wide fit running shoes, trail shoes women" onChange={(e) => set("keywords", splitList(e.target.value, 10, 80))} />}
        </Field>
      </div>
      <Field label="Rationale">{(id) => <Textarea id={id} value={d.rationale} maxLength={500} rows={3} onChange={(e) => set("rationale", e.target.value)} />}</Field>
      <Field label="Final URL" hint="Optional — used for ads and sitelinks in the Editor CSV">
        {(id) => <Input id={id} variant="field" type="url" value={session.finalUrl} maxLength={300} placeholder="https://www.example.com/landing-page" onChange={(e) => onFinalUrl(e.target.value)} />}
      </Field>
      {problems.length ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {problems.map((p) => (
            <li key={p} className="text-xs text-warn">
              ▲ {p}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="brand" onClick={onGenerate} loading={pending} disabled={!!problems.length && !d.title.trim()}>
          {pending ? "Building…" : has ? "Regenerate blueprint" : "Generate blueprint"}
        </Button>
        {has ? (
          <Button variant="outline" onClick={onContinue}>
            Continue editing →
          </Button>
        ) : null}
        <span className="text-xs text-muted-3">Nothing is created in Google Ads — the result is an editable draft and an Editor CSV.</span>
      </div>
    </Card>
  );
}
