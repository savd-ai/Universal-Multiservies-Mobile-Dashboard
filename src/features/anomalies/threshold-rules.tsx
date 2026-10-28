"use client";
import { useMemo, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Segmented, Switch } from "@/components/ui/controls";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ErrorState, SkeletonLines } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/inputs";
import { ConfirmDialog, Drawer, Menu } from "@/components/ui/overlays";
import { Pill, SEVERITY_META } from "@/components/ui/status";
import { Card, CardHeader } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useCampaignOptions, useDeleteThresholdRule, useRulePreview, useSaveThresholdRule, useThresholdRules } from "@/lib/api/anomalies-ui";
import { useCatalog } from "@/lib/api/hooks";
import type { ThresholdRule } from "@/lib/domain/contracts/anomaly";
import { formatShort, isCivilDate } from "@/lib/domain/dates";
import { currencySymbol } from "@/lib/domain/metrics/registry";
import { CAMPAIGN_TYPES, type MetricFormat, type Severity } from "@/lib/domain/types";
import { describeRuleCondition, describeRuleScope, describeRuleWindow, draftFromRule, newRuleDraft, RULE_OPS, ruleFromDraft, ruleValueUnit, summarizeRulePreview, type MetricMeta, type RuleDraft, type RuleOp, } from "./helpers/rules";
import { CampaignChecklist, NumberInput, ToggleChips, useValueFormat } from "./shared";
const SEVERITIES: {
    value: Severity;
    label: string;
}[] = [
    { value: "critical", label: "Critical" },
    { value: "warning", label: "Warning" },
    { value: "info", label: "Info" },
];
function RuleSeverity({ severity }: {
    severity: Severity;
}) {
    return <Pill tone={SEVERITY_META[severity].tone}>{severity === "info" ? "Info" : SEVERITY_META[severity].label}</Pill>;
}
function useRuleMetrics() {
    const catalog = useCatalog();
    return useMemo(() => {
        const list = (catalog.data?.metrics ?? []).filter((m) => m.availableIn.includes("campaign_daily"));
        const meta = new Map<string, MetricMeta & {
            label: string;
        }>(list.map((m) => [m.key, { short: m.short, format: m.format, label: m.label }]));
        return { list, meta, loading: !catalog.data };
    }, [catalog.data]);
}
export function ThresholdRulesCard() {
    const rules = useThresholdRules();
    const campaigns = useCampaignOptions();
    const metrics = useRuleMetrics();
    const { currency } = useValueFormat();
    const save = useSaveThresholdRule();
    const del = useDeleteThresholdRule();
    const [editing, setEditing] = useState<RuleDraft | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<ThresholdRule | null>(null);
    const names = useMemo(() => new Map((campaigns.data ?? []).map((c) => [c.id, c.name])), [campaigns.data]);
    const formatOf = (metric: string): MetricFormat => metrics.meta.get(metric)?.format ?? "number";
    const openRule = (r: ThresholdRule) => setEditing(draftFromRule(r, formatOf(r.metric)));
    const duplicate = (r: ThresholdRule) => setEditing({ ...draftFromRule(r, formatOf(r.metric)), id: undefined, name: `${r.name} (copy)`.slice(0, 80) });
    const toggle = (r: ThresholdRule, enabled: boolean) => save.mutate({ id: r.id, rule: { ...r, enabled } }, { onSuccess: () => toast(enabled ? `“${r.name}” is on` : `“${r.name}” is off`), onError: (e) => toast(e.message || "Couldn't update the rule", { tone: "crit" }) });
    const columns: Column<ThresholdRule>[] = [
        {
            key: "name",
            header: "Rule",
            width: "minmax(160px,1.5fr)",
            sortValue: (r) => r.name.toLowerCase(),
            cell: (r) => <span className={r.enabled ? "font-semibold" : "font-semibold text-muted-3"}>{r.name}</span>,
        },
        { key: "condition", header: "Condition", width: "minmax(150px,1.3fr)", cell: (r) => <span className="font-mono text-meta">{describeRuleCondition(r, metrics.meta.get(r.metric), currency)}</span> },
        { key: "window", header: "Window", width: "minmax(140px,1.2fr)", cell: (r) => <span className="text-muted">{describeRuleWindow(r)}</span> },
        { key: "scope", header: "Scope", width: "minmax(120px,1fr)", cell: (r) => <span className="block truncate text-muted">{describeRuleScope(r, names)}</span> },
        { key: "severity", header: "Severity", width: "100px", sortValue: (r) => (r.severity === "critical" ? 3 : r.severity === "warning" ? 2 : 1), cell: (r) => <RuleSeverity severity={r.severity}/> },
        {
            key: "enabled",
            header: "On",
            width: "56px",
            cell: (r) => (<span onClick={(e) => e.stopPropagation()}>
          <Switch checked={r.enabled} onChange={(v) => toggle(r, v)} ariaLabel={`${r.enabled ? "Turn off" : "Turn on"} ${r.name}`}/>
        </span>),
        },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            width: "40px",
            align: "right",
            cell: (r) => (<span onClick={(e) => e.stopPropagation()}>
          <Menu trigger={<IconButton label={`More for ${r.name}`}>⋯</IconButton>} items={[
                    { label: "Edit", onSelect: () => openRule(r) },
                    { label: "Duplicate", onSelect: () => duplicate(r) },
                    { label: "Delete", danger: true, separatorBefore: true, onSelect: () => setConfirmDelete(r) },
                ]}/>
        </span>),
        },
    ];
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Threshold rules" sub="Fixed limits on any daily metric — they fire alongside the statistical detectors" action={<Button variant="accent" size="xs" onClick={() => setEditing(newRuleDraft())} disabled={metrics.loading}>
            + New rule
          </Button>}/>
      {rules.error ? <ErrorState error={rules.error} onRetry={() => void rules.refetch()}/> : null}
      {!rules.data && !rules.error ? <SkeletonLines lines={4}/> : null}
      {rules.data ? (<DataTable ariaLabel="Threshold rules" rows={rules.data} columns={columns} rowKey={(r) => r.id} onRowClick={openRule} minWidth={760} empty={<span>
              No threshold rules yet. Add one to alert on fixed limits — for example CPA above {currencySymbol(currency).trim()}40 for 3 days, or conversions down 30% week over week.
            </span>}/>) : null}

      {editing ? <RuleEditor key={editing.id ?? "new"} initial={editing} metrics={metrics} onClose={() => setEditing(null)} onDelete={(r) => setConfirmDelete(r)} existing={rules.data?.find((r) => r.id === editing.id)}/> : null}

      <ConfirmDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)} title="Delete this rule?" description={confirmDelete ? `“${confirmDelete.name}” stops firing and its open signals disappear at the next evaluation.` : undefined} confirmLabel="Delete rule" danger onConfirm={() => {
            const r = confirmDelete;
            if (!r)
                return;
            del.mutate(r.id, {
                onSuccess: () => {
                    toast(`Deleted “${r.name}”`);
                    setEditing((e) => (e?.id === r.id ? null : e));
                },
                onError: (e) => toast(e.message || "Couldn't delete the rule", { tone: "crit" }),
            });
        }}/>
    </Card>);
}
interface RuleEditorProps {
    initial: RuleDraft;
    existing?: ThresholdRule;
    metrics: ReturnType<typeof useRuleMetrics>;
    onClose: () => void;
    onDelete: (r: ThresholdRule) => void;
}
function RuleEditor({ initial, existing, metrics, onClose, onDelete }: RuleEditorProps) {
    const [d, setD] = useState<RuleDraft>(initial);
    const [error, setError] = useState<string | null>(null);
    const { fmt, currency } = useValueFormat();
    const campaigns = useCampaignOptions();
    const save = useSaveThresholdRule();
    const preview = useRulePreview();
    const [previewedKey, setPreviewedKey] = useState<string | null>(null);
    const format: MetricFormat = metrics.meta.get(d.metric)?.format ?? "number";
    const built = ruleFromDraft(d, format);
    const key = built.ok ? JSON.stringify(built.rule) : null;
    const stale = !!preview.data && previewedKey !== key;
    const summary = preview.data ? summarizeRulePreview(preview.data) : null;
    const handler = (patch: Partial<RuleDraft>) => {
        setD((prev) => ({ ...prev, ...patch }));
        setError(null);
    };
    const runPreview = () => {
        if (!built.ok)
            return setError(built.error);
        setPreviewedKey(key);
        preview.mutate({ rule: built.rule, days: 30 });
    };
    const submit = () => {
        if (!built.ok)
            return setError(built.error);
        save.mutate({ id: d.id, rule: built.rule }, {
            onSuccess: (r) => {
                toast(d.id ? `Saved “${r.name}”` : `Added “${r.name}”`);
                onClose();
            },
            onError: (e) => setError(e.message || "Couldn't save the rule"),
        });
    };
    const maxCount = summary ? Math.max(1, ...summary.perDay.map((p) => p.count)) : 1;
    const unit = ruleValueUnit(d.op, format, currencySymbol(currency));
    return (<Drawer open onOpenChange={(o) => !o && onClose()} eyebrow="Threshold rule" title={d.id ? "Edit rule" : "New rule"} width={520}>
      <div className="flex flex-col gap-[18px]">
        <Field label="Name">{(id) => <Input id={id} variant="field" value={d.name} maxLength={80} onChange={(e) => handler({ name: e.target.value })} placeholder="CPA ceiling — Search" autoFocus/>}</Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Metric">
            {(id) => (<Select id={id} value={d.metric} onChange={(e) => handler({ metric: e.target.value, valueInput: "" })}>
                {metrics.list.map((m) => (<option key={m.key} value={m.key}>
                    {m.label}
                  </option>))}
              </Select>)}
          </Field>
          <Field label="Condition">
            {(id) => (<Select id={id} value={d.op} onChange={(e) => handler({ op: e.target.value as RuleOp, valueInput: "" })}>
                {RULE_OPS.map((o) => (<option key={o.value} value={o.value}>
                    {o.label}
                  </option>))}
              </Select>)}
          </Field>
        </div>

        <Field label={d.op.startsWith("change") ? "Change vs the previous period" : "Threshold"} hint={d.op === "change_pct_lt" ? "Use a negative number for drops, e.g. −30 fires when the metric falls more than 30%." : format === "percent" ? "In percent, e.g. 1.5 = 1.5%." : undefined}>
          {(id) => (<span className="flex items-center gap-2">
              {unit && unit !== "%" && unit !== "×" ? <span className="font-mono text-meta text-faint">{unit}</span> : null}
              <Input id={id} variant="field" inputMode="decimal" value={d.valueInput} onChange={(e) => handler({ valueInput: e.target.value })} placeholder={d.op.startsWith("change") ? (d.op === "change_pct_lt" ? "-30" : "30") : "40"} className="w-36 tabular"/>
              {unit === "%" || unit === "×" ? <span className="font-mono text-meta text-faint">{unit}</span> : null}
            </span>)}
        </Field>

        <div className="flex flex-col gap-2">
          <span className="label-mono">Window</span>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented ariaLabel="Window kind" variant="sans" value={d.windowKind} onChange={(v) => handler({ windowKind: v })} options={[
            { value: "last_n_days", label: "Last N days combined" },
            { value: "consecutive_days", label: "N consecutive days" },
        ]}/>
            <NumberInput value={d.days} onChange={(v) => handler({ days: v })} min={1} max={30} step={1} suffix="days" ariaLabel="Window length in days"/>
          </div>
          <span className="text-xs text-muted-3">{describeRuleWindow({ op: d.op, window: { kind: d.windowKind, days: Number.isFinite(d.days) ? d.days : 1 } })}</span>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="label-mono">Scope</span>
          <Segmented ariaLabel="Scope" variant="sans" value={d.level} onChange={(v) => handler({ level: v })} options={[
            { value: "campaign", label: "Each campaign" },
            { value: "account", label: "Account total" },
        ]}/>
          {d.level === "campaign" ? (<>
              <ToggleChips ariaLabel="Campaign types" options={CAMPAIGN_TYPES.filter((t) => t !== "Other").map((t) => ({ value: t, label: t }))} value={d.campaignTypes} onChange={(v) => handler({ campaignTypes: v })}/>
              <CampaignChecklist campaigns={campaigns.data} value={d.campaignIds} onChange={(ids) => handler({ campaignIds: ids })} label="Rule campaigns" emptyLabel="All campaigns (of the selected types)"/>
            </>) : (<span className="text-xs text-muted-3">Evaluated on the account-wide daily total.</span>)}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span className="label-mono">Severity</span>
            <Segmented ariaLabel="Severity" variant="sans" value={d.severity} onChange={(v) => handler({ severity: v })} options={SEVERITIES}/>
          </div>
          <Switch checked={d.enabled} onChange={(v) => handler({ enabled: v })} label={d.enabled ? "Enabled" : "Disabled"}/>
        </div>

        {built.ok ? (<p className="rounded-mini border border-teal/30 bg-teal/6 px-3.5 py-3 text-[13px] leading-relaxed text-muted">
            <span className="text-fg">Fires when </span>
            {`${describeRuleCondition(built.rule, metrics.meta.get(d.metric), currency)} · ${describeRuleWindow(built.rule)} · ${describeRuleScope(built.rule, new Map((campaigns.data ?? []).map((c) => [c.id, c.name])))}`}
          </p>) : null}

        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="xs" onClick={runPreview} loading={preview.isPending}>
              Preview last 30 days
            </Button>
            {stale ? <span className="text-xs text-muted-3">The rule changed — preview again.</span> : null}
          </div>
          {preview.error ? <ErrorState error={preview.error} compact/> : null}
          {summary ? (<div className={stale ? "flex flex-col gap-3 opacity-60" : "flex flex-col gap-3"}>
              <span className="text-[13px]">
                {summary.totalHits ? (<>
                    Would have fired on <span className="font-semibold">{summary.firedDays}</span> of {summary.windowDays} days · {summary.totalHits} hit{summary.totalHits === 1 ? "" : "s"} across {summary.entities.length} {d.level === "account" ? "account" : `campaign${summary.entities.length === 1 ? "" : "s"}`}
                  </>) : (`Wouldn't have fired in the last ${summary.windowDays} days — loosen the threshold to catch more.`)}
              </span>
              <div className="flex h-10 items-end gap-[2px]" role="img" aria-label={`Hits per day over the last ${summary.windowDays} days`}>
                {summary.perDay.map((p) => (<span key={p.date} title={`${isCivilDate(p.date) ? formatShort(p.date) : p.date}: ${p.count} hit${p.count === 1 ? "" : "s"}`} className="min-w-0 flex-1 rounded-t-[2px]" style={{ height: p.count ? `${Math.max(12, (p.count / maxCount) * 100)}%` : "2px", background: p.count ? `var(--${SEVERITY_META[d.severity].tone === "accent" ? "accent" : SEVERITY_META[d.severity].tone})` : "rgba(var(--fg-rgb),0.12)" }}/>))}
              </div>
              {summary.entities.length ? (<div role="table" aria-label="Campaigns that would fire" className="flex flex-col">
                  <div role="row" className="grid grid-cols-[minmax(0,1fr)_64px_72px_88px] gap-2 border-b border-line pb-2 font-mono text-micro tracking-label text-faint uppercase">
                    <span role="columnheader">Campaign</span>
                    <span role="columnheader" className="text-right">
                      Days
                    </span>
                    <span role="columnheader" className="text-right">
                      Last
                    </span>
                    <span role="columnheader" className="text-right">
                      Value
                    </span>
                  </div>
                  {summary.entities.map((e) => (<div key={e.id} role="row" className="grid grid-cols-[minmax(0,1fr)_64px_72px_88px] gap-2 border-b border-line-soft py-2 text-[13px] tabular">
                      <span role="cell" className="truncate">
                        {e.name}
                      </span>
                      <span role="cell" className="text-right">
                        {e.days}
                      </span>
                      <span role="cell" className="text-right text-muted">
                        {isCivilDate(e.lastDate) ? formatShort(e.lastDate) : e.lastDate}
                      </span>
                      <span role="cell" className="text-right">
                        {fmt(format, e.lastObserved)}
                      </span>
                    </div>))}
                </div>) : null}
            </div>) : null}
        </div>

        {error ? (<p role="alert" className="text-[13px] text-crit">
            {error}
          </p>) : null}

        <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-4">
          {existing ? (<Button variant="danger" size="xs" onClick={() => onDelete(existing)}>
              Delete
            </Button>) : null}
          <span className="flex-1"/>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} loading={save.isPending}>
            {d.id ? "Save rule" : "Add rule"}
          </Button>
        </div>
      </div>
    </Drawer>);
}
