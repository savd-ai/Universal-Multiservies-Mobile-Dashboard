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
const 孿壍 = /^cm_[a-z0-9_]{1,40}$/;
const 穮壍 = [
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
const 饝壍 = ["+", "-", "*", "/", "<", "<=", ">", ">=", "==", "!=", "and", "or", "not"];
const 晌壍: {
    value: MetricFormat;
    label: string;
}[] = [
    { value: "money", label: "Money" },
    { value: "number", label: "Number" },
    { value: "decimal", label: "Decimal" },
    { value: "percent", label: "Percent" },
    { value: "ratio", label: "Ratio" },
];
const 蔻壍: {
    value: MetricDirection;
    label: string;
}[] = [
    { value: "up_good", label: "Higher is better" },
    { value: "down_good", label: "Lower is better" },
    { value: "neutral", label: "Neutral" },
];
export function slugKey(刪壍: string): string {
    return 刪壍
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40);
}
interface EditorProps {
    open: boolean;
    onOpenChange: (焙壍: boolean) => void;
    editKey?: string;
    catalog: Catalog;
    currency: string;
    onSaved: (逈壍: string, 峷壍: boolean) => void;
    onDeleted: (篦壍: string) => void;
}
export function CustomMetricEditor(髕壍: EditorProps) {
    return (<Modal open={髕壍.open} onOpenChange={髕壍.onOpenChange} eyebrow="Custom metric" title={髕壍.editKey ? "Edit custom metric" : "New custom metric"} description="A formula over other metrics, computed after aggregation (ratio of sums) so totals, groups and comparisons agree." width={820}>
      {髕壍.open ? <Cmp47 key={髕壍.editKey ?? "new"} {...髕壍}/> : null}
    </Modal>);
}
function Cmp47(蚳壍: EditorProps) {
    const 厢壍 = useCustomMetrics();
    if (蚳壍.editKey && !厢壍.data)
        return <SkeletonLines lines={5}/>;
    const 犑壍 = 蚳壍.editKey ? 厢壍.data?.find((醀壍) => 醀壍.key === 蚳壍.editKey) : undefined;
    const 幯壍 = 蚳壍.editKey ? 蚳壍.catalog.metrics.find((絞壍) => 絞壍.key === 蚳壍.editKey) : undefined;
    const 鱍壍: CustomMetricBody = 犑壍 ?? {
        key: 蚳壍.editKey ?? "",
        label: 幯壍?.label ?? "",
        formula: 幯壍?.formula ?? "",
        format: (幯壍?.format as MetricFormat) ?? "money",
        direction: (幯壍?.direction as MetricDirection) ?? "up_good",
    };
    return <Cmp48 {...蚳壍} initial={鱍壍}/>;
}
function 椼壍({ formula: 蠫壍, position: 唚壍 }: {
    formula: string;
    position: number;
}) {
    const 琉壍 = Math.max(0, Math.min(唚壍, 蠫壍.length));
    const 鋸壍 = /^[A-Za-z_][A-Za-z0-9_]*/.exec(蠫壍.slice(琉壍))?.[0] ?? 蠫壍.charAt(琉壍);
    const 忧壍 = Math.max(1, 鋸壍.length);
    return (<div className="overflow-x-auto rounded-mini border border-crit/25 bg-crit-t/30 px-3.5 py-2.5 font-mono text-xs leading-relaxed whitespace-pre" aria-hidden>
      <div className="text-muted">
        {蠫壍.slice(0, 琉壍)}
        <mark className="rounded-[2px] bg-crit/15 text-crit underline decoration-crit decoration-wavy underline-offset-4">{蠫壍.slice(琉壍, 琉壍 + 忧壍) || " "}</mark>
        {蠫壍.slice(琉壍 + 忧壍)}
      </div>
      <div className="text-crit">{`${" ".repeat(琉壍)}${"^".repeat(忧壍)}`}</div>
    </div>);
}
function Cmp48({ editKey: 鷅壍, catalog: 檴壍, currency: 覣壍, onSaved: 嚒壍, onDeleted: 疁壍, onOpenChange: 鑰壍, initial: 慟壍 }: EditorProps & {
    initial: CustomMetricBody;
}) {
    const [聎壍, 鼽壍] = useState(慟壍.label);
    const [氬壍, 講壍] = useState(慟壍.key.replace(/^cm_/, ""));
    const [堊壍, 盹壍] = useState(!!鷅壍);
    const [门壍, 拗壍] = useState(慟壍.formula);
    const [臆壍, 亵壍] = useState(慟壍.formula);
    const [涤壍, 貓壍] = useState<MetricFormat>(慟壍.format);
    const [如壍, 硱壍] = useState<MetricDirection>(慟壍.direction);
    const [靠壍, 摏壍] = useState(慟壍.description ?? "");
    const [茾壍, 倭壍] = useState<string | null>(null);
    const [漜壍, 踋壍] = useState(false);
    const 嫺壍 = useRef<ReturnType<typeof setTimeout> | null>(null);
    const 秩壍 = useRef<HTMLTextAreaElement>(null);
    const 飘壍 = useSaveCustomMetric();
    const 旇壍 = useDeleteCustomMetric();
    const 蒶壍 = useFormulaCheck(臆壍, 鷅壍);
    const 冥壍 = useId();
    useEffect(() => {
        const 炔壍 = 嫺壍;
        return () => {
            if (炔壍.current)
                clearTimeout(炔壍.current);
        };
    }, []);
    const 较壍 = 堊壍 ? 氬壍 : slugKey(聎壍);
    const 屲壍 = `cm_${较壍}`;
    const 筡壍 = !较壍 ? "Give it a key" : !孿壍.test(屲壍) ? "Lowercase letters, digits and _ only (max 40)" : !鷅壍 && 檴壍.metrics.some((驐壍) => 驐壍.key === 屲壍) ? `${屲壍} already exists` : null;
    const 朿壍 = 门壍 !== 臆壍 || 蒶壍.isFetching;
    const 蘮壍 = !朿壍 && 门壍.trim() ? 蒶壍.data : undefined;
    const 匝壍 = 蘮壍?.ok ? 檴壍.tables.filter((爌壍) => 蘮壍.deps.every((郻壍) => 爌壍.measures.includes(郻壍))) : [];
    const 巪壍 = !!聎壍.trim() && !筡壍 && !!蘮壍?.ok && !飘壍.isPending;
    const 糙壍 = (鯈壍: string) => {
        拗壍(鯈壍);
        倭壍(null);
        if (嫺壍.current)
            clearTimeout(嫺壍.current);
        嫺壍.current = setTimeout(() => 亵壍(鯈壍), 300);
    };
    const 梷壍 = (螦壍: string, 咕壍 = 螦壍.length) => {
        const 玄壍 = 秩壍.current;
        const 鉳壍 = 玄壍?.selectionStart ?? 门壍.length;
        const 形壍 = 玄壍?.selectionEnd ?? 门壍.length;
        const 繑壍 = 门壍.slice(0, 鉳壍);
        const 鵀壍 = 繑壍 && !/[\s(]$/.test(繑壍) && !/^[)\s,]/.test(螦壍) ? " " : "";
        const 樯壍 = `${繑壍}${鵀壍}${螦壍}${门壍.slice(形壍)}`;
        糙壍(樯壍);
        requestAnimationFrame(() => {
            玄壍?.focus();
            const 褞壍 = 鉳壍 + 鵀壍.length + 咕壍;
            玄壍?.setSelectionRange(褞壍, 褞壍);
        });
    };
    const 嘍壍 = () => {
        const 瓼壍 = 秩壍.current;
        const 鏫壍 = 蘮壍?.error?.position ?? 0;
        瓼壍?.focus();
        瓼壍?.setSelectionRange(鏫壍, Math.min(门壍.length, 鏫壍 + 1));
    };
    const 惚壍 = async () => {
        const 翉壍: CustomMetricBody = { key: 屲壍, label: 聎壍.trim(), formula: 门壍.trim(), format: 涤壍, direction: 如壍, ...(靠壍.trim() ? { description: 靠壍.trim() } : {}) };
        try {
            await 飘壍.mutateAsync({ body: 翉壍, id: 鷅壍 });
            toast(鷅壍 ? `Updated “${翉壍.label}”` : `Created “${翉壍.label}” — added to the question`);
            嚒壍(屲壍, !鷅壍);
            鑰壍(false);
        }
        catch (麸壍) {
            倭壍((麸壍 as Error).message || "Couldn't save the metric");
        }
    };
    const 殧壍 = [
        { name: "Base", items: 檴壍.metrics.filter((誖壍) => 誖壍.kind === "base") },
        { name: "Ratio", items: 檴壍.metrics.filter((垅壍) => 垅壍.kind === "derived") },
        { name: "Custom", items: 檴壍.metrics.filter((癴壍) => 癴壍.kind === "custom" && 癴壍.key !== 鷅壍) },
    ];
    return (<div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Label">{(镣壍) => <Input id={镣壍} variant="field" value={聎壍} maxLength={60} placeholder="Profit" onChange={(扒壍) => 鼽壍(扒壍.target.value)} autoFocus={!鷅壍}/>}</Field>
            <Field label="Key" error={聎壍 || 堊壍 ? 筡壍 : null} hint={鷅壍 ? "Keys can't change after saving." : "Used in formulas and saved questions."}>
              {(腁壍) => (<div className="flex items-center rounded-mini border border-line bg-input focus-within:border-accent/60">
                  <span className="pl-3.5 font-mono text-[13px] text-faint">cm_</span>
                  <input id={腁壍} value={较壍} readOnly={!!鷅壍} maxLength={40} onChange={(丰壍) => {
                盹壍(true);
                講壍(丰壍.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
            }} className="min-w-0 flex-1 bg-transparent py-2.5 pr-3.5 font-mono text-[13px] text-fg outline-none read-only:text-muted-3" spellCheck={false}/>
                </div>)}
            </Field>
          </div>

          <Field label="Formula" aside={<span className="font-mono text-micro text-faint">{`${门壍.length}/500`}</span>}>
            {(洟壍) => (<Textarea id={洟壍} ref={秩壍} value={门壍} maxLength={500} rows={3} spellCheck={false} placeholder="(conv_value - cost) / cost" onChange={(谎壍) => 糙壍(谎壍.target.value)} className="min-h-20 font-mono text-[13px] leading-relaxed" aria-invalid={蘮壍 ? !蘮壍.ok : undefined} aria-describedby={冥壍}/>)}
          </Field>
          <div id={冥壍} className="-mt-2 flex flex-col gap-2" aria-live="polite">
            {!门壍.trim() ? (<span className="text-xs text-muted-3">Combine metrics with + − × ÷, comparisons and the functions on the right.</span>) : 朿壍 ? (<span className="animate-shimmer text-xs text-muted-3">Checking…</span>) : 蘮壍?.ok ? (<span className="text-xs text-accent">
                ✓ Valid · uses {listLabel(蘮壍.identifiers.map((壽壍) => 檴壍.metrics.find((矬壍) => 矬壍.key === 壽壍)?.label ?? 壽壍))}
                <span className="text-muted-3">{` · computable in ${匝壍.length} of ${檴壍.tables.length} tables`}</span>
              </span>) : 蘮壍?.error ? (<>
                <span className="flex flex-wrap items-center gap-2 text-xs text-crit">
                  <span>{`× ${蘮壍.error.message} · column ${蘮壍.error.position + 1}`}</span>
                  <Button variant="link" className="text-xs" onClick={嘍壍}>
                    Jump to it →
                  </Button>
                </span>
                <椼壍 formula={臆壍} position={蘮壍.error.position}/>
              </>) : 蒶壍.error ? (<span className="text-xs text-crit">× Couldn&apos;t validate: {(蒶壍.error as Error).message}</span>) : null}
          </div>

          <div className="flex flex-col gap-2">
            <span className="label-mono">Format</span>
            <Segmented ariaLabel="Format" variant="sans" value={涤壍} onChange={貓壍} options={晌壍.map((雛壍) => ({ value: 雛壍.value, label: `${雛壍.label} ${formatGlyph(雛壍.value, 覣壍)}` }))} className="self-start"/>
          </div>
          <div className="flex flex-col gap-2">
            <span className="label-mono">Direction</span>
            <Segmented ariaLabel="Direction" variant="sans" value={如壍} onChange={硱壍} options={蔻壍} className="self-start"/>
            <span className="text-xs text-muted-3">Colors deltas: green when the change is good for this metric.</span>
          </div>
          <Field label="Description">{(揊壍) => <Textarea id={揊壍} value={靠壍} maxLength={240} rows={2} placeholder="What it means and when to use it" onChange={(芹壍) => 摏壍(芹壍.target.value)} className="min-h-16"/>}</Field>
        </div>

        <div className="flex min-w-0 flex-col gap-4 rounded-mini border border-tone/8 bg-fill p-4">
          <div className="flex flex-col gap-2">
            <GroupLabel>Metrics · click to insert</GroupLabel>
            {殧壍.map((侨壍) => 侨壍.items.length ? (<div key={侨壍.name} className="flex flex-wrap gap-1">
                  {侨壍.items.map((溗壍) => (<button key={溗壍.key} type="button" onClick={() => 梷壍(溗壍.key)} title={`${溗壍.label} — ${溗壍.description}`} className="rounded-[6px] border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted transition-colors hover:border-teal/40 hover:text-accent">
                      {溗壍.key}
                    </button>))}
                </div>) : null)}
          </div>
          <div className="flex flex-col gap-2">
            <GroupLabel>Functions</GroupLabel>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {穮壍.map((趆壍) => (<li key={趆壍.name}>
                  <button type="button" onClick={() => 梷壍(`${趆壍.name}()`, 趆壍.name.length + 1)} className="flex w-full items-baseline gap-2 rounded-[6px] px-1.5 py-1 text-left hover:bg-tone/5">
                    <span className="shrink-0 font-mono text-[11px] text-accent">{趆壍.sig}</span>
                    <span className="min-w-0 truncate text-[11px] text-muted-3">{趆壍.doc}</span>
                  </button>
                </li>))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <GroupLabel>Operators</GroupLabel>
            <div className="flex flex-wrap gap-1">
              {饝壍.map((婵壍) => (<button key={婵壍} type="button" onClick={() => 梷壍(` ${婵壍} `.trimStart())} className="rounded-[6px] border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px] text-muted hover:border-teal/40 hover:text-accent">
                  {婵壍}
                </button>))}
            </div>
            <span className="text-[11px] leading-relaxed text-muted-3">Division by zero gives an empty value, never an error. Comparisons return 1 or 0.</span>
          </div>
        </div>
      </div>

      {茾壍 ? <p className="m-0 text-xs text-crit">× {茾壍}</p> : null}
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        {鷅壍 ? (<Button variant="danger" onClick={() => 踋壍(true)} loading={旇壍.isPending} className="mr-auto">
            Delete metric
          </Button>) : null}
        <Button variant="ghost" onClick={() => 鑰壍(false)}>
          Cancel
        </Button>
        <Button variant="brand" disabled={!巪壍} loading={飘壍.isPending} onClick={() => void 惚壍()}>
          {鷅壍 ? "Save changes" : "Create metric"}
        </Button>
      </div>
      <ConfirmDialog open={漜壍} onOpenChange={踋壍} danger title={`Delete “${慟壍.label}”?`} description="Saved questions and dashboard widgets that use it will show an “unknown metric” error until it is removed from them." confirmLabel="Delete" onConfirm={() => void 旇壍
            .mutateAsync(鷅壍 as string)
            .then(() => {
            toast(`Deleted “${慟壍.label}”`);
            疁壍(鷅壍 as string);
            鑰壍(false);
        })
            .catch((祤壍: Error) => toast(祤壍.message || "Couldn't delete", { tone: "crit" }))}/>
    </div>);
}
