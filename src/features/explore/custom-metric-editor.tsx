"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { SkeletonLines } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/inputs";
import { ConfirmDialog, Modal } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { useCustomMetrics, useDeleteCustomMetric, useFormulaCheck, useSaveCustomMetric } from "@/lib/api/explore";
import type { Catalog } from "@/lib/api/hooks";
import type { CustomMetricBody } from "@/lib/domain/contracts/dashboard";
import type { MetricDirection, MetricFormat } from "@/lib/domain/types";
import { listLabel } from "./compat";
import { formatGlyph, GroupLabel } from "./ui";
const KEY_RE = /^cm_[a-z0-9_]{1,40}$/;
const FUNCTIONS = [
    { name: "if", sig: "if(cond, a, b)", doc: "a when cond is true (non-zero), else b" },
    { name: "safe_div", sig: "safe_div(a, b)", doc: "a ÷ b, empty when b is 0" },
    { name: "coalesce", sig: "coalesce(a, b, …)", doc: "first value that isn't empty" },
    { name: "min", sig: "min(a, b, …)", doc: "smallest value" },
    { name: "max", sig: "max(a, b, …)", doc: "largest value" },
    { name: "abs", sig: "abs(x)", doc: "absolute value" },
    { name: "round", sig: "round(x, digits?)", doc: "round to 0–6 decimals" },
    { name: "floor", sig: "floor(x)", doc: "round down" },
    { name: "ceil", sig: "ceil(x)", doc: "round up" },
];
const OPERATORS = ["+", "-", "*", "/", "<", "<=", ">", ">=", "==", "!=", "and", "or", "not"];
const FORMATS: {
    value: MetricFormat;
    label: string;
}[] = [
    { value: "money", label: "Money" },
    { value: "number", label: "Number" },
    { value: "decimal", label: "Decimal" },
    { value: "percent", label: "Percent" },
    { value: "ratio", label: "Ratio" },
];
const DIRECTIONS: {
    value: MetricDirection;
    label: string;
}[] = [
    { value: "up_good", label: "Higher is better" },
    { value: "down_good", label: "Lower is better" },
    { value: "neutral", label: "Neutral" },
];
export function slugKey(label: string): string {
    return label
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40);
}
interface EditorProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editKey?: string;
    catalog: Catalog;
    currency: string;
    onSaved: (key: string, created: boolean) => void;
    onDeleted: (key: string) => void;
}
export function CustomMetricEditor(props: EditorProps) {
    return (<Modal open={props.open} onOpenChange={props.onOpenChange} eyebrow="Custom metric" title={props.editKey ? "Edit custom metric" : "New custom metric"} description="A formula over other metrics, computed after aggregation (ratio of sums) so totals, groups and comparisons agree." width={820}>
      {props.open ? <EditorLoader key={props.editKey ?? "new"} {...props}/> : null}
    </Modal>);
}
function EditorLoader(props: EditorProps) {
    const custom = useCustomMetrics();
    if (props.editKey && !custom.data)
        return <SkeletonLines lines={5}/>;
    const existing = props.editKey ? custom.data?.find((m) => m.key === props.editKey) : undefined;
    const fromCatalog = props.editKey ? props.catalog.metrics.find((m) => m.key === props.editKey) : undefined;
    const initial: CustomMetricBody = existing ?? {
        key: props.editKey ?? "",
        label: fromCatalog?.label ?? "",
        formula: fromCatalog?.formula ?? "",
        format: (fromCatalog?.format as MetricFormat) ?? "money",
        direction: (fromCatalog?.direction as MetricDirection) ?? "up_good",
    };
    return <EditorForm {...props} initial={initial}/>;
}
function FormulaMarker({ formula, position }: {
    formula: string;
    position: number;
}) {
    const pos = Math.max(0, Math.min(position, formula.length));
    const token = /^[A-Za-z_][A-Za-z0-9_]*/.exec(formula.slice(pos))?.[0] ?? formula.charAt(pos);
    const len = Math.max(1, token.length);
    return (<div className="overflow-x-auto rounded-mini border border-crit/25 bg-crit-t/30 px-3.5 py-2.5 font-mono text-xs leading-relaxed whitespace-pre" aria-hidden>
      <div className="text-muted">
        {formula.slice(0, pos)}
        <mark className="rounded-[2px] bg-crit/15 text-crit underline decoration-crit decoration-wavy underline-offset-4">{formula.slice(pos, pos + len) || " "}</mark>
        {formula.slice(pos + len)}
      </div>
      <div className="text-crit">{`${" ".repeat(pos)}${"^".repeat(len)}`}</div>
    </div>);
}
function EditorForm({ editKey, catalog, currency, onSaved, onDeleted, onOpenChange, initial }: EditorProps & {
    initial: CustomMetricBody;
}) {
    const [label, setLabel] = useState(initial.label);
    const [keyTail, setKeyTail] = useState(initial.key.replace(/^cm_/, ""));
    const [keyTouched, setKeyTouched] = useState(!!editKey);
    const [formula, setFormula] = useState(initial.formula);
    const [checked, setChecked] = useState(initial.formula);
    const [format, setFormat] = useState<MetricFormat>(initial.format);
    const [direction, setDirection] = useState<MetricDirection>(initial.direction);
    const [description, setDescription] = useState(initial.description ?? "");
    const [saveError, setSaveError] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const area = useRef<HTMLTextAreaElement>(null);
    const save = useSaveCustomMetric();
    const del = useDeleteCustomMetric();
    const check = useFormulaCheck(checked, editKey);
    const statusId = useId();
    useEffect(() => {
        const t = timer;
        return () => {
            if (t.current)
                clearTimeout(t.current);
        };
    }, []);
    const tail = keyTouched ? keyTail : slugKey(label);
    const key = `cm_${tail}`;
    const keyError = !tail ? "Give it a key" : !KEY_RE.test(key) ? "Lowercase letters, digits and _ only (max 40)" : !editKey && catalog.metrics.some((m) => m.key === key) ? `${key} already exists` : null;
    const pending = formula !== checked || check.isFetching;
    const result = !pending && formula.trim() ? check.data : undefined;
    const tables = result?.ok ? catalog.tables.filter((t) => result.deps.every((d) => t.measures.includes(d))) : [];
    const canSave = !!label.trim() && !keyError && !!result?.ok && !save.isPending;
    const onFormula = (v: string) => {
        setFormula(v);
        setSaveError(null);
        if (timer.current)
            clearTimeout(timer.current);
        timer.current = setTimeout(() => setChecked(v), 300);
    };
    const insert = (text: string, caret = text.length) => {
        const el = area.current;
        const start = el?.selectionStart ?? formula.length;
        const end = el?.selectionEnd ?? formula.length;
        const before = formula.slice(0, start);
        const pad = before && !/[\s(]$/.test(before) && !/^[)\s,]/.test(text) ? " " : "";
        const next = `${before}${pad}${text}${formula.slice(end)}`;
        onFormula(next);
        requestAnimationFrame(() => {
            el?.focus();
            const at = start + pad.length + caret;
            el?.setSelectionRange(at, at);
        });
    };
    const jumpToError = () => {
        const el = area.current;
        const pos = result?.error?.position ?? 0;
        el?.focus();
        el?.setSelectionRange(pos, Math.min(formula.length, pos + 1));
    };
    const submit = async () => {
        const body: CustomMetricBody = { key, label: label.trim(), formula: formula.trim(), format, direction, ...(description.trim() ? { description: description.trim() } : {}) };
        try {
            await save.mutateAsync({ body, id: editKey });
            toast(editKey ? `Updated “${body.label}”` : `Created “${body.label}” — added to the question`);
            onSaved(key, !editKey);
            onOpenChange(false);
        }
        catch (e) {
            setSaveError((e as Error).message || "Couldn't save the metric");
        }
    };
    const groups = [
        { name: "Base", items: catalog.metrics.filter((m) => m.kind === "base") },
        { name: "Ratio", items: catalog.metrics.filter((m) => m.kind === "derived") },
        { name: "Custom", items: catalog.metrics.filter((m) => m.kind === "custom" && m.key !== editKey) },
    ];
    return (<div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Label">{(id) => <Input id={id} variant="field" value={label} maxLength={60} placeholder="Profit" onChange={(e) => setLabel(e.target.value)} autoFocus={!editKey}/>}</Field>
            <Field label="Key" error={label || keyTouched ? keyError : null} hint={editKey ? "Keys can't change after saving." : "Used in formulas and saved questions."}>
              {(id) => (<div className="flex items-center rounded-mini border border-line bg-input focus-within:border-accent/60">
                  <span className="pl-3.5 font-mono text-[13px] text-faint">cm_</span>
                  <input id={id} value={tail} readOnly={!!editKey} maxLength={40} onChange={(e) => {
                setKeyTouched(true);
                setKeyTail(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
            }} className="min-w-0 flex-1 bg-transparent py-2.5 pr-3.5 font-mono text-[13px] text-fg outline-none read-only:text-muted-3" spellCheck={false}/>
                </div>)}
            </Field>
          </div>

          <Field label="Formula" aside={<span className="font-mono text-micro text-faint">{`${formula.length}/500`}</span>}>
            {(id) => (<Textarea id={id} ref={area} value={formula} maxLength={500} rows={3} spellCheck={false} placeholder="(conv_value - cost) / cost" onChange={(e) => onFormula(e.target.value)} className="min-h-20 font-mono text-[13px] leading-relaxed" aria-invalid={result ? !result.ok : undefined} aria-describedby={statusId}/>)}
          </Field>
          <div id={statusId} className="-mt-2 flex flex-col gap-2" aria-live="polite">
            {!formula.trim() ? (<span className="text-xs text-muted-3">Combine metrics with + − × ÷, comparisons and the functions on the right.</span>) : pending ? (<span className="animate-shimmer text-xs text-muted-3">Checking…</span>) : result?.ok ? (<span className="text-xs text-accent">
                ✓ Valid · uses {listLabel(result.identifiers.map((i) => catalog.metrics.find((m) => m.key === i)?.label ?? i))}
                <span className="text-muted-3">{` · computable in ${tables.length} of ${catalog.tables.length} tables`}</span>
              </span>) : result?.error ? (<>
                <span className="flex flex-wrap items-center gap-2 text-xs text-crit">
                  <span>{`× ${result.error.message} · column ${result.error.position + 1}`}</span>
                  <Button variant="link" className="text-xs" onClick={jumpToError}>
                    Jump to it →
                  </Button>
                </span>
                <FormulaMarker formula={checked} position={result.error.position}/>
              </>) : check.error ? (<span className="text-xs text-crit">× Couldn&apos;t validate: {(check.error as Error).message}</span>) : null}
          </div>

          <div className="flex flex-col gap-2">
            <span className="label-mono">Format</span>
            <Segmented ariaLabel="Format" variant="sans" value={format} onChange={setFormat} options={FORMATS.map((f) => ({ value: f.value, label: `${f.label} ${formatGlyph(f.value, currency)}` }))} className="self-start"/>
          </div>
          <div className="flex flex-col gap-2">
            <span className="label-mono">Direction</span>
            <Segmented ariaLabel="Direction" variant="sans" value={direction} onChange={setDirection} options={DIRECTIONS} className="self-start"/>
            <span className="text-xs text-muted-3">Colors deltas: green when the change is good for this metric.</span>
          </div>
          <Field label="Description">{(id) => <Textarea id={id} value={description} maxLength={240} rows={2} placeholder="What it means and when to use it" onChange={(e) => setDescription(e.target.value)} className="min-h-16"/>}</Field>
        </div>

        <div className="flex min-w-0 flex-col gap-4 rounded-mini border border-tone/8 bg-fill p-4">
          <div className="flex flex-col gap-2">
            <GroupLabel>Metrics · click to insert</GroupLabel>
            {groups.map((g) => g.items.length ? (<div key={g.name} className="flex flex-wrap gap-1">
                  {g.items.map((m) => (<button key={m.key} type="button" onClick={() => insert(m.key)} title={`${m.label} — ${m.description}`} className="rounded-[6px] border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted transition-colors hover:border-teal/40 hover:text-accent">
                      {m.key}
                    </button>))}
                </div>) : null)}
          </div>
          <div className="flex flex-col gap-2">
            <GroupLabel>Functions</GroupLabel>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {FUNCTIONS.map((f) => (<li key={f.name}>
                  <button type="button" onClick={() => insert(`${f.name}()`, f.name.length + 1)} className="flex w-full items-baseline gap-2 rounded-[6px] px-1.5 py-1 text-left hover:bg-tone/5">
                    <span className="shrink-0 font-mono text-[11px] text-accent">{f.sig}</span>
                    <span className="min-w-0 truncate text-[11px] text-muted-3">{f.doc}</span>
                  </button>
                </li>))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <GroupLabel>Operators</GroupLabel>
            <div className="flex flex-wrap gap-1">
              {OPERATORS.map((op) => (<button key={op} type="button" onClick={() => insert(` ${op} `.trimStart())} className="rounded-[6px] border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted hover:border-teal/40 hover:text-accent">
                  {op}
                </button>))}
            </div>
            <span className="text-[11px] leading-relaxed text-muted-3">Division by zero gives an empty value, never an error. Comparisons return 1 or 0.</span>
          </div>
        </div>
      </div>

      {saveError ? <p className="m-0 text-xs text-crit">× {saveError}</p> : null}
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        {editKey ? (<Button variant="danger" onClick={() => setConfirmDelete(true)} loading={del.isPending} className="mr-auto">
            Delete metric
          </Button>) : null}
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="brand" disabled={!canSave} loading={save.isPending} onClick={() => void submit()}>
          {editKey ? "Save changes" : "Create metric"}
        </Button>
      </div>
      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} danger title={`Delete “${initial.label}”?`} description="Saved questions and dashboard widgets that use it will show an “unknown metric” error until it is removed from them." confirmLabel="Delete" onConfirm={() => void del
            .mutateAsync(editKey as string)
            .then(() => {
            toast(`Deleted “${initial.label}”`);
            onDeleted(editKey as string);
            onOpenChange(false);
        })
            .catch((e: Error) => toast(e.message || "Couldn't delete", { tone: "crit" }))}/>
    </div>);
}
