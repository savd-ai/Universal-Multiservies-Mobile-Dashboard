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
const 悻壍: {
    value: Severity;
    label: string;
}[] = [
    { value: "critical", label: "Critical" },
    { value: "warning", label: "Warning" },
    { value: "info", label: "Info" },
];
function 羪壍({ severity: 麙壍 }: {
    severity: Severity;
}) {
    return <Pill tone={SEVERITY_META[麙壍].tone}>{麙壍 === "info" ? "Info" : SEVERITY_META[麙壍].label}</Pill>;
}
function Cmp12() {
    const 詷壍 = useCatalog();
    return useMemo(() => {
        const 坦壍 = (詷壍.data?.metrics ?? []).filter((癕壍) => 癕壍.availableIn.includes("campaign_daily"));
        const 镄壍 = new Map<string, MetricMeta & {
            label: string;
        }>(坦壍.map((戳壍) => [戳壍.key, { short: 戳壍.short, format: 戳壍.format, label: 戳壍.label }]));
        return { list: 坦壍, meta: 镄壍, loading: !詷壍.data };
    }, [詷壍.data]);
}
export function ThresholdRulesCard() {
    const 脢壍 = useThresholdRules();
    const 丑壍 = useCampaignOptions();
    const 洀壍 = Cmp12();
    const { currency: 误壍 } = useValueFormat();
    const 壞壍 = useSaveThresholdRule();
    const 矍壍 = useDeleteThresholdRule();
    const [隼壍, 掫壍] = useState<RuleDraft | null>(null);
    const [芚壍, 侉壍] = useState<ThresholdRule | null>(null);
    const 湸壍 = useMemo(() => new Map((丑壍.data ?? []).map((赧壍) => [赧壍.id, 赧壍.name])), [丑壍.data]);
    const 婖壍 = (祅壍: string): MetricFormat => 洀壍.meta.get(祅壍)?.format ?? "number";
    const 頴壍 = (攣壍: ThresholdRule) => 掫壍(draftFromRule(攣壍, 婖壍(攣壍.metric)));
    const 萒壍 = (儁壍: ThresholdRule) => 掫壍({ ...draftFromRule(儁壍, 婖壍(儁壍.metric)), id: undefined, name: `${儁壍.name} (copy)`.slice(0, 80) });
    const 濰壍 = (軟壍: ThresholdRule, 寎壍: boolean) => 壞壍.mutate({ id: 軟壍.id, rule: { ...軟壍, enabled: 寎壍 } }, { onSuccess: () => toast(寎壍 ? `“${軟壍.name}” is on` : `“${軟壍.name}” is off`), onError: (窽壍) => toast(窽壍.message || "Couldn't update the rule", { tone: "crit" }) });
    const 馬壍: Column<ThresholdRule>[] = [
        {
            key: "name",
            header: "Rule",
            width: "minmax(160px,1.5fr)",
            sortValue: (暛壍) => 暛壍.name.toLowerCase(),
            cell: (薊壍) => <span className={薊壍.enabled ? "font-semibold" : "font-semibold text-muted-3"}>{薊壍.name}</span>,
        },
        { key: "condition", header: "Condition", width: "minmax(150px,1.3fr)", cell: (剹壍) => <span className="font-mono text-meta">{describeRuleCondition(剹壍, 洀壍.meta.get(剹壍.metric), 误壍)}</span> },
        { key: "window", header: "Window", width: "minmax(140px,1.2fr)", cell: (煨壍) => <span className="text-muted">{describeRuleWindow(煨壍)}</span> },
        { key: "scope", header: "Scope", width: "minmax(120px,1fr)", cell: (遗壍) => <span className="block truncate text-muted">{describeRuleScope(遗壍, 湸壍)}</span> },
        { key: "severity", header: "Severity", width: "100px", sortValue: (嵆壍) => (嵆壍.severity === "critical" ? 3 : 嵆壍.severity === "warning" ? 2 : 1), cell: (簵壍) => <羪壍 severity={簵壍.severity}/> },
        {
            key: "enabled",
            header: "On",
            width: "56px",
            cell: (鬤壍) => (<span onClick={(栓壍) => 栓壍.stopPropagation()}>
          <Switch checked={鬤壍.enabled} onChange={(蜂壍) => 濰壍(鬤壍, 蜂壍)} ariaLabel={`${鬤壍.enabled ? "Turn off" : "Turn on"} ${鬤壍.name}`}/>
        </span>),
        },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            width: "40px",
            align: "right",
            cell: (叱壍) => (<span onClick={(狠壍) => 狠壍.stopPropagation()}>
          <Menu trigger={<IconButton label={`More for ${叱壍.name}`}>⋯</IconButton>} items={[
                    { label: "Edit", onSelect: () => 頴壍(叱壍) },
                    { label: "Duplicate", onSelect: () => 萒壍(叱壍) },
                    { label: "Delete", danger: true, separatorBefore: true, onSelect: () => 侉壍(叱壍) },
                ]}/>
        </span>),
        },
    ];
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Threshold rules" sub="Fixed limits on any daily metric — they fire alongside the statistical detectors" action={<Button variant="accent" size="xs" onClick={() => 掫壍(newRuleDraft())} disabled={洀壍.loading}>
            + New rule
          </Button>}/>
      {脢壍.error ? <ErrorState error={脢壍.error} onRetry={() => void 脢壍.refetch()}/> : null}
      {!脢壍.data && !脢壍.error ? <SkeletonLines lines={4}/> : null}
      {脢壍.data ? (<DataTable ariaLabel="Threshold rules" rows={脢壍.data} columns={馬壍} rowKey={(量壍) => 量壍.id} onRowClick={頴壍} minWidth={760} empty={<span>
              No threshold rules yet. Add one to alert on fixed limits — for example CPA above {currencySymbol(误壍).trim()}40 for 3 days, or conversions down 30% week over week.
            </span>}/>) : null}

      {隼壍 ? <Cmp13 key={隼壍.id ?? "new"} initial={隼壍} metrics={洀壍} onClose={() => 掫壍(null)} onDelete={(庾壍) => 侉壍(庾壍)} existing={脢壍.data?.find((維壍) => 維壍.id === 隼壍.id)}/> : null}

      <ConfirmDialog open={!!芚壍} onOpenChange={(鲜壍) => !鲜壍 && 侉壍(null)} title="Delete this rule?" description={芚壍 ? `“${芚壍.name}” stops firing and its open signals disappear at the next evaluation.` : undefined} confirmLabel="Delete rule" danger onConfirm={() => {
            const 榋壍 = 芚壍;
            if (!榋壍)
                return;
            矍壍.mutate(榋壍.id, {
                onSuccess: () => {
                    toast(`Deleted “${榋壍.name}”`);
                    掫壍((衺壍) => (衺壍?.id === 榋壍.id ? null : 衺壍));
                },
                onError: (啩壍) => toast(啩壍.message || "Couldn't delete the rule", { tone: "crit" }),
            });
        }}/>
    </Card>);
}
interface RuleEditorProps {
    initial: RuleDraft;
    existing?: ThresholdRule;
    metrics: ReturnType<typeof Cmp12>;
    onClose: () => void;
    onDelete: (瑘壍: ThresholdRule) => void;
}
function Cmp13({ initial: 怶壍, existing: 缥壍, metrics: 鸔壍, onClose: 欃壍, onDelete: 觲壍 }: RuleEditorProps) {
    const [囡壍, 痐壍] = useState<RuleDraft>(怶壍);
    const [钿壍, 憮壍] = useState<string | null>(null);
    const { fmt: 肝壍, currency: 龌壍 } = useValueFormat();
    const 汻壍 = useCampaignOptions();
    const 譪壍 = useSaveThresholdRule();
    const 塙壍 = useRulePreview();
    const [睈壍, 阷壍] = useState<string | null>(null);
    const 挦壍: MetricFormat = 鸔壍.meta.get(囡壍.metric)?.format ?? "number";
    const 舕壍 = ruleFromDraft(囡壍, 挦壍);
    const 伄壍 = 舕壍.ok ? JSON.stringify(舕壍.rule) : null;
    const 淳壍 = !!塙壍.data && 睈壍 !== 伄壍;
    const 賢壍 = 塙壍.data ? summarizeRulePreview(塙壍.data) : null;
    const 姑壍 = (磀壍: Partial<RuleDraft>) => {
        痐壍((鞯壍) => ({ ...鞯壍, ...磀壍 }));
        憮壍(null);
    };
    const 撞壍 = () => {
        if (!舕壍.ok)
            return 憮壍(舕壍.error);
        阷壍(伄壍);
        塙壍.mutate({ rule: 舕壍.rule, days: 30 });
    };
    const 莍壍 = () => {
        if (!舕壍.ok)
            return 憮壍(舕壍.error);
        譪壍.mutate({ id: 囡壍.id, rule: 舕壍.rule }, {
            onSuccess: (偼壍) => {
                toast(囡壍.id ? `Saved “${偼壍.name}”` : `Added “${偼壍.name}”`);
                欃壍();
            },
            onError: (潫壍) => 憮壍(潫壍.message || "Couldn't save the rule"),
        });
    };
    const 蹚壍 = 賢壍 ? Math.max(1, ...賢壍.perDay.map((孉壍) => 孉壍.count)) : 1;
    const 稸壍 = ruleValueUnit(囡壍.op, 挦壍, currencySymbol(龌壍));
    return (<Drawer open onOpenChange={(餧壍) => !餧壍 && 欃壍()} eyebrow="Threshold rule" title={囡壍.id ? "Edit rule" : "New rule"} width={520}>
      <div className="flex flex-col gap-[18px]">
        <Field label="Name">{(昖壍) => <Input id={昖壍} variant="field" value={囡壍.name} maxLength={80} onChange={(蔅壍) => 姑壍({ name: 蔅壍.target.value })} placeholder="CPA ceiling — Search" autoFocus/>}</Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Metric">
            {(凴壍) => (<Select id={凴壍} value={囡壍.metric} onChange={(烣壍) => 姑壍({ metric: 烣壍.target.value, valueInput: "" })}>
                {鸔壍.list.map((迒壍) => (<option key={迒壍.key} value={迒壍.key}>
                    {迒壍.label}
                  </option>))}
              </Select>)}
          </Field>
          <Field label="Condition">
            {(峁壍) => (<Select id={峁壍} value={囡壍.op} onChange={(箰壍) => 姑壍({ op: 箰壍.target.value as RuleOp, valueInput: "" })}>
                {RULE_OPS.map((骟壍) => (<option key={骟壍.value} value={骟壍.value}>
                    {骟壍.label}
                  </option>))}
              </Select>)}
          </Field>
        </div>

        <Field label={囡壍.op.startsWith("change") ? "Change vs the previous period" : "Threshold"} hint={囡壍.op === "change_pct_lt" ? "Use a negative number for drops, e.g. −30 fires when the metric falls more than 30%." : 挦壍 === "percent" ? "In percent, e.g. 1.5 = 1.5%." : undefined}>
          {(枎壍) => (<span className="flex items-center gap-2">
              {稸壍 && 稸壍 !== "%" && 稸壍 !== "×" ? <span className="font-mono text-meta text-faint">{稸壍}</span> : null}
              <Input id={枎壍} variant="field" inputMode="decimal" value={囡壍.valueInput} onChange={(虽壍) => 姑壍({ valueInput: 虽壍.target.value })} placeholder={囡壍.op.startsWith("change") ? (囡壍.op === "change_pct_lt" ? "-30" : "30") : "40"} className="w-36 tabular"/>
              {稸壍 === "%" || 稸壍 === "×" ? <span className="font-mono text-meta text-faint">{稸壍}</span> : null}
            </span>)}
        </Field>

        <div className="flex flex-col gap-2">
          <span className="label-mono">Window</span>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented ariaLabel="Window kind" variant="sans" value={囡壍.windowKind} onChange={(卬壍) => 姑壍({ windowKind: 卬壍 })} options={[
            { value: "last_n_days", label: "Last N days combined" },
            { value: "consecutive_days", label: "N consecutive days" },
        ]}/>
            <NumberInput value={囡壍.days} onChange={(牛壍) => 姑壍({ days: 牛壍 })} min={1} max={30} step={1} suffix="days" ariaLabel="Window length in days"/>
          </div>
          <span className="text-xs text-muted-3">{describeRuleWindow({ op: 囡壍.op, window: { kind: 囡壍.windowKind, days: Number.isFinite(囡壍.days) ? 囡壍.days : 1 } })}</span>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="label-mono">Scope</span>
          <Segmented ariaLabel="Scope" variant="sans" value={囡壍.level} onChange={(酊壍) => 姑壍({ level: 酊壍 })} options={[
            { value: "campaign", label: "Each campaign" },
            { value: "account", label: "Account total" },
        ]}/>
          {囡壍.level === "campaign" ? (<>
              <ToggleChips ariaLabel="Campaign types" options={CAMPAIGN_TYPES.filter((帹壍) => 帹壍 !== "Other").map((紨壍) => ({ value: 紨壍, label: 紨壍 }))} value={囡壍.campaignTypes} onChange={(鰗壍) => 姑壍({ campaignTypes: 鰗壍 })}/>
              <CampaignChecklist campaigns={汻壍.data} value={囡壍.campaignIds} onChange={(椆壍) => 姑壍({ campaignIds: 椆壍 })} label="Rule campaigns" emptyLabel="All campaigns (of the selected types)"/>
            </>) : (<span className="text-xs text-muted-3">Evaluated on the account-wide daily total.</span>)}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span className="label-mono">Severity</span>
            <Segmented ariaLabel="Severity" variant="sans" value={囡壍.severity} onChange={(蟵壍) => 姑壍({ severity: 蟵壍 })} options={悻壍}/>
          </div>
          <Switch checked={囡壍.enabled} onChange={(哤壍) => 姑壍({ enabled: 哤壍 })} label={囡壍.enabled ? "Enabled" : "Disabled"}/>
        </div>

        {舕壍.ok ? (<p className="rounded-mini border border-teal/30 bg-teal/6 px-3.5 py-3 text-[13px] leading-relaxed text-muted">
            <span className="text-fg">Fires when </span>
            {`${describeRuleCondition(舕壍.rule, 鸔壍.meta.get(囡壍.metric), 龌壍)} · ${describeRuleWindow(舕壍.rule)} · ${describeRuleScope(舕壍.rule, new Map((汻壍.data ?? []).map((珓壍) => [珓壍.id, 珓壍.name])))}`}
          </p>) : null}

        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="xs" onClick={撞壍} loading={塙壍.isPending}>
              Preview last 30 days
            </Button>
            {淳壍 ? <span className="text-xs text-muted-3">The rule changed — preview again.</span> : null}
          </div>
          {塙壍.error ? <ErrorState error={塙壍.error} compact/> : null}
          {賢壍 ? (<div className={淳壍 ? "flex flex-col gap-3 opacity-60" : "flex flex-col gap-3"}>
              <span className="text-[13px]">
                {賢壍.totalHits ? (<>
                    Would have fired on <span className="font-semibold">{賢壍.firedDays}</span> of {賢壍.windowDays} days · {賢壍.totalHits} hit{賢壍.totalHits === 1 ? "" : "s"} across {賢壍.entities.length} {囡壍.level === "account" ? "account" : `campaign${賢壍.entities.length === 1 ? "" : "s"}`}
                  </>) : (`Wouldn't have fired in the last ${賢壍.windowDays} days — loosen the threshold to catch more.`)}
              </span>
              <div className="flex h-10 items-end gap-[2px]" role="img" aria-label={`Hits per day over the last ${賢壍.windowDays} days`}>
                {賢壍.perDay.map((鋂壍) => (<span key={鋂壍.date} title={`${isCivilDate(鋂壍.date) ? formatShort(鋂壍.date) : 鋂壍.date}: ${鋂壍.count} hit${鋂壍.count === 1 ? "" : "s"}`} className="min-w-0 flex-1 rounded-t-[2px]" style={{ height: 鋂壍.count ? `${Math.max(12, (鋂壍.count / 蹚壍) * 100)}%` : "2px", background: 鋂壍.count ? `var(--${SEVERITY_META[囡壍.severity].tone === "accent" ? "accent" : SEVERITY_META[囡壍.severity].tone})` : "rgba(var(--fg-rgb),0.12)" }}/>))}
              </div>
              {賢壍.entities.length ? (<div role="table" aria-label="Campaigns that would fire" className="flex flex-col">
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
                  {賢壍.entities.map((徱壍) => (<div key={徱壍.id} role="row" className="grid grid-cols-[minmax(0,1fr)_64px_72px_88px] gap-2 border-b border-line-soft py-2 text-[13px] tabular">
                      <span role="cell" className="truncate">
                        {徱壍.name}
                      </span>
                      <span role="cell" className="text-right">
                        {徱壍.days}
                      </span>
                      <span role="cell" className="text-right text-muted">
                        {isCivilDate(徱壍.lastDate) ? formatShort(徱壍.lastDate) : 徱壍.lastDate}
                      </span>
                      <span role="cell" className="text-right">
                        {肝壍(挦壍, 徱壍.lastObserved)}
                      </span>
                    </div>))}
                </div>) : null}
            </div>) : null}
        </div>

        {钿壍 ? (<p role="alert" className="text-[13px] text-crit">
            {钿壍}
          </p>) : null}

        <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-4">
          {缥壍 ? (<Button variant="danger" size="xs" onClick={() => 觲壍(缥壍)}>
              Delete
            </Button>) : null}
          <span className="flex-1"/>
          <Button variant="ghost" onClick={欃壍}>
            Cancel
          </Button>
          <Button variant="accent" onClick={莍壍} loading={譪壍.isPending}>
            {囡壍.id ? "Save rule" : "Add rule"}
          </Button>
        </div>
      </div>
    </Drawer>);
}
