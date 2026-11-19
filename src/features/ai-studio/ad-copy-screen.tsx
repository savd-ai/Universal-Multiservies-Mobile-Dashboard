"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Segmented } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/inputs";
import { Card, CardHeader } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useGenerateAdCopy } from "@/lib/api/ai";
import { useSettings } from "@/lib/api/hooks";
import { AD_TEXT_LIMITS, RSA_COUNTS, type AdTextCheck } from "@/lib/domain/ai/ads-text";
import {
  addLine,
  adCopyRequestFrom,
  copyChecks,
  copyFromResult,
  EMPTY_FORM,
  formatCopyText,
  formIssues,
  mergeCopy,
  PIN_POSITIONS,
  pinNotes,
  previewOrder,
  TONES,
  type AdCopyForm,
  type CopyLine,
  type CopyState,
  type Tone,
} from "./ad-copy-model";
import { modelLabel } from "./ideas-model";
import { AdPreview, AiSourceLine, TextLineRow, useCampaignIndex } from "./shared";
import { useStudio, type AdCopySession } from "./studio-store";

// 05 · AI studio — Ad copy. Brief (product, keywords, USPs, tone, landing URL) → RSA headlines and descriptions
// with Google Ads counters and policy checks per line. Lines are editable; pin a position, lock lines you like and
// regenerate the rest.

const EMPTY: AdCopySession = { form: EMPTY_FORM, copy: null, meta: null, gen: 0 };
const TONE_LABEL: Record<Tone, string> = { confident: "Confident", friendly: "Friendly", premium: "Premium", urgent: "Urgent" };

type ListKey = "headlines" | "descriptions";

export function AdCopyScreen() {
  const settings = useSettings();
  const brandTerms = settings.data?.brandTerms;
  const campaigns = useCampaignIndex();
  const session = useStudio((s) => s.adCopy) ?? EMPTY;
  const setSession = useStudio((s) => s.setAdCopy);
  const update = (fn: (s: AdCopySession) => AdCopySession) => setSession(fn(useStudio.getState().adCopy ?? EMPTY));
  const setForm = <K extends keyof AdCopyForm>(k: K, v: AdCopyForm[K]) => update((s) => ({ ...s, form: { ...s.form, [k]: v } }));
  const setCopy = (fn: (c: CopyState) => CopyState) => update((s) => (s.copy ? { ...s, copy: fn(s.copy) } : s));
  const gen = useGenerateAdCopy();
  const lint = useMemo(() => ({ allowCaps: brandTerms ?? [] }), [brandTerms]);
  const copy = session.copy;
  const checks = useMemo(() => (copy ? copyChecks(copy, lint) : {}), [copy, lint]);
  const problems = formIssues(session.form);

  const run = async (mode: "all" | "unlocked") => {
    if (gen.isPending || problems.length) return;
    try {
      const res = await gen.mutateAsync(adCopyRequestFrom(useStudio.getState().adCopy?.form ?? session.form));
      const meta = { source: res.source, model: res.model, fallbackReason: res.fallbackReason, warnings: res.warnings ?? [] };
      update((s) => {
        const g = s.gen + 1;
        const fresh = copyFromResult(res, g);
        return { ...s, gen: g, meta, copy: mode === "unlocked" && s.copy ? mergeCopy(s.copy, fresh) : fresh };
      });
      toast(mode === "unlocked" ? "Unlocked lines regenerated" : res.source === "demo" ? "Ad copy ready — demo engine" : `Ad copy written by ${modelLabel(res.source, res.model)}`);
    } catch (e) {
      toast((e as Error).message || "Couldn't generate ad copy", { tone: "crit" });
    }
  };

  const copyAll = () => {
    if (!copy) return;
    void navigator.clipboard
      .writeText(formatCopyText(copy))
      .then(() => toast("Ad copy copied"))
      .catch(() => toast("Couldn't copy to the clipboard", { tone: "crit" }));
  };

  const failing = Object.values(checks).filter((c) => !c.ok).length;
  const locked = copy ? [...copy.headlines, ...copy.descriptions].filter((l) => l.locked).length + (copy.pathsLocked ? 1 : 0) : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader />
      <Card accent flat className="flex flex-col gap-4">
        <CardHeader title="Brief" sub="What the ads should sell, to whom, in which voice" />
        <div className="grid grid-cols-1 gap-4 wide:grid-cols-2">
          <Field label="Product or offer">{(id) => <Input id={id} variant="field" value={session.form.product} maxLength={200} placeholder="Waterproof trail running shoes" onChange={(e) => setForm("product", e.target.value)} />}</Field>
          <Field label="Audience" hint="Optional">
            {(id) => <Input id={id} variant="field" value={session.form.audience} maxLength={200} placeholder="Trail runners who race in wet conditions" onChange={(e) => setForm("audience", e.target.value)} />}
          </Field>
          <Field label="Keywords" hint="Comma-separated · up to 20">
            {(id) => <Input id={id} variant="field" value={session.form.keywords} placeholder="trail running shoes, waterproof trail shoes" onChange={(e) => setForm("keywords", e.target.value)} />}
          </Field>
          <Field label="Selling points" hint="Comma or line separated · up to 10">
            {(id) => <Textarea id={id} rows={2} value={session.form.usps} placeholder="Free returns, Vibram soles, 2-year warranty" onChange={(e) => setForm("usps", e.target.value)} className="min-h-[42px]" />}
          </Field>
          <Field label="Landing page URL" hint="Optional — shown in the preview">
            {(id) => <Input id={id} variant="field" type="url" value={session.form.finalUrl} maxLength={300} placeholder="https://www.example.com/trail" onChange={(e) => setForm("finalUrl", e.target.value)} />}
          </Field>
          <Field label="Ground in a campaign" hint="Optional — uses its search terms and performance">
            {(id) => (
              <Select id={id} value={session.form.campaignId} onChange={(e) => setForm("campaignId", e.target.value)}>
                <option value="">No campaign</option>
                {campaigns.list.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2.5">
            <span className="label-mono">Tone</span>
            <Segmented options={TONES.map((t) => ({ value: t, label: TONE_LABEL[t] }))} value={session.form.tone} onChange={(t) => setForm("tone", t)} ariaLabel="Tone" variant="sans" size="md" className="bg-transparent" />
          </div>
          <span className="flex-1" />
          {problems.length ? <span className="text-xs text-muted-3">{problems[0]}</span> : null}
          {copy ? (
            <Button variant="ghost" onClick={() => void run("all")} disabled={gen.isPending || !!problems.length}>
              Start over
            </Button>
          ) : null}
          <Button variant="brand" onClick={() => void run(copy ? "unlocked" : "all")} loading={gen.isPending} disabled={!!problems.length}>
            {gen.isPending ? "Writing…" : copy ? (locked ? `Regenerate unlocked` : "Regenerate") : "Generate ad copy"}
          </Button>
        </div>
      </Card>

      {!copy ? (
        gen.isPending ? (
          <div className="grid grid-cols-1 gap-4 wide:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" aria-busy="true">
            <div className="h-[420px] animate-shimmer rounded-card border border-tone/8 bg-card" />
            <div className="h-[420px] animate-shimmer rounded-card border border-tone/8 bg-card" />
          </div>
        ) : (
          <EmptyState>{`Describe the offer and generate up to ${RSA_COUNTS.headlines.max} headlines (≤ ${AD_TEXT_LIMITS.headline} characters) and ${RSA_COUNTS.descriptions.max} descriptions (≤ ${AD_TEXT_LIMITS.description}), each checked against Google Ads limits.`}</EmptyState>
        )
      ) : (
        <>
          <AiSourceLine source={session.meta?.source} model={session.meta?.model} fallbackReason={session.meta?.fallbackReason} warnings={session.meta?.warnings} demoLabel="Demo copy · deterministic templates" aiLabel="Written by">
            <span className={cn("font-mono text-meta tracking-label uppercase", failing ? "text-crit" : "text-accent")}>{failing ? `· ▲ ${failing} line${failing === 1 ? "" : "s"} to fix` : "· all lines pass"}</span>
            {locked ? <span className="font-mono text-meta tracking-label text-faint uppercase">{`· ${locked} locked`}</span> : null}
            <span className="flex-1" />
            <Button variant="outline" size="xs" onClick={copyAll}>
              Copy all
            </Button>
          </AiSourceLine>
          {pinNotes(copy).map((n) => (
            <span key={n} className="-mt-3 text-xs text-muted-3">
              {n}
            </span>
          ))}
          <div className="grid grid-cols-1 items-start gap-4 wide:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <LinesCard list="headlines" title="Headlines" copy={copy} checks={checks} onChange={setCopy} gen={session.gen} />
            <div className="flex flex-col gap-4">
              <LinesCard list="descriptions" title="Descriptions" copy={copy} checks={checks} onChange={setCopy} gen={session.gen} />
              <Card className="flex flex-col gap-3">
                <CardHeader
                  title="Display paths"
                  sub={`≤ ${AD_TEXT_LIMITS.path} characters each`}
                  action={<LockToggle locked={copy.pathsLocked} onToggle={() => setCopy((c) => ({ ...c, pathsLocked: !c.pathsLocked }))} label="paths" />}
                />
                {(["path1", "path2"] as const).map((p, k) => (
                  <TextLineRow key={p} label={`/${k + 1}`} ariaLabel={`Path ${k + 1}`} value={copy[p]} limit={AD_TEXT_LIMITS.path} check={checks[`p${k + 1}`]} placeholder="optional" showOk onChange={(v) => setCopy((c) => ({ ...c, [p]: v }))} />
                ))}
              </Card>
              <AdPreview headlines={previewOrder(copy.headlines, 3)} descriptions={previewOrder(copy.descriptions, 2)} path1={copy.path1} path2={copy.path2} finalUrl={session.form.finalUrl} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LockToggle({ locked, onToggle, label }: { locked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={locked}
      aria-label={locked ? `Unlock ${label}` : `Lock ${label}`}
      title={locked ? "Locked — kept when you regenerate" : "Lock to keep when you regenerate"}
      onClick={onToggle}
      className={cn("shrink-0 rounded-pill border px-2 py-0.5 font-mono text-micro tracking-label uppercase transition-colors", locked ? "border-accent bg-teal-t text-accent" : "border-line text-faint hover:border-tone/30 hover:text-fg")}
    >
      {locked ? "Locked" : "Lock"}
    </button>
  );
}

function LinesCard({ list, title, copy, checks, onChange, gen }: { list: ListKey; title: string; copy: CopyState; checks: Record<string, AdTextCheck>; onChange: (fn: (c: CopyState) => CopyState) => void; gen: number }) {
  const lines = copy[list];
  const counts = RSA_COUNTS[list];
  const limit = list === "headlines" ? AD_TEXT_LIMITS.headline : AD_TEXT_LIMITS.description;
  const prefix = list === "headlines" ? "h" : "d";
  const pins = PIN_POSITIONS[list];
  const edit = (i: number, patch: Partial<CopyLine>) => onChange((c) => ({ ...c, [list]: c[list].map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader
        title={title}
        sub={`${lines.length} / ${counts.max} · ≤ ${limit} characters`}
        action={
          <Button variant="link" className="text-xs disabled:opacity-40" disabled={lines.length >= counts.max} onClick={() => onChange((c) => ({ ...c, [list]: addLine(c[list], counts.max, `g${gen}${prefix}n${c[list].length}-${Date.now().toString(36)}`) }))}>
            + Add
          </Button>
        }
      />
      {lines.map((l, i) => (
        <TextLineRow
          key={l.key}
          label={`${prefix.toUpperCase()}${i + 1}`}
          ariaLabel={`${title.slice(0, -1)} ${i + 1}`}
          value={l.text}
          limit={limit}
          check={checks[`${prefix}${i}`]}
          showOk
          dimmed={l.locked}
          onChange={(v) => edit(i, { text: v })}
          onRemove={() => onChange((c) => ({ ...c, [list]: c[list].filter((_, j) => j !== i) }))}
          canRemove={lines.length > counts.min}
          meta={l.angle ? <span className="hidden font-mono text-micro tracking-label text-faint uppercase sm:inline">{l.angle}</span> : null}
          aside={
            <>
              <Select
                aria-label={`Pin ${title.slice(0, -1).toLowerCase()} ${i + 1}`}
                value={l.pin ?? ""}
                onChange={(e) => edit(i, { pin: e.target.value ? Number(e.target.value) : null })}
                className="rounded-[8px] bg-transparent px-1.5 py-0.5 font-mono text-micro text-muted"
              >
                <option value="">No pin</option>
                {pins.map((p) => (
                  <option key={p} value={p}>{`Pin ${p}`}</option>
                ))}
              </Select>
              <LockToggle locked={l.locked} onToggle={() => edit(i, { locked: !l.locked })} label={`${title.slice(0, -1).toLowerCase()} ${i + 1}`} />
            </>
          }
        />
      ))}
    </Card>
  );
}
