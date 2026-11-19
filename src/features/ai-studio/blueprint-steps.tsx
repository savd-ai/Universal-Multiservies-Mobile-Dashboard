"use client";

import { useMemo, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Checkbox } from "@/components/ui/controls";
import { Field, Input, Select } from "@/components/ui/inputs";
import { READ_ONLY_COPY } from "@/components/ui/live-guard";
import { Pill } from "@/components/ui/status";
import { Card, CardHeader } from "@/components/ui/surfaces";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { saveBlob } from "@/lib/api/client";
import { AD_TEXT_LIMITS, type AdTextCheck } from "@/lib/domain/ai/ads-text";
import { blueprintToEditorCsv } from "@/lib/domain/ai/editor-csv";
import type { Blueprint } from "@/lib/domain/contracts/ai";
import { formatMoney } from "@/lib/domain/metrics/registry";
import {
  addAdGroup,
  addRsaLine,
  BIDDING_LABELS,
  canAddLine,
  canRemoveLine,
  csvFilename,
  DAYS_PER_MONTH,
  editRsaLine,
  IDEA_TYPE_OPTIONS,
  keywordIssues,
  LIMITS,
  MATCH_TYPES,
  removeAdGroup,
  removeAt,
  removeRsaLine,
  replaceAt,
  setPath,
  splitList,
  updateGroup,
  type BlueprintIssue,
  type IdeaType,
  type Keyword,
  type MatchType,
  type RsaList,
  type Section,
  type Step,
} from "./blueprint-model";
import { AdPreview, IssueList, TextLineRow } from "./shared";

// Steps 2–4 of the blueprint wizard. Every field edits the client-side draft; each step can regenerate its own
// section. Line counters use the API's validator; the Editor CSV is built from the edited draft (all Paused).

export interface StepProps {
  bp: Blueprint;
  onChange: (fn: (bp: Blueprint) => Blueprint) => void;
  onRegenerate: (section: Section) => void;
  regenerating: boolean;
  /** bumps on every (re)generation so uncontrolled inputs pick up fresh values */
  rev: number;
}

function RegenButton({ section, label, onRegenerate, regenerating }: { section: Section; label: string } & Pick<StepProps, "onRegenerate" | "regenerating">) {
  return (
    <Button variant="ghost" size="xs" onClick={() => onRegenerate(section)} loading={regenerating} title="Replace this section with a fresh generation; other edits are kept">
      ↻ {label}
    </Button>
  );
}

const addBtn = "rounded-mini border border-dashed border-tone/14 p-3 text-center text-xs text-muted-3 transition-colors hover:border-teal/40 hover:text-accent disabled:pointer-events-none disabled:opacity-40";

// ── Structure ────────────────────────────────────────────────────────────────────────────────────────

function KeywordList({ label, items, max, onChange }: { label: string; items: Keyword[]; max: number; onChange: (next: Keyword[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="label-mono">{`${label} · ${items.length}`}</span>
        <Button variant="link" className="text-xs disabled:opacity-40" disabled={items.length >= max} onClick={() => onChange([...items, { text: "", matchType: "Phrase" }])}>
          + Add
        </Button>
      </div>
      {items.map((k, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Input variant="field" value={k.text} aria-label={`${label} ${i + 1}`} placeholder="keyword text" onChange={(e) => onChange(replaceAt(items, i, { ...k, text: e.target.value }))} className="min-w-0 flex-1 py-2" />
            <Select value={k.matchType} aria-label={`${label} ${i + 1} match type`} onChange={(e) => onChange(replaceAt(items, i, { ...k, matchType: e.target.value as MatchType }))} className="w-[96px] py-2">
              {MATCH_TYPES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
            <IconButton label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(removeAt(items, i))}>
              ×
            </IconButton>
          </div>
          <IssueList issues={k.text.trim() ? keywordIssues(k.text) : []} className="pl-1" />
        </div>
      ))}
      {!items.length ? <span className="text-xs text-muted-3">None yet.</span> : null}
    </div>
  );
}

export function StructureStep({ bp, onChange, onRegenerate, regenerating }: StepProps) {
  const group = bp.type === "Search" ? "Ad group" : "Asset group";
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <CardHeader title="Campaign" sub="Name, type and objective" action={<RegenButton section="structure" label="Regenerate structure" onRegenerate={onRegenerate} regenerating={regenerating} />} />
        <div className="grid grid-cols-1 gap-4 wide:grid-cols-[2fr_1fr_2fr]">
          <Field label="Campaign name">{(id) => <Input id={id} variant="field" value={bp.campaignName} maxLength={120} onChange={(e) => onChange((b) => ({ ...b, campaignName: e.target.value }))} />}</Field>
          <Field label="Type">
            {(id) => (
              <Select id={id} value={bp.type} onChange={(e) => onChange((b) => ({ ...b, type: e.target.value as IdeaType }))}>
                {IDEA_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Objective">{(id) => <Input id={id} variant="field" value={bp.objective} maxLength={200} onChange={(e) => onChange((b) => ({ ...b, objective: e.target.value }))} />}</Field>
        </div>
      </Card>

      {bp.adGroups.map((g, gi) => (
        <Card key={gi} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <span className="pb-2.5 font-mono text-meta text-accent">{String(gi + 1).padStart(2, "0")}</span>
            <Field label={`${group} name`} className="min-w-[200px] flex-1">
              {(id) => <Input id={id} variant="field" value={g.name} maxLength={120} onChange={(e) => onChange((b) => updateGroup(b, gi, (x) => ({ ...x, name: e.target.value })))} />}
            </Field>
            <Field label="Theme" className="min-w-[220px] flex-[2]">
              {(id) => <Input id={id} variant="field" value={g.theme} maxLength={160} onChange={(e) => onChange((b) => updateGroup(b, gi, (x) => ({ ...x, theme: e.target.value })))} />}
            </Field>
            <Button variant="ghost" size="xs" className="mb-1.5" disabled={bp.adGroups.length <= 1} onClick={() => onChange((b) => removeAdGroup(b, gi))}>
              Remove
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-5 wide:grid-cols-2">
            <KeywordList label="Keywords" items={g.keywords} max={LIMITS.keywords} onChange={(k) => onChange((b) => updateGroup(b, gi, (x) => ({ ...x, keywords: k })))} />
            <KeywordList label="Negatives" items={g.negatives} max={LIMITS.negatives} onChange={(k) => onChange((b) => updateGroup(b, gi, (x) => ({ ...x, negatives: k })))} />
          </div>
        </Card>
      ))}
      <button type="button" className={addBtn} disabled={bp.adGroups.length >= LIMITS.adGroups} onClick={() => onChange(addAdGroup)}>
        {`+ Add ${group.toLowerCase()}`}
      </button>

      <Card className="flex flex-col gap-4">
        <CardHeader title="Campaign negatives" sub="Excluded from every ad group" />
        <KeywordList label="Negatives" items={bp.campaignNegatives} max={LIMITS.negatives} onChange={(k) => onChange((b) => ({ ...b, campaignNegatives: k }))} />
      </Card>
    </div>
  );
}

// ── Ads ──────────────────────────────────────────────────────────────────────────────────────────────

function LineList({ title, lines, list, gi, checks, onChange, bp }: { title: string; lines: string[]; list: RsaList; gi: number; checks: Record<string, AdTextCheck>; bp: Blueprint; onChange: StepProps["onChange"] }) {
  const lim = LIMITS[list];
  const short = list === "headlines" ? "H" : "D";
  const limit = list === "headlines" ? AD_TEXT_LIMITS.headline : AD_TEXT_LIMITS.description;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="label-mono">{`${title} · ${lines.length} / ${lim.max} · ≤ ${limit} characters`}</span>
        <Button variant="link" className="text-xs disabled:opacity-40" disabled={!canAddLine(bp, gi, list)} onClick={() => onChange((b) => addRsaLine(b, gi, list))}>
          + Add
        </Button>
      </div>
      {lines.map((t, j) => (
        <TextLineRow
          key={j}
          label={`${short}${j + 1}`}
          ariaLabel={`${title.slice(0, -1)} ${j + 1}`}
          value={t}
          limit={limit}
          check={checks[`ag${gi}.${short.toLowerCase()}${j}`]}
          onChange={(v) => onChange((b) => editRsaLine(b, gi, list, j, v))}
          onRemove={() => onChange((b) => removeRsaLine(b, gi, list, j))}
          canRemove={canRemoveLine(bp, gi, list)}
        />
      ))}
    </div>
  );
}

export function AdsStep({ bp, onChange, onRegenerate, regenerating, checks, finalUrl }: StepProps & { checks: Record<string, AdTextCheck>; finalUrl: string }) {
  const [sel, setSel] = useState(0);
  const gi = Math.min(sel, bp.adGroups.length - 1);
  const g = bp.adGroups[gi];
  const groupWord = bp.type === "Search" ? "ad group" : "asset group";
  const failing = (i: number) => Object.entries(checks).filter(([id, c]) => id.startsWith(`ag${i}.`) && !c.ok).length;
  if (!g) return null;
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <CardHeader
          title={bp.type === "Search" ? "Responsive search ads" : "Asset group text"}
          sub={`${bp.adGroups.length} ${groupWord}${bp.adGroups.length === 1 ? "" : "s"} · ${LIMITS.headlines.min}–${LIMITS.headlines.max} headlines · ${LIMITS.descriptions.min}–${LIMITS.descriptions.max} descriptions`}
          action={<RegenButton section="ads" label="Regenerate ads" onRegenerate={onRegenerate} regenerating={regenerating} />}
        />
        {bp.adGroups.length > 1 ? (
          <Tabs
            value={String(gi)}
            onChange={(v) => setSel(Number(v))}
            tabs={bp.adGroups.map((x, i) => ({
              value: String(i),
              label: (
                <span className="flex items-center gap-1.5">
                  {x.name || `Ad group ${i + 1}`}
                  {failing(i) ? <span className="font-mono text-micro text-crit">{`▲ ${failing(i)}`}</span> : null}
                </span>
              ),
            }))}
          />
        ) : null}
        <div className="grid grid-cols-1 gap-5 wide:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <LineList title="Headlines" lines={g.rsa.headlines} list="headlines" gi={gi} checks={checks} bp={bp} onChange={onChange} />
          <div className="flex flex-col gap-5">
            <LineList title="Descriptions" lines={g.rsa.descriptions} list="descriptions" gi={gi} checks={checks} bp={bp} onChange={onChange} />
            <div className="flex flex-col gap-2">
              <span className="label-mono">{`Display paths · ≤ ${AD_TEXT_LIMITS.path} characters`}</span>
              {(["path1", "path2"] as const).map((p, k) => (
                <TextLineRow key={p} label={`/${k + 1}`} ariaLabel={`Path ${k + 1}`} value={g.rsa[p] ?? ""} limit={AD_TEXT_LIMITS.path} check={checks[`ag${gi}.p${k + 1}`]} placeholder="optional" onChange={(v) => onChange((b) => setPath(b, gi, p, v))} />
              ))}
            </div>
            <AdPreview headlines={g.rsa.headlines} descriptions={g.rsa.descriptions} path1={g.rsa.path1} path2={g.rsa.path2} finalUrl={finalUrl} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 wide:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <CardHeader title="Sitelinks" sub={`${bp.sitelinks.length} / ${LIMITS.sitelinks} · text ≤ ${AD_TEXT_LIMITS.sitelinkText} · lines ≤ ${AD_TEXT_LIMITS.sitelinkLine}`} />
          {bp.sitelinks.map((s, i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded-mini border border-line-soft p-2">
              <TextLineRow
                label={`S${i + 1}`}
                ariaLabel={`Sitelink ${i + 1} text`}
                value={s.text}
                limit={AD_TEXT_LIMITS.sitelinkText}
                check={checks[`sl${i}.t`]}
                onChange={(v) => onChange((b) => ({ ...b, sitelinks: replaceAt(b.sitelinks, i, { ...s, text: v }) }))}
                onRemove={() => onChange((b) => ({ ...b, sitelinks: removeAt(b.sitelinks, i) }))}
              />
              {(["line1", "line2"] as const).map((l, k) => (
                <TextLineRow
                  key={l}
                  label={`L${k + 1}`}
                  ariaLabel={`Sitelink ${i + 1} line ${k + 1}`}
                  value={s[l] ?? ""}
                  limit={AD_TEXT_LIMITS.sitelinkLine}
                  check={checks[`sl${i}.l${k + 1}`]}
                  placeholder="optional"
                  onChange={(v) => onChange((b) => ({ ...b, sitelinks: replaceAt(b.sitelinks, i, { ...s, [l]: v === "" ? null : v }) }))}
                />
              ))}
            </div>
          ))}
          <button type="button" className={addBtn} disabled={bp.sitelinks.length >= LIMITS.sitelinks} onClick={() => onChange((b) => ({ ...b, sitelinks: [...b.sitelinks, { text: "", line1: null, line2: null }] }))}>
            + Add sitelink
          </button>
        </Card>
        <Card className="flex flex-col gap-3">
          <CardHeader title="Callouts" sub={`${bp.callouts.length} / ${LIMITS.callouts} · ≤ ${AD_TEXT_LIMITS.callout} characters`} />
          {bp.callouts.map((c, i) => (
            <TextLineRow
              key={i}
              label={`C${i + 1}`}
              ariaLabel={`Callout ${i + 1}`}
              value={c}
              limit={AD_TEXT_LIMITS.callout}
              check={checks[`co${i}`]}
              onChange={(v) => onChange((b) => ({ ...b, callouts: replaceAt(b.callouts, i, v) }))}
              onRemove={() => onChange((b) => ({ ...b, callouts: removeAt(b.callouts, i) }))}
            />
          ))}
          <button type="button" className={addBtn} disabled={bp.callouts.length >= LIMITS.callouts} onClick={() => onChange((b) => ({ ...b, callouts: [...b.callouts, ""] }))}>
            + Add callout
          </button>
        </Card>
      </div>
    </div>
  );
}

// ── Review ───────────────────────────────────────────────────────────────────────────────────────────

/** Comma-separated list, uncontrolled while typing (so ", " can be typed); `rev` resyncs after regeneration. */
function ListInput({ id, value, onChange, placeholder }: { id: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return <Input id={id} variant="field" defaultValue={value.join(", ")} placeholder={placeholder} onChange={(e) => onChange(splitList(e.target.value, 20, 120))} />;
}

function NumberInput({ id, value, onChange, step = 1, min = 0 }: { id: string; value: number | null; onChange: (v: number | null) => void; step?: number; min?: number }) {
  return (
    <Input
      id={id}
      variant="field"
      type="number"
      inputMode="decimal"
      min={min}
      step={step}
      defaultValue={value ?? ""}
      onChange={(e) => {
        if (e.target.value === "") onChange(null);
        else if (Number.isFinite(e.target.valueAsNumber)) onChange(e.target.valueAsNumber);
      }}
    />
  );
}

interface ReviewProps extends StepProps {
  issues: BlueprintIssue[];
  currency: string;
  finalUrl: string;
  onFinalUrl: (v: string) => void;
  checked: Record<number, boolean>;
  onChecked: (i: number, v: boolean) => void;
  onJump: (step: Step) => void;
}

const STEP_NAME: Record<number, string> = { 2: "Structure", 3: "Ads", 4: "Review" };

export function ReviewStep({ bp, onChange, onRegenerate, regenerating, rev, issues, currency, finalUrl, onFinalUrl, checked, onChecked, onJump }: ReviewProps) {
  const csv = useMemo(() => blueprintToEditorCsv(bp, { finalUrl }), [bp, finalUrl]);
  const money = (v: number) => formatMoney(v, { currency });
  const s = bp.bidding.strategy;
  const done = bp.launchChecklist.filter((_, i) => checked[i]).length;

  const download = () => {
    saveBlob(new Blob([csv.csv], { type: "text/csv;charset=utf-8" }), csvFilename(bp.campaignName));
    toast(`Editor CSV downloaded — ${csv.rows} rows, all Paused`);
  };
  const copyJson = () =>
    void navigator.clipboard
      .writeText(JSON.stringify(bp, null, 2))
      .then(() => toast("Blueprint JSON copied"))
      .catch(() => toast("Couldn't copy to the clipboard", { tone: "crit" }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 wide:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <CardHeader title="Bidding & budget" sub="Bid strategy and daily budget" action={<RegenButton section="review" label="Regenerate settings" onRegenerate={onRegenerate} regenerating={regenerating} />} />
          <Field label="Bid strategy">
            {(id) => (
              <Select
                id={id}
                value={s}
                onChange={(e) => {
                  const strategy = e.target.value as Blueprint["bidding"]["strategy"];
                  onChange((b) => ({ ...b, bidding: { strategy, targetCpa: strategy === "TARGET_CPA" ? b.bidding.targetCpa : null, targetRoas: strategy === "TARGET_ROAS" ? b.bidding.targetRoas : null } }));
                }}
              >
                {Object.entries(BIDDING_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {s === "TARGET_CPA" ? (
            <Field label={`Target CPA (${currency})`} key={`cpa-${rev}`}>
              {(id) => <NumberInput id={id} value={bp.bidding.targetCpa} step={0.5} onChange={(v) => onChange((b) => ({ ...b, bidding: { ...b.bidding, targetCpa: v } }))} />}
            </Field>
          ) : null}
          {s === "TARGET_ROAS" ? (
            <Field label="Target ROAS (e.g. 4 = 400%)" key={`roas-${rev}`}>
              {(id) => <NumberInput id={id} value={bp.bidding.targetRoas} step={0.1} onChange={(v) => onChange((b) => ({ ...b, bidding: { ...b.bidding, targetRoas: v } }))} />}
            </Field>
          ) : null}
          <Field label={`Daily budget (${currency})`} hint={`≈ ${money(bp.dailyBudget * DAYS_PER_MONTH)} / month`} key={`budget-${rev}`}>
            {(id) => <NumberInput id={id} value={bp.dailyBudget} step={5} onChange={(v) => onChange((b) => ({ ...b, dailyBudget: v ?? 0 }))} />}
          </Field>
        </Card>
        <Card className="flex flex-col gap-4" key={`targeting-${rev}`}>
          <CardHeader title="Targeting" sub="Comma-separated lists" />
          <Field label="Locations">{(id) => <ListInput id={id} value={bp.targeting.locations} placeholder="United States" onChange={(v) => onChange((b) => ({ ...b, targeting: { ...b.targeting, locations: v } }))} />}</Field>
          <Field label="Languages">{(id) => <ListInput id={id} value={bp.targeting.languages} placeholder="English" onChange={(v) => onChange((b) => ({ ...b, targeting: { ...b.targeting, languages: v } }))} />}</Field>
          <Field label="Audiences">{(id) => <ListInput id={id} value={bp.targeting.audiences} onChange={(v) => onChange((b) => ({ ...b, targeting: { ...b.targeting, audiences: v } }))} />}</Field>
          <Field label="Devices" hint="Empty = all devices">
            {(id) => <ListInput id={id} value={bp.targeting.devices ?? []} placeholder="All devices" onChange={(v) => onChange((b) => ({ ...b, targeting: { ...b.targeting, devices: v.length ? v : null } }))} />}
          </Field>
          <Field label="Ad schedule" hint="Empty = all day, every day">
            {(id) => <Input id={id} variant="field" defaultValue={bp.targeting.adSchedule ?? ""} placeholder="All day" onChange={(e) => onChange((b) => ({ ...b, targeting: { ...b.targeting, adSchedule: e.target.value.trim() ? e.target.value : null } }))} />}
          </Field>
        </Card>
      </div>

      <Card className="flex flex-col gap-3">
        <CardHeader title="Launch checklist" sub={`${done} of ${bp.launchChecklist.length} done · for your own tracking`} />
        {bp.launchChecklist.map((item, i) => (
          <label key={i} className="flex cursor-pointer items-start gap-3 text-[13px] leading-normal">
            <Checkbox checked={!!checked[i]} onChange={(v) => onChecked(i, v)} ariaLabel={item} className="mt-0.5" />
            <span className={cn(checked[i] ? "text-muted-3 line-through" : "text-fg")}>{item}</span>
          </label>
        ))}
      </Card>

      <Card accent className="flex flex-col gap-4">
        <CardHeader title="Export" sub="Google Ads Editor · every row Paused" />
        {issues.length ? (
          <div className="flex flex-col gap-2" role="list" aria-label="Issues to fix">
            <span className="label-mono text-crit">{`${issues.length} issue${issues.length === 1 ? "" : "s"} to fix before importing`}</span>
            {issues.slice(0, 12).map((it, i) => (
              <div key={i} role="listitem" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                <span className="text-crit">▲</span>
                <span className="min-w-0 flex-1 text-muted">{it.text}</span>
                <Button variant="link" className="text-xs" onClick={() => onJump(it.step)}>
                  {`Fix in ${STEP_NAME[it.step]} →`}
                </Button>
              </div>
            ))}
            {issues.length > 12 ? <span className="text-xs text-muted-3">{`…and ${issues.length - 12} more.`}</span> : null}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[13px] text-accent">
            <Pill tone="accent">Ready</Pill>
            <span className="text-muted">Every line passes the Google Ads length and editorial checks.</span>
          </div>
        )}
        <Field label="Final URL" hint="Used for every ad and sitelink in the CSV">
          {(id) => <Input id={id} variant="field" type="url" value={finalUrl} placeholder="https://www.example.com/landing-page" maxLength={300} onChange={(e) => onFinalUrl(e.target.value)} />}
        </Field>
        {csv.warnings.length ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {csv.warnings.map((w) => (
              <li key={w} className="text-xs text-warn">
                ▲ {w}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="brand" onClick={download}>
            Download Google Ads Editor CSV
          </Button>
          <Button variant="outline" onClick={copyJson}>
            Copy JSON
          </Button>
          <span className="font-mono text-micro tracking-label text-faint uppercase">{`${csv.rows} rows · ${bp.adGroups.length} ${bp.type === "Search" ? "ad" : "asset"} group${bp.adGroups.length === 1 ? "" : "s"}`}</span>
        </div>
        <p className="m-0 text-xs text-muted-3">{`${READ_ONLY_COPY} Import the CSV in Google Ads Editor, review it there, then enable the campaign yourself.`}</p>
      </Card>
    </div>
  );
}
