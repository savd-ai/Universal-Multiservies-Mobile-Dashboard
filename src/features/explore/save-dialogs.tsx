"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented, Switch } from "@/components/ui/controls";
import { SkeletonLines } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/inputs";
import { Modal } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import { useUpdateQuestion } from "@/lib/api/explore";
import { useDashboards, useSaveDashboard, useSaveQuestion } from "@/lib/api/hooks";
import type { SavedQuestion, VizSettings, WidgetInstance } from "@/lib/domain/contracts/dashboard";
import type { DateRangeSpec, QuerySpecInput } from "@/lib/domain/query/spec";
import { querySpecSchema } from "@/lib/domain/query/spec";
import { appendItem } from "@/features/dashboards/layout-engine";
import { bodyOf } from "@/features/dashboards/use-dashboard-draft";
import { dateRangeLabel } from "./describe";
import { widgetQueryFor, type ExploreSpec } from "./notebook-state";
interface SaveQuestionProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    existing?: SavedQuestion;
    defaultName: string;
    query: QuerySpecInput | null;
    viz: VizSettings;
    onSaved: (q: SavedQuestion) => void;
}
export function SaveQuestionDialog(props: SaveQuestionProps) {
    return (<Modal open={props.open} onOpenChange={props.onOpenChange} eyebrow="Saved questions" title={props.existing ? "Save question" : "Save as a question"} description="Saved questions keep the metrics, breakdowns, filters, date range and chart. Open them again from Saved questions." width={480}>
      {props.open ? <SaveQuestionForm key={props.existing?.id ?? "new"} {...props}/> : null}
    </Modal>);
}
function SaveQuestionForm({ existing, defaultName, query, viz, onSaved, onOpenChange }: SaveQuestionProps) {
    const [name, setName] = useState(existing?.name ?? defaultName);
    const [description, setDescription] = useState(existing?.description ?? "");
    const [mode, setMode] = useState<"update" | "new">(existing ? "update" : "new");
    const [error, setError] = useState<string | null>(null);
    const create = useSaveQuestion();
    const update = useUpdateQuestion();
    const busy = create.isPending || update.isPending;
    const submit = async () => {
        const parsed = querySpecSchema.safeParse(query);
        if (!parsed.success)
            return setError("The question needs at least one metric.");
        const body = { name: name.trim(), description: description.trim() || undefined, query: parsed.data, viz, origin: existing?.origin ?? ("explore" as const) };
        try {
            const saved = existing && mode === "update" ? await update.mutateAsync({ id: existing.id, body }) : await create.mutateAsync({ ...body, origin: "explore" });
            toast(existing && mode === "update" ? `Saved changes to “${saved.name}”` : `Saved “${saved.name}”`);
            onSaved(saved);
            onOpenChange(false);
        }
        catch (e) {
            setError((e as Error).message || "Couldn't save the question");
        }
    };
    return (<form className="flex flex-col gap-4" onSubmit={(e) => {
            e.preventDefault();
            void submit();
        }}>
      {existing ? (<Segmented ariaLabel="Save mode" variant="sans" fill value={mode} onChange={setMode} options={[
                { value: "update", label: `Replace “${existing.name.length > 28 ? `${existing.name.slice(0, 27)}…` : existing.name}”` },
                { value: "new", label: "Save as new" },
            ]}/>) : null}
      <Field label="Name">{(id) => <Input id={id} variant="field" value={name} maxLength={120} required autoFocus onChange={(e) => setName(e.target.value)}/>}</Field>
      <Field label="Description" hint="Optional — what it answers and for whom.">
        {(id) => <Textarea id={id} value={description} maxLength={400} rows={3} onChange={(e) => setDescription(e.target.value)} className="min-h-20"/>}
      </Field>
      {error ? <p className="m-0 text-xs text-crit">× {error}</p> : null}
      <div className="flex justify-end gap-2.5">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" variant="brand" disabled={!name.trim() || !query} loading={busy}>
          Save
        </Button>
      </div>
    </form>);
}
const WIDGET_SIZE: Record<string, {
    w: number;
    h: number;
}> = {
    "kpi-strip": { w: 12, h: 10 },
    number: { w: 3, h: 8 },
    table: { w: 12, h: 16 },
    heatmap: { w: 6, h: 20 },
    "trend-multiples": { w: 8, h: 17 },
    "stacked-bar": { w: 7, h: 18 },
};
interface SaveToDashboardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    spec: ExploreSpec;
    viz: VizSettings;
    defaultTitle: string;
    defaultSubtitle: string;
    pageRange: DateRangeSpec;
}
export function SaveToDashboardDialog(props: SaveToDashboardProps) {
    return (<Modal open={props.open} onOpenChange={props.onOpenChange} eyebrow="Dashboards" title="Add to dashboard" description="Appends this question as a widget at the end of the dashboard. Dashboard slicers and cross-filters apply to it like any other Question widget." width={500}>
      {props.open ? <SaveToDashboardForm {...props}/> : null}
    </Modal>);
}
function SaveToDashboardForm({ spec, viz, defaultTitle, defaultSubtitle, pageRange, onOpenChange }: SaveToDashboardProps) {
    const router = useRouter();
    const dashboards = useDashboards();
    const save = useSaveDashboard();
    const list = dashboards.data ?? [];
    const [picked, setPicked] = useState<string | null>(null);
    const dashboardId = picked ?? list.find((d) => d.isDefault)?.id ?? list[0]?.id ?? "";
    const [title, setTitle] = useState(defaultTitle);
    const [subtitle, setSubtitle] = useState(defaultSubtitle);
    const [pin, setPin] = useState(!!spec.dateRange && "start" in spec.dateRange);
    const [error, setError] = useState<string | null>(null);
    const range = spec.dateRange ?? pageRange;
    if (!dashboards.data)
        return <SkeletonLines lines={4}/>;
    const target = list.find((d) => d.id === dashboardId);
    const full = !!target && target.widgets.length >= 60;
    const submit = async () => {
        if (!target)
            return;
        const id = `q-${Math.random().toString(36).slice(2, 8)}`;
        const size = WIDGET_SIZE[viz.type] ?? { w: 6, h: 16 };
        const inst: WidgetInstance = { id, type: "question", title: title.trim() || defaultTitle, subtitle: subtitle.trim() || undefined, config: { preset: "explore", query: widgetQueryFor(spec, pin ? range : null), viz } };
        const doc = { ...bodyOf(target), widgets: [...target.widgets, inst], layout: appendItem(target.layout, { i: id, x: 0, y: 0, ...size }) };
        try {
            await save.mutateAsync({ id: target.id, doc, version: target.version });
            toast(`Added “${inst.title}” to ${target.name}`, { action: { label: "Open", onClick: () => router.push(`/overview/${target.id}`) }, ms: 6000 });
            onOpenChange(false);
        }
        catch (e) {
            setError(e instanceof ApiError && e.status === 409 ? "The dashboard changed elsewhere — try again." : (e as Error).message || "Couldn't update the dashboard");
        }
    };
    return (<form className="flex flex-col gap-4" onSubmit={(e) => {
            e.preventDefault();
            void submit();
        }}>
      <Field label="Dashboard" error={full ? "This dashboard is full (60 widgets)." : null}>
        {(id) => (<Select id={id} value={dashboardId} onChange={(e) => setPicked(e.target.value)}>
            {list.map((d) => (<option key={d.id} value={d.id}>
                {`${d.name}${d.isDefault ? " (default)" : ""} · ${d.widgets.length} widgets`}
              </option>))}
          </Select>)}
      </Field>
      <Field label="Widget title">{(id) => <Input id={id} variant="field" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)}/>}</Field>
      <Field label="Subtitle">{(id) => <Input id={id} variant="field" value={subtitle} maxLength={160} onChange={(e) => setSubtitle(e.target.value)}/>}</Field>
      <div className="flex flex-col gap-1.5 rounded-mini border border-tone/8 bg-fill p-3.5">
        <Switch checked={pin} onChange={setPin} label={`Pin the date range (${dateRangeLabel(range)})`}/>
        <span className="pl-[42px] text-xs text-muted-3">{pin ? "The widget always shows this range." : "Off: the widget follows the dashboard's date range."}</span>
      </div>
      {error ? <p className="m-0 text-xs text-crit">× {error}</p> : null}
      <div className="flex justify-end gap-2.5">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" variant="brand" disabled={!target || full} loading={save.isPending}>
          Add widget
        </Button>
      </div>
    </form>);
}
