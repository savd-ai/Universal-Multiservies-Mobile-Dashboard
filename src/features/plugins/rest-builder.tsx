"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Checkbox, Chip } from "@/components/ui/controls";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Textarea } from "@/components/ui/inputs";
import { Modal } from "@/components/ui/overlays";
import { Dot, Pill } from "@/components/ui/status";
import { CodeBlock } from "@/components/ui/surfaces";
import { Tabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { ApiError, saveBlob } from "@/lib/api/client";
import { useImportCustomPlugin, usePreviewManifest, useSaveCustomPlugin, useValidateManifest } from "@/lib/api/plugins-ui";
import type { ManifestIssue, ManifestValidationResult, PluginPreviewResult, SecretDescription } from "@/lib/domain/contracts/plugins";
import { formatShort } from "@/lib/domain/dates";
import { formatMoney, formatNumber } from "@/lib/domain/metrics/registry";
import type { PlatformDailyRow } from "@/lib/domain/schema/facts";
import {
  BUILDER_STEPS,
  exportFile,
  formIssues,
  formSecrets,
  formToManifest,
  issueStep,
  manifestToForm,
  parseManifestText,
  pluginIdFor,
  STEP_LABELS,
  suggestEnvKey,
  type BuilderForm,
  type BuilderStep,
} from "./builder-model";
import { BasicsStep, EndpointStep, MappingStep, type FormPatch } from "./builder-steps";
import { errorMessage } from "./plugin-card";

// The prototype's "Custom plugin" panel grown into a stepped no-code REST builder: Basics · Endpoint · Mapping ·
// Preview & save, with the manifest that gets registered always visible on the right (as in the prototype).
// Validate and "Test & preview rows" hit the server (nothing is stored); Save registers and auto-connects.

export interface BuilderSeed {
  /** "klaviyo" | "blank" | "import" | a plugin id */
  source: string;
  form: BuilderForm;
  secret: string;
  editId: string | null;
  recordVersion?: number;
  savedSecret: SecretDescription | null;
}

interface RestBuilderProps {
  seed: BuilderSeed;
  encryption: boolean;
  step: BuilderStep;
  onStep: (s: BuilderStep) => void;
  /** start over from a preset, a plugin id, or an imported form */
  onStart: (source: string, imported?: BuilderForm) => void;
  onSaved: (id: string) => void;
}

type SaveProblem = { kind: "secrets"; envKey: string; message: string } | { kind: "exists"; id: string; message: string } | { kind: "stale"; message: string } | { kind: "other"; message: string };

const isValidation = (d: unknown): d is ManifestValidationResult => typeof d === "object" && d !== null && Array.isArray((d as ManifestValidationResult).issues);

export function RestBuilder({ seed, encryption, step, onStep, onStart, onSaved }: RestBuilderProps) {
  const [form, setForm] = useState(seed.form);
  const [secret, setSecretValue] = useState(seed.secret);
  const [secretRev, setSecretRev] = useState(0);
  const [editId, setEditId] = useState(seed.editId);
  const [version, setVersion] = useState(seed.recordVersion);
  const [savedSecret, setSavedSecret] = useState(seed.savedSecret);
  const [clearSaved, setClearSaved] = useState(false);
  const [validation, setValidation] = useState<{ key: string; result: ManifestValidationResult } | null>(null);
  const [preview, setPreview] = useState<{ key: string; result: PluginPreviewResult } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [problem, setProblem] = useState<SaveProblem | null>(null);
  const [saved, setSaved] = useState<{ id: string; warnings: string[] } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const validate = useValidateManifest();
  const previewRun = usePreviewManifest();
  const save = useSaveCustomPlugin();

  const update: FormPatch = (fn) => setForm((f) => fn(f));
  const setSecret = (v: string) => {
    setSecretValue(v);
    setSecretRev((r) => r + 1);
  };
  const manifest = useMemo(() => formToManifest(form), [form]);
  const json = useMemo(() => JSON.stringify(manifest, null, 2), [manifest]);
  const secrets = formSecrets(form, secret, { clearSaved });
  const runKey = `${json}|${form.auth.source}|${secretRev}|${clearSaved}`;
  const local = formIssues(form);
  const localErrors = local.filter((i) => i.level === "error");
  const serverIssues = validation && validation.key === runKey ? validation.result.issues : [];
  const stepErrors = (s: BuilderStep) => [...localErrors, ...serverIssues.filter((i) => i.level === "error")].filter((i) => issueStep(i.path) === s).length;
  const pluginId = pluginIdFor(form);
  const sampleItem = Array.isArray(preview?.result.rawSample) ? (preview.result.rawSample as unknown[])[0] : undefined;
  const needsKeyStorage = !encryption && form.auth.type !== "none" && form.auth.source === "value" && !!secret;

  const runValidate = () =>
    validate.mutate(
      { manifest, secrets },
      { onSuccess: (result) => setValidation({ key: runKey, result }), onError: (e) => toast(errorMessage(e), { tone: "crit" }) },
    );

  const runPreview = () => {
    setPreviewError(null);
    previewRun.mutate(
      { manifest, secrets },
      {
        onSuccess: (result) => setPreview({ key: runKey, result }),
        onError: (e) => {
          setPreview(null);
          if (e instanceof ApiError && e.code === "VALIDATION_ERROR" && isValidation(e.details)) {
            setValidation({ key: runKey, result: e.details });
            setPreviewError("Fix the manifest errors below, then run the preview again.");
          } else setPreviewError(errorMessage(e));
        },
      },
    );
  };

  const runSave = (f: BuilderForm = form) => {
    setProblem(null);
    const m = formToManifest(f);
    save.mutate(
      { id: editId, manifest: m, secrets: formSecrets(f, secret, { clearSaved }), version: editId ? version : undefined },
      {
        onSuccess: (res) => {
          const rec = res.plugin;
          const hasSaved = !!rec.secrets.auth?.hasValue;
          setEditId(rec.manifest.id);
          setVersion(rec.recordVersion);
          setSavedSecret(rec.secrets.auth ?? null);
          setClearSaved(false);
          setForm((cur) => ({ ...cur, id: rec.manifest.id, auth: { ...cur.auth, source: cur.auth.source === "value" && hasSaved ? "saved" : cur.auth.source } }));
          if (hasSaved) setSecret("");
          setSaved({ id: rec.manifest.id, warnings: res.warnings });
          toast(res.created ? `${rec.manifest.name} registered and connected` : `${rec.manifest.name} saved`);
          onSaved(rec.manifest.id);
        },
        onError: (e) => {
          if (e instanceof ApiError && e.code === "SECRETS_DISABLED") {
            const envKey = (e.details as { envKey?: string } | undefined)?.envKey ?? suggestEnvKey(pluginId);
            setProblem({ kind: "secrets", envKey, message: e.message });
          } else if (e instanceof ApiError && e.code === "VALIDATION_ERROR" && isValidation(e.details)) {
            setValidation({ key: runKey, result: e.details });
            setProblem({ kind: "other", message: "The server found errors in the manifest — see below." });
          } else if (e instanceof ApiError && e.code === "CONFLICT") {
            setProblem(editId ? { kind: "stale", message: e.message } : { kind: "exists", id: (e.details as { id?: string } | undefined)?.id ?? m.id, message: e.message });
          } else setProblem({ kind: "other", message: errorMessage(e) });
        },
      },
    );
  };

  const switchToEnvAndSave = (envKey: string) => {
    const next: BuilderForm = { ...form, auth: { ...form.auth, source: "env", env: envKey } };
    setForm(next);
    runSave(next);
  };

  const copyManifest = () => void navigator.clipboard.writeText(json).then(() => toast("Manifest copied"), () => toast("Copy failed", { tone: "crit" }));
  const downloadManifest = () => saveBlob(new Blob([JSON.stringify(exportFile(manifest, new Date().toISOString()), null, 2)], { type: "application/json" }), `${manifest.id}.plugin.json`);
  const stepIndex = BUILDER_STEPS.indexOf(step);

  return (
    <section aria-labelledby="builder-title" className="flex flex-col gap-5 rounded-card border border-teal/30 bg-card-accent p-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-[260px] flex-1 flex-col gap-1.5">
          <span className="font-mono text-meta tracking-eyebrow text-accent uppercase">{editId ? `Custom plugin · editing ${editId}` : "Custom plugin"}</span>
          <h2 id="builder-title" className="m-0 font-display text-[22px] font-semibold">
            Bring any service onto the spine
          </h2>
          <p className="m-0 max-w-[62ch] text-[13px] leading-[1.6] text-muted">Describe the endpoint and map its fields to dashboard metrics. The manifest on the right is what gets registered.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Start from">
          <span className="label-mono mr-1">Start from</span>
          <Chip active={seed.source === "klaviyo"} onClick={() => onStart("klaviyo")} title="The prototype's Klaviyo defaults, served by the built-in mock API">
            Klaviyo-style (mock)
          </Chip>
          <Chip active={seed.source === "blank"} onClick={() => onStart("blank")}>
            Blank
          </Chip>
          <Button variant="ghost" size="xs" onClick={() => setImportOpen(true)}>
            Import JSON
          </Button>
        </div>
      </div>

      <Tabs
        value={step}
        onChange={onStep}
        tabs={BUILDER_STEPS.map((s, i) => ({
          value: s,
          label: (
            <span className="flex items-center gap-2">
              <span className="font-mono text-micro text-accent">{String(i + 1).padStart(2, "0")}</span>
              {STEP_LABELS[s]}
              {s !== "preview" && stepErrors(s) > 0 ? <Pill tone="crit" className="px-1.5 py-0 text-[9px]">{stepErrors(s)}</Pill> : null}
            </span>
          ),
        }))}
      />

      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))" }}>
        <div className="flex min-w-0 flex-col gap-5">
          {step === "basics" ? <BasicsStep form={form} update={update} /> : null}
          {step === "endpoint" ? (
            <EndpointStep form={form} update={update} secret={secret} onSecret={setSecret} savedSecret={savedSecret} clearSaved={clearSaved} onClearSaved={setClearSaved} encryption={encryption} />
          ) : null}
          {step === "mapping" ? <MappingStep form={form} update={update} sampleItem={sampleItem} /> : null}
          {step === "preview" ? (
            <PreviewActions
              local={local}
              validation={validation ? { ...validation.result, stale: validation.key !== runKey } : null}
              onIssue={(i) => onStep(issueStep(i.path))}
              validating={validate.isPending}
              previewing={previewRun.isPending}
              saving={save.isPending}
              canSave={localErrors.length === 0}
              editing={!!editId}
              onValidate={runValidate}
              onPreview={runPreview}
              onSave={() => runSave()}
              previewError={previewError}
              problem={problem}
              needsKeyStorage={needsKeyStorage}
              suggestedEnv={suggestEnvKey(pluginId)}
              onUseEnv={switchToEnvAndSave}
              onOpenExisting={(id) => onStart(id)}
              onReload={() => editId && onStart(editId)}
              saved={saved}
            />
          ) : null}
          <div className="mt-auto flex items-center gap-2.5 border-t border-teal/15 pt-4">
            {stepIndex > 0 ? (
              <Button variant="ghost" onClick={() => onStep(BUILDER_STEPS[stepIndex - 1] as BuilderStep)}>
                ← {STEP_LABELS[BUILDER_STEPS[stepIndex - 1] as BuilderStep]}
              </Button>
            ) : null}
            <span className="flex-1" />
            {stepIndex < BUILDER_STEPS.length - 1 ? (
              <Button variant="outline" onClick={() => onStep(BUILDER_STEPS[stepIndex + 1] as BuilderStep)}>
                {STEP_LABELS[BUILDER_STEPS[stepIndex + 1] as BuilderStep]} →
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-mono">Manifest</span>
            <span className="min-w-0 flex-1 truncate font-mono text-meta text-muted-3">{manifest.id}.plugin.json</span>
            <Button variant="ghost" size="xs" onClick={copyManifest}>
              Copy
            </Button>
            <Button variant="ghost" size="xs" onClick={downloadManifest}>
              Download
            </Button>
          </div>
          <CodeBlock className="max-h-[560px] min-h-[240px] flex-1">{json}</CodeBlock>
          <span className="text-xs leading-normal text-muted-3">
            {form.auth.type === "none"
              ? "No credential — requests are sent without auth."
              : form.auth.source === "env"
                ? `Credential read from ${form.auth.env || "a PLUGIN_* variable"} on the server.`
                : form.auth.source === "saved"
                  ? clearSaved
                    ? "The saved credential is removed on save."
                    : "The saved credential stays encrypted on the server (never part of the manifest)."
                  : secret
                    ? `The key travels separately as secrets.${form.auth.type === "basic" ? "password" : form.auth.type === "bearer" ? "token" : "apiKey"} — ${encryption ? "encrypted on save" : "used for preview only"}, never shown again.`
                    : "No key entered yet."}
          </span>
        </div>
      </div>

      {step === "preview" && preview ? <PreviewResults result={preview.result} stale={preview.key !== runKey} /> : null}

      <ImportManifestModal open={importOpen} onOpenChange={setImportOpen} onLoaded={(f) => onStart("import", f)} />
    </section>
  );
}

// ── Preview & save (left column) ─────────────────────────────────────────────────────────────────────

interface PreviewActionsProps {
  local: ManifestIssue[];
  validation: (ManifestValidationResult & { stale: boolean }) | null;
  onIssue: (i: ManifestIssue) => void;
  validating: boolean;
  previewing: boolean;
  saving: boolean;
  canSave: boolean;
  editing: boolean;
  onValidate: () => void;
  onPreview: () => void;
  onSave: () => void;
  previewError: string | null;
  problem: SaveProblem | null;
  needsKeyStorage: boolean;
  suggestedEnv: string;
  onUseEnv: (envKey: string) => void;
  onOpenExisting: (id: string) => void;
  onReload: () => void;
  saved: { id: string; warnings: string[] } | null;
}

function IssueList({ issues, onIssue }: { issues: ManifestIssue[]; onIssue: (i: ManifestIssue) => void }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {issues.map((i, n) => (
        <li key={`${i.path}|${i.message}|${n}`}>
          <button type="button" onClick={() => onIssue(i)} className="flex w-full items-start gap-2.5 rounded-[8px] px-2 py-1.5 text-left text-[13px] leading-normal hover:bg-fill">
            <Dot tone={i.level === "error" ? "crit" : "warn"} size={7} className="mt-1.5" />
            <span className="min-w-0 flex-1">
              <span className={cn("mr-2 font-mono text-micro tracking-label uppercase", i.level === "error" ? "text-crit" : "text-warn")}>{i.level === "error" ? "Error" : "Warning"}</span>
              {i.path ? <span className="mr-2 font-mono text-meta text-muted-3">{i.path}</span> : null}
              <span className="text-muted">{i.message}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Callout({ tone, children }: { tone: "warn" | "crit" | "accent"; children: React.ReactNode }) {
  return (
    <div role={tone === "accent" ? "status" : "alert"} className={cn("flex items-start gap-3 rounded-mini border p-4 text-[13px] leading-normal text-muted", tone === "crit" ? "border-crit/30 bg-crit-t/40" : tone === "warn" ? "border-warn/30 bg-warn-t/40" : "border-teal/30 bg-teal/6")}>
      <Dot tone={tone} className="mt-1.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
    </div>
  );
}

function PreviewActions(p: PreviewActionsProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[13px] leading-[1.6] text-muted">Validate checks the manifest without calling the API. Test &amp; preview fetches the last 7 complete days with your key (never stored) and shows the mapped rows. Save registers the plugin and connects it.</p>
      {p.local.length ? <IssueList issues={p.local} onIssue={p.onIssue} /> : null}
      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="ghost" onClick={p.onValidate} loading={p.validating}>
          Validate
        </Button>
        <Button variant="outline" onClick={p.onPreview} loading={p.previewing} disabled={!p.canSave}>
          Test &amp; preview rows
        </Button>
        <Button variant="brand" onClick={p.onSave} loading={p.saving} disabled={!p.canSave}>
          {p.editing ? "Save changes" : "Save & connect"}
        </Button>
      </div>
      {p.needsKeyStorage ? (
        <Callout tone="warn">
          <span>APP_ENCRYPTION_KEY isn&apos;t set, so the key you typed can be used for the preview but not stored. Reference an environment variable to save.</span>
          <Button variant="link" className="self-start text-xs" onClick={() => p.onUseEnv(p.suggestedEnv)}>
            Use {p.suggestedEnv} and save →
          </Button>
        </Callout>
      ) : null}
      {p.previewError ? <Callout tone="crit">{p.previewError}</Callout> : null}
      {p.problem?.kind === "secrets" ? (
        <Callout tone="warn">
          <span>{p.problem.message}</span>
          <span className="text-xs text-muted-3">
            1 · Add <code className="font-mono text-fg">{p.problem.envKey}=your-key</code> to .env and restart the server, then save with the env reference. 2 · Or run <code className="font-mono text-fg">npm run gen:key</code>, set APP_ENCRYPTION_KEY and restart to store keys from the UI.
          </span>
          <Button variant="link" className="self-start text-xs" onClick={() => p.onUseEnv((p.problem as { envKey: string }).envKey)}>
            Use {p.problem.envKey} and save →
          </Button>
        </Callout>
      ) : null}
      {p.problem?.kind === "exists" ? (
        <Callout tone="warn">
          <span>{p.problem.message}</span>
          <Button variant="link" className="self-start text-xs" onClick={() => p.onOpenExisting((p.problem as { id: string }).id)}>
            Edit the existing plugin →
          </Button>
        </Callout>
      ) : null}
      {p.problem?.kind === "stale" ? (
        <Callout tone="warn">
          <span>{p.problem.message}</span>
          <Button variant="link" className="self-start text-xs" onClick={p.onReload}>
            Reload the latest version →
          </Button>
        </Callout>
      ) : null}
      {p.problem?.kind === "other" ? <Callout tone="crit">{p.problem.message}</Callout> : null}
      {p.validation ? (
        <div className={cn("flex flex-col gap-2", p.validation.stale && "opacity-60")}>
          <div className="flex items-center gap-2">
            <span className="label-mono">Validation</span>
            {p.validation.stale ? <Pill tone="muted">Out of date</Pill> : null}
          </div>
          {p.validation.issues.length ? (
            <IssueList issues={p.validation.issues} onIssue={p.onIssue} />
          ) : (
            <span className="flex items-center gap-2 text-[13px] text-accent">
              <Dot tone="accent" size={7} />✓ The manifest is valid.
            </span>
          )}
        </div>
      ) : null}
      {p.saved ? (
        <Callout tone="accent">
          <span className="text-fg">
            Registered as <span className="font-mono text-meta">{p.saved.id}</span> and connected — its spend now appears on Channels and blended widgets.
          </span>
          {p.saved.warnings.map((w) => (
            <span key={w} className="text-xs text-warn">
              ▲ {w}
            </span>
          ))}
          <span className="flex flex-wrap gap-4 text-xs">
            <Link href="/plugins?cat=custom">See it in the gallery →</Link>
            <Link href="/channels">Open Channels →</Link>
          </span>
        </Callout>
      ) : null}
    </div>
  );
}

// ── Preview results (full width) ─────────────────────────────────────────────────────────────────────

function PreviewResults({ result, stale }: { result: PluginPreviewResult; stale: boolean }) {
  const rows = result.rows;
  const has = (k: keyof PlatformDailyRow) => rows.some((r) => typeof r[k] === "number" && (r[k] as number) !== 0);
  const money = (v: number, r: PlatformDailyRow) => formatMoney(v, { currency: r.currency, compact: false });
  const num = (v: number | undefined) => formatNumber(v ?? 0, { compact: false, decimals: v !== undefined && !Number.isInteger(v) ? 1 : 0 });
  const columns: Column<PlatformDailyRow>[] = [
    { key: "date", header: "Date", width: "96px", sortValue: (r) => r.date, cell: (r) => <span className="font-mono text-xs">{formatShort(r.date)}</span> },
    { key: "campaign", header: "Campaign", width: "minmax(140px,1.6fr)", sortValue: (r) => r.platform_campaign ?? "", cell: (r) => <span className="truncate">{r.platform_campaign ?? "—"}</span> },
    { key: "cost", header: "Spend", align: "right", sortValue: (r) => r.cost, cell: (r) => money(r.cost, r) },
    { key: "impressions", header: "Impr.", align: "right", sortValue: (r) => r.impressions, cell: (r) => num(r.impressions) },
    { key: "clicks", header: "Clicks", align: "right", sortValue: (r) => r.clicks, cell: (r) => num(r.clicks) },
    { key: "conversions", header: "Conv.", align: "right", sortValue: (r) => r.conversions, cell: (r) => num(r.conversions) },
    { key: "conv_value", header: "Conv. value", align: "right", sortValue: (r) => r.conv_value, cell: (r) => money(r.conv_value, r) },
    { key: "sessions", header: "Sessions", align: "right", hidden: !has("sessions"), sortValue: (r) => r.sessions ?? 0, cell: (r) => num(r.sessions) },
    { key: "store_revenue", header: "Revenue", align: "right", hidden: !has("store_revenue"), sortValue: (r) => r.store_revenue ?? 0, cell: (r) => money(r.store_revenue ?? 0, r) },
    { key: "orders", header: "Orders", align: "right", hidden: !has("orders"), sortValue: (r) => r.orders ?? 0, cell: (r) => num(r.orders) },
  ];
  const s = result.stats;
  const warnings = [...result.warnings, ...(result.manifestWarnings ?? [])];
  return (
    <div className={cn("flex flex-col gap-4 border-t border-teal/15 pt-5 transition-opacity", stale && "opacity-60")}>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-display text-base font-semibold tracking-title">Test &amp; preview</span>
        <span className="meta">
          {s ? `${s.items} items · ${s.pages} page${s.pages === 1 ? "" : "s"} · ${s.mappedRows} mapped rows · ${formatShort(s.range.start)} – ${formatShort(s.range.end)} · ` : ""}
          {Math.round(result.tookMs)} ms
        </span>
        {stale ? <Pill tone="muted">Out of date — run again</Pill> : null}
      </div>
      {warnings.length ? (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {warnings.map((w) => (
            <li key={w} className="flex items-start gap-2.5 text-[13px] leading-normal text-muted">
              <Dot tone="warn" size={7} className="mt-1.5" />
              {w}
            </li>
          ))}
        </ul>
      ) : null}
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => `${r.date}|${r.platform_campaign ?? ""}`}
        ariaLabel="Mapped rows (first 20)"
        density="compact"
        minWidth={720}
        maxHeight={420}
        initialSort={{ key: "date", dir: "asc" }}
        empty="No rows were mapped — check the rows path and the date field."
      />
      <details className="group">
        <summary className="cursor-pointer list-none text-xs text-muted-3 hover:text-fg">
          <span className="mr-1 inline-block transition-transform group-open:rotate-180">▾</span>
          Raw items from the API (first {Array.isArray(result.rawSample) ? result.rawSample.length : 1}, credential-looking keys redacted)
        </summary>
        <CodeBlock className="mt-2.5 max-h-80">{JSON.stringify(result.rawSample, null, 2)}</CodeBlock>
      </details>
    </div>
  );
}

// ── Import ───────────────────────────────────────────────────────────────────────────────────────────

function ImportManifestModal({ open, onOpenChange, onLoaded }: { open: boolean; onOpenChange: (o: boolean) => void; onLoaded: (form: BuilderForm) => void }) {
  const [text, setText] = useState("");
  const [replace, setReplace] = useState(false);
  const [issues, setIssues] = useState<ManifestIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const validate = useValidateManifest();
  const importer = useImportCustomPlugin();

  const parsed = () => {
    setError(null);
    setIssues([]);
    const r = parseManifestText(text);
    if (!r.ok) setError(r.error);
    return r.ok ? r.value : undefined;
  };
  const close = () => {
    onOpenChange(false);
    setText("");
    setIssues([]);
    setError(null);
  };
  const openInBuilder = () => {
    const value = parsed();
    if (value === undefined) return;
    validate.mutate(
      { manifest: value },
      {
        onSuccess: (r) => {
          if (!r.manifest) {
            setIssues(r.issues);
            return;
          }
          const derived = pluginIdFor({ id: "", name: r.manifest.name });
          const form = manifestToForm(r.manifest);
          onLoaded({ ...form, id: form.id === derived ? "" : form.id });
          toast(r.ok ? "Loaded into the builder — review and save" : "Loaded with errors — fix them before saving", { tone: r.ok ? "default" : "warn" });
          close();
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  };
  const importNow = () => {
    const value = parsed();
    if (value === undefined) return;
    importer.mutate(
      { manifest: value, replace },
      {
        onSuccess: (res) => {
          toast(`${res.plugin.manifest.name} imported and connected`);
          for (const w of res.warnings.slice(0, 1)) toast(w, { tone: "warn", ms: 5000 });
          close();
        },
        onError: (e) => {
          if (e instanceof ApiError && isValidation(e.details)) setIssues(e.details.issues);
          else setError(errorMessage(e));
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      eyebrow="Custom plugin"
      title="Import a manifest"
      description="An exported .plugin.json, our manifest, or the prototype builder's manifest. Credentials are never part of a manifest — add the key after importing."
      width={600}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="outline" onClick={openInBuilder} loading={validate.isPending}>
            Open in builder
          </Button>
          <Button variant="brand" onClick={importNow} loading={importer.isPending}>
            Import &amp; connect
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <input
          type="file"
          accept="application/json,.json"
          aria-label="Choose a manifest file"
          className="text-xs text-muted file:mr-3 file:rounded-pill file:border file:border-line file:bg-transparent file:px-3 file:py-1.5 file:text-xs file:text-fg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void file.text().then(setText);
          }}
        />
        <Textarea rows={10} aria-label="Manifest JSON" spellCheck={false} className="font-mono text-xs" placeholder='{"kind":"savd.plugin","manifest":{…}}' value={text} onChange={(e) => setText(e.target.value)} />
        <label className="flex items-center gap-2.5 text-[13px] text-muted">
          <Checkbox checked={replace} onChange={setReplace} ariaLabel="Replace a plugin with the same id" />
          Replace a plugin with the same id (otherwise a copy is imported)
        </label>
        {error ? <Callout tone="crit">{error}</Callout> : null}
        {issues.length ? <IssueList issues={issues} onIssue={() => undefined} /> : null}
      </div>
    </Modal>
  );
}
