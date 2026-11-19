"use client";

import Link from "next/link";
import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Chip, Segmented } from "@/components/ui/controls";
import { Field, Input, Select, Textarea } from "@/components/ui/inputs";
import { Menu } from "@/components/ui/overlays";
import { CharCounter } from "@/components/ui/status";
import type { SecretDescription } from "@/lib/domain/contracts/plugins";
import { getPath } from "@/lib/domain/plugins/dot-path";
import { readField } from "@/lib/domain/plugins/mapping";
import {
  AUTH_TYPES,
  BUILDER_CATEGORIES,
  DATE_FORMATS,
  defaultAbbr,
  fieldRefOf,
  MAPPING_TARGETS,
  PAGINATION_TYPES,
  pluginIdFor,
  suggestEnvKey,
  TEMPLATE_HINTS,
  TRANSFORMS,
  type AuthType,
  type BuilderForm,
  type DateFormat,
  type MappingRow,
  type MappingTarget,
  type PaginationType,
  type SecretSource,
  type Transform,
} from "./builder-model";

// Steps of the custom REST builder: Basics · Endpoint · Mapping. Each edits one slice of the form; the parent owns
// state, the manifest preview and the Preview & save step.

export type FormPatch = (fn: (f: BuilderForm) => BuilderForm) => void;

const mono = "font-mono text-xs";

export function PluginMark({ abbr, className }: { abbr: string; className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-mini border border-tone/12 bg-tone/3 font-mono text-eyebrow text-fg", className)}>
      {abbr}
    </span>
  );
}

// ── Basics ───────────────────────────────────────────────────────────────────────────────────────────

export function BasicsStep({ form, update }: { form: BuilderForm; update: FormPatch }) {
  const set = (p: Partial<BuilderForm>) => update((f) => ({ ...f, ...p }));
  return (
    <div className="flex flex-col gap-4">
      <Field label="Service name">
        {(id) => <Input id={id} variant="field" value={form.name} maxLength={60} placeholder="Acme Ads" onChange={(e) => set({ name: e.target.value })} />}
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="label-mono" id="builder-category">
          Category
        </span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="builder-category">
          {BUILDER_CATEGORIES.map((c) => (
            <Chip key={c.value} active={form.category === c.value} onClick={() => set({ category: c.value })}>
              {c.label}
            </Chip>
          ))}
        </div>
        <span className="text-xs leading-normal text-muted-3">
          Ad platforms join blended spend; analytics adds sessions; commerce revenue feeds MER. Alerts go out through the <Link href="/plugins?connect=webhook">Webhook plugin</Link>.
        </span>
      </div>
      <Field label="Description" aside={<CharCounter length={form.description.length} max={400} />}>
        {(id) => <Textarea id={id} rows={3} maxLength={400} className="min-h-0 resize-y" placeholder="What this source reports (shown on its card)" value={form.description} onChange={(e) => set({ description: e.target.value })} />}
      </Field>
      <div className="flex items-end gap-3">
        <Field label="Icon" hint="2–3 characters on the card" className="w-40">
          {(id) => <Input id={id} variant="field" value={form.abbr} maxLength={3} placeholder={defaultAbbr(form.name)} className="font-mono uppercase" onChange={(e) => set({ abbr: e.target.value.toUpperCase() })} />}
        </Field>
        <PluginMark abbr={(form.abbr.trim() || defaultAbbr(form.name)).toUpperCase()} className="mb-6" />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="label-mono">Refresh</span>
        <Segmented
          ariaLabel="Refresh cadence"
          variant="sans"
          className="self-start"
          value={form.refresh}
          onChange={(refresh) => set({ refresh })}
          options={[
            { value: "manual", label: "Manual" },
            { value: "hourly", label: "Hourly" },
            { value: "daily", label: "Daily" },
          ]}
        />
      </div>
      <span className="meta">Registers as {pluginIdFor(form)}</span>
    </div>
  );
}

// ── Endpoint ─────────────────────────────────────────────────────────────────────────────────────────

interface EndpointProps {
  form: BuilderForm;
  update: FormPatch;
  secret: string;
  onSecret: (v: string) => void;
  savedSecret: SecretDescription | null;
  clearSaved: boolean;
  onClearSaved: (v: boolean) => void;
  encryption: boolean;
}

export function EndpointStep({ form, update, secret, onSecret, savedSecret, clearSaved, onClearSaved, encryption }: EndpointProps) {
  const auth = (p: Partial<BuilderForm["auth"]>) => update((f) => ({ ...f, auth: { ...f.auth, ...p } }));
  const report = (p: Partial<BuilderForm["report"]>) => update((f) => ({ ...f, report: { ...f.report, ...p } }));
  const pg = (p: Partial<BuilderForm["pagination"]>) => update((f) => ({ ...f, pagination: { ...f.pagination, ...p } }));
  const envKey = suggestEnvKey(pluginIdFor(form));
  const sources: { value: SecretSource; label: string }[] = [
    { value: "value", label: "Enter key" },
    { value: "env", label: "From .env" },
    ...(savedSecret?.hasValue ? [{ value: "saved" as const, label: "Keep saved" }] : []),
  ];
  const source = form.auth.source === "saved" && !savedSecret?.hasValue ? "value" : form.auth.source;
  const p = form.pagination;

  return (
    <div className="flex flex-col gap-4">
      <Field label="Base URL" hint="https://api.example.com/v1 — or mock://platform for the built-in mock API.">
        {(id) => <Input id={id} variant="field" className={mono} spellCheck={false} value={form.baseUrl} onChange={(e) => update((f) => ({ ...f, baseUrl: e.target.value }))} />}
      </Field>

      <div className="flex flex-col gap-3 rounded-mini border border-line bg-fill p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Auth" className="min-w-[180px] flex-1">
            {(id) => (
              <Select id={id} value={form.auth.type} onChange={(e) => auth({ type: e.target.value as AuthType })}>
                {AUTH_TYPES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {form.auth.type === "api_key_header" ? (
            <Field label="Header name" className="min-w-[160px] flex-1">
              {(id) => <Input id={id} variant="field" className={mono} value={form.auth.header} placeholder="Authorization" onChange={(e) => auth({ header: e.target.value })} />}
            </Field>
          ) : null}
          {form.auth.type === "api_key_query" ? (
            <Field label="Query parameter" className="min-w-[160px] flex-1">
              {(id) => <Input id={id} variant="field" className={mono} value={form.auth.param} placeholder="api_key" onChange={(e) => auth({ param: e.target.value })} />}
            </Field>
          ) : null}
          {form.auth.type === "basic" ? (
            <Field label="Username" className="min-w-[160px] flex-1">
              {(id) => <Input id={id} variant="field" value={form.auth.username} autoComplete="off" onChange={(e) => auth({ username: e.target.value })} />}
            </Field>
          ) : null}
        </div>

        {form.auth.type !== "none" ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="label-mono">{form.auth.type === "basic" ? "Password" : form.auth.type === "bearer" ? "Token" : "API key"}</span>
              <Segmented ariaLabel="Credential source" variant="sans" value={source} onChange={(s) => auth({ source: s, ...(s === "env" && !form.auth.env ? { env: envKey } : {}) })} options={sources} />
            </div>
            {source === "value" ? (
              <>
                <Input
                  variant="field"
                  type="password"
                  aria-label="Credential (write-only)"
                  autoComplete="new-password"
                  spellCheck={false}
                  className={mono}
                  placeholder="••••••••"
                  value={secret}
                  onChange={(e) => onSecret(e.target.value)}
                />
                <span className="text-xs leading-normal text-muted-3">
                  {encryption
                    ? "Write-only: used for Test & preview, encrypted on save, never shown again."
                    : "Used once for Test & preview and never stored. Saving it needs APP_ENCRYPTION_KEY — otherwise switch to From .env."}
                </span>
              </>
            ) : source === "env" ? (
              <>
                <Input variant="field" aria-label="Environment variable name" className={mono} spellCheck={false} placeholder={envKey} value={form.auth.env} onChange={(e) => auth({ env: e.target.value.toUpperCase() })} />
                <span className="text-xs leading-normal text-muted-3">
                  Add <code className="font-mono text-fg">{(form.auth.env || envKey).trim()}=…</code> to the server&apos;s .env and restart. Only PLUGIN_* variables can be referenced (least privilege).
                </span>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-3">
                <span className="font-mono text-meta text-fg">{clearSaved ? "Will be removed on save" : `Saved · ${savedSecret?.masked ?? "••••"}`}</span>
                <Button variant="link" className="text-xs" onClick={() => onClearSaved(!clearSaved)}>
                  {clearSaved ? "Keep it" : "Remove saved key"}
                </Button>
                <span>Changing the base URL&apos;s host clears it.</span>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="label-mono">Method</span>
            <Segmented
              ariaLabel="Request method"
              value={form.report.method}
              onChange={(method) => report({ method })}
              options={[
                { value: "GET", label: "GET" },
                { value: "POST", label: "POST" },
              ]}
            />
          </div>
          <Field label="Report path" className="min-w-[220px] flex-1">
            {(id) => <Input id={id} variant="field" className={mono} spellCheck={false} value={form.report.path} placeholder="/reports?from={start}&to={end}" onChange={(e) => report({ path: e.target.value })} />}
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Template variables">
          <span className="label-mono mr-1">Insert</span>
          {TEMPLATE_HINTS.map((v) =>
            v.includes("<") ? (
              <span key={v} className="rounded-pill border border-dashed border-tone/14 px-2 py-0.5 font-mono text-micro text-faint" title="Config fields come with imported manifests">
                {v}
              </span>
            ) : (
              <button key={v} type="button" className="rounded-pill border border-line px-2 py-0.5 font-mono text-micro text-muted transition-colors hover:border-teal/40 hover:text-accent" onClick={() => report({ path: form.report.path + v })}>
                {v}
              </button>
            ),
          )}
        </div>
      </div>
      {form.report.method === "POST" ? (
        <Field label="Body (JSON template)" hint="Rendered with the same variables. Put credentials in Auth, not here.">
          {(id) => <Textarea id={id} rows={4} className={cn(mono, "min-h-0")} spellCheck={false} value={form.report.body} placeholder='{"from": "{start}", "to": "{end}"}' onChange={(e) => report({ body: e.target.value })} />}
        </Field>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.7fr)]">
        <Field label="Rows path" hint="Dot path to the array of items">
          {(id) => <Input id={id} variant="field" className={mono} spellCheck={false} value={form.report.rowsPath} placeholder="data.rows" onChange={(e) => report({ rowsPath: e.target.value })} />}
        </Field>
        <Field label="Date format">
          {(id) => (
            <Select id={id} value={form.report.dateFormat} onChange={(e) => report({ dateFormat: e.target.value as DateFormat })}>
              {DATE_FORMATS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Chunk days" hint="default 92">
          {(id) => <Input id={id} variant="field" inputMode="numeric" className={mono} value={form.report.chunkDays} placeholder="92" onChange={(e) => report({ chunkDays: e.target.value.replace(/\D/g, "") })} />}
        </Field>
      </div>

      <div className="flex flex-col gap-3 rounded-mini border border-line bg-fill p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="label-mono">Pagination</span>
          <Segmented ariaLabel="Pagination" variant="sans" value={p.type} onChange={(type: PaginationType) => pg({ type, ...(type !== "none" && !p.param ? { param: type } : {}) })} options={PAGINATION_TYPES} />
        </div>
        {p.type !== "none" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={`${p.type} query param`} hint={`or put {${p.type}} in the path`}>
              {(id) => <Input id={id} variant="field" className={mono} value={p.param} placeholder={p.type} onChange={(e) => pg({ param: e.target.value })} />}
            </Field>
            {p.type === "cursor" ? (
              <Field label="Next cursor path" hint="where the response carries the next cursor">
                {(id) => <Input id={id} variant="field" className={mono} value={p.cursorPath} placeholder="paging.next" onChange={(e) => pg({ cursorPath: e.target.value })} />}
              </Field>
            ) : (
              <Field label="Page size" hint="paging stops at a shorter page">
                {(id) => <Input id={id} variant="field" inputMode="numeric" className={mono} value={p.pageSize} placeholder="100" onChange={(e) => pg({ pageSize: e.target.value.replace(/\D/g, "") })} />}
              </Field>
            )}
            <Field label="Page size param" hint="optional, e.g. per_page">
              {(id) => <Input id={id} variant="field" className={mono} value={p.pageSizeParam} placeholder="page_size" onChange={(e) => pg({ pageSizeParam: e.target.value })} />}
            </Field>
            <Field label="Max pages" hint="1–50 per chunk">
              {(id) => <Input id={id} variant="field" inputMode="numeric" className={mono} value={p.maxPages} placeholder="10" onChange={(e) => pg({ maxPages: e.target.value.replace(/\D/g, "") })} />}
            </Field>
          </div>
        ) : (
          <span className="text-xs text-muted-3">One request per date chunk. Pick cursor, page or offset when the API pages its results.</span>
        )}
      </div>

      <Field label="Test path" hint="Optional cheap endpoint for the Test button, e.g. /health">
        {(id) => <Input id={id} variant="field" className={mono} value={form.report.testPath} placeholder="/health" onChange={(e) => report({ testPath: e.target.value })} />}
      </Field>
    </div>
  );
}

// ── Mapping ──────────────────────────────────────────────────────────────────────────────────────────

/** What a row maps to in the first raw item of the last preview (string for date/campaign, number otherwise). */
function sampleValue(item: unknown, r: MappingRow): string | null {
  if (item === undefined) return null;
  try {
    if ((r.target === "date" || r.target === "campaign") && !r.expr.trim()) {
      const v = getPath(item, r.path.trim());
      return v === undefined || v === null ? "no value" : typeof v === "object" ? "object — pick a field" : String(v);
    }
    const n = readField(item, fieldRefOf(r));
    return n === null ? "no number" : String(Math.round(n * 1000) / 1000);
  } catch (err) {
    return err instanceof Error ? err.message : "invalid path";
  }
}

export function MappingStep({ form, update, sampleItem }: { form: BuilderForm; update: FormPatch; sampleItem: unknown }) {
  const setRow = (target: MappingTarget, p: Partial<MappingRow>) => update((f) => ({ ...f, mappings: f.mappings.map((r) => (r.target === target ? { ...r, ...p } : r)) }));
  const used = new Set(form.mappings.map((r) => r.target));
  const available = MAPPING_TARGETS.filter((t) => !used.has(t.key));
  const add = (target: MappingTarget) => update((f) => ({ ...f, mappings: [...f.mappings, { target, path: "", transform: "", expr: "" }] }));
  const remove = (target: MappingTarget) => update((f) => ({ ...f, mappings: f.mappings.filter((r) => r.target !== target) }));
  const retarget = (from: MappingTarget, to: MappingTarget) => update((f) => ({ ...f, mappings: f.mappings.map((r) => (r.target === from ? { ...r, target: to } : r)) }));

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[13px] leading-[1.6] text-muted">
        Map each dashboard field to a path inside one item of <span className="font-mono text-fg">{form.report.rowsPath || "the response"}</span>. Paths use dots and selectors:{" "}
        <span className="font-mono text-xs text-fg">metrics.spend</span> · <span className="font-mono text-xs text-fg">actions[action_type=purchase].value</span> · <span className="font-mono text-xs text-fg">results[*].cost</span> (with sum).
      </p>
      <div className="flex flex-col gap-2">
        {form.mappings.map((r) => {
          const meta = MAPPING_TARGETS.find((t) => t.key === r.target);
          const sample = sampleValue(sampleItem, r);
          const numeric = r.target !== "date" && r.target !== "campaign";
          return (
            <div key={r.target} className="flex flex-col gap-2 rounded-mini border border-line bg-fill p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Select aria-label="Target field" className="w-[132px] py-2 font-mono text-xs" value={r.target} onChange={(e) => retarget(r.target, e.target.value as MappingTarget)}>
                  {MAPPING_TARGETS.filter((t) => t.key === r.target || !used.has(t.key)).map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </Select>
                <span aria-hidden className="text-faint">
                  ←
                </span>
                <Input
                  variant="field"
                  aria-label={`Path for ${meta?.label ?? r.target}`}
                  className={cn(mono, "min-w-[160px] flex-[1_1_200px] py-2")}
                  spellCheck={false}
                  value={r.path}
                  disabled={!!r.expr.trim()}
                  placeholder={r.expr.trim() ? "using the expression below" : "dot.path"}
                  onChange={(e) => setRow(r.target, { path: e.target.value })}
                />
                {numeric ? (
                  <Select aria-label="Transform" className="w-[104px] py-2 font-mono text-xs" value={r.transform} onChange={(e) => setRow(r.target, { transform: e.target.value as Transform })} title={TRANSFORMS.find((t) => t.value === r.transform)?.hint}>
                    {TRANSFORMS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                ) : null}
                {r.target !== "date" ? (
                  <IconButton label={`Remove ${meta?.label ?? r.target}`} onClick={() => remove(r.target)}>
                    ×
                  </IconButton>
                ) : null}
              </div>
              {numeric ? (
                <Input
                  variant="field"
                  aria-label={`Expression for ${meta?.label ?? r.target} (optional)`}
                  className={cn(mono, "py-2")}
                  spellCheck={false}
                  value={r.expr}
                  placeholder="optional expression, e.g. metrics__spend * 1.1 (a__b reads a.b)"
                  onChange={(e) => setRow(r.target, { expr: e.target.value })}
                />
              ) : null}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-3">
                <span>{meta?.hint}</span>
                {sample !== null ? <span className="ml-auto font-mono text-meta text-accent">→ {sample}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
      {available.length ? (
        <Menu
          align="start"
          trigger={
            <Button variant="ghost" size="xs" className="self-start">
              + Add field
            </Button>
          }
          items={available.map((t) => ({ label: t.label, hint: t.hint, onSelect: () => add(t.key) }))}
        />
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Currency" hint="ISO code of amounts (default: account currency)">
          {(id) => <Input id={id} variant="field" className={cn(mono, "uppercase")} maxLength={3} value={form.currency} placeholder="USD" onChange={(e) => update((f) => ({ ...f, currency: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") }))} />}
        </Field>
        <Field label="Dedupe key" hint="Path to a unique row id (optional)">
          {(id) => <Input id={id} variant="field" className={mono} value={form.dedupeKey} placeholder="id" onChange={(e) => update((f) => ({ ...f, dedupeKey: e.target.value }))} />}
        </Field>
      </div>
      {sampleItem === undefined ? <span className="text-xs text-muted-3">Run “Test & preview rows” to see what each path returns.</span> : null}
    </div>
  );
}
