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
    onOpenChange: (欋壍: boolean) => void;
    existing?: SavedQuestion;
    defaultName: string;
    query: QuerySpecInput | null;
    viz: VizSettings;
    onSaved: (觺壍: SavedQuestion) => void;
}
export function SaveQuestionDialog(囩壍: SaveQuestionProps) {
    return (<Modal open={囩壍.open} onOpenChange={囩壍.onOpenChange} eyebrow="Saved questions" title={囩壍.existing ? "Save question" : "Save as a question"} description="Saved questions keep the metrics, breakdowns, filters, date range and chart. Open them again from Saved questions." width={480}>
      {囩壍.open ? <Cmp50 key={囩壍.existing?.id ?? "new"} {...囩壍}/> : null}
    </Modal>);
}
function Cmp50({ existing: 铇壍, defaultName: 憶壍, query: 肥壍, viz: 龔壍, onSaved: 沃壍, onOpenChange: 譲壍 }: SaveQuestionProps) {
    const [塡壍, 睐壍] = useState(铇壍?.name ?? 憶壍);
    const [阿壍, 挮壍] = useState(铇壍?.description ?? "");
    const [舝壍, 伌壍] = useState<"update" | "new">(铇壍 ? "update" : "new");
    const [添壍, 質壍] = useState<string | null>(null);
    const 姙壍 = useSaveQuestion();
    const 磈壍 = useUpdateQuestion();
    const 鞷壍 = 姙壍.isPending || 磈壍.isPending;
    const 撦壍 = async () => {
        const 莕壍 = querySpecSchema.safeParse(肥壍);
        if (!莕壍.success)
            return 質壍("The question needs at least one metric.");
        const 傄壍 = { name: 塡壍.trim(), description: 阿壍.trim() || undefined, query: 莕壍.data, viz: 龔壍, origin: 铇壍?.origin ?? ("explore" as const) };
        try {
            const 潳壍 = 铇壍 && 舝壍 === "update" ? await 磈壍.mutateAsync({ id: 铇壍.id, body: 傄壍 }) : await 姙壍.mutateAsync({ ...傄壍, origin: "explore" });
            toast(铇壍 && 舝壍 === "update" ? `Saved changes to “${潳壍.name}”` : `Saved “${潳壍.name}”`);
            沃壍(潳壍);
            譲壍(false);
        }
        catch (蹢壍) {
            質壍((蹢壍 as Error).message || "Couldn't save the question");
        }
    };
    return (<form className="flex flex-col gap-4" onSubmit={(孑壍) => {
            孑壍.preventDefault();
            void 撦壍();
        }}>
      {铇壍 ? (<Segmented ariaLabel="Save mode" variant="sans" fill value={舝壍} onChange={伌壍} options={[
                { value: "update", label: `Replace “${铇壍.name.length > 28 ? `${铇壍.name.slice(0, 27)}…` : 铇壍.name}”` },
                { value: "new", label: "Save as new" },
            ]}/>) : null}
      <Field label="Name">{(穀壍) => <Input id={穀壍} variant="field" value={塡壍} maxLength={120} required autoFocus onChange={(餯壍) => 睐壍(餯壍.target.value)}/>}</Field>
      <Field label="Description" hint="Optional — what it answers and for whom.">
        {(昞壍) => <Textarea id={昞壍} value={阿壍} maxLength={400} rows={3} onChange={(蔍壍) => 挮壍(蔍壍.target.value)} className="min-h-20"/>}
      </Field>
      {添壍 ? <p className="m-0 text-xs text-crit">× {添壍}</p> : null}
      <div className="flex justify-end gap-2.5">
        <Button variant="ghost" onClick={() => 譲壍(false)}>
          Cancel
        </Button>
        <Button type="submit" variant="brand" disabled={!塡壍.trim() || !肥壍} loading={鞷壍}>
          Save
        </Button>
      </div>
    </form>);
}
const 凼壍: Record<string, {
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
    onOpenChange: (烫壍: boolean) => void;
    spec: ExploreSpec;
    viz: VizSettings;
    defaultTitle: string;
    defaultSubtitle: string;
    pageRange: DateRangeSpec;
}
export function SaveToDashboardDialog(迚壍: SaveToDashboardProps) {
    return (<Modal open={迚壍.open} onOpenChange={迚壍.onOpenChange} eyebrow="Dashboards" title="Add to dashboard" description="Appends this question as a widget at the end of the dashboard. Dashboard slicers and cross-filters apply to it like any other Question widget." width={500}>
      {迚壍.open ? <Cmp51 {...迚壍}/> : null}
    </Modal>);
}
function Cmp51({ spec: 箸壍, viz: 骧壍, defaultTitle: 枖壍, defaultSubtitle: 蚅壍, pageRange: 却壍, onOpenChange: 牣壍 }: SaveToDashboardProps) {
    const 酒壍 = useRouter();
    const 幁壍 = useDashboards();
    const 細壍 = useSaveDashboard();
    const 鰟壍 = 幁壍.data ?? [];
    const [椎壍, 蟽壍] = useState<string | null>(null);
    const 哬壍 = 椎壍 ?? 鰟壍.find((珛壍) => 珛壍.isDefault)?.id ?? 鰟壍[0]?.id ?? "";
    const [鋊壍, 徹壍] = useState(枖壍);
    const [纨壍, 鶗壍] = useState(蚅壍);
    const [檆壍, 襵壍] = useState(!!箸壍.dateRange && "start" in 箸壍.dateRange);
    const [噤壍, 畓壍] = useState<string | null>(null);
    const 鑂壍 = 箸壍.dateRange ?? 却壍;
    if (!幁壍.data)
        return <SkeletonLines lines={4}/>;
    const 愱壍 = 鰟壍.find((耠壍) => 耠壍.id === 哬壍);
    const 鼏壍 = !!愱壍 && 愱壍.widgets.length >= 60;
    const 毾壍 = async () => {
        if (!愱壍)
            return;
        const 諭壍 = `q-${Math.random().toString(36).slice(2, 8)}`;
        const 埜壍 = 凼壍[骧壍.type] ?? { w: 6, h: 16 };
        const 盋壍: WidgetInstance = { id: 諭壍, type: "question", title: 鋊壍.trim() || 枖壍, subtitle: 纨壍.trim() || undefined, config: { preset: "explore", query: widgetQueryFor(箸壍, 檆壍 ? 鑂壍 : null), viz: 骧壍 } };
        const 閺壍 = { ...bodyOf(愱壍), widgets: [...愱壍.widgets, 盋壍], layout: appendItem(愱壍.layout, { i: 諭壍, x: 0, y: 0, ...埜壍 }) };
        try {
            await 細壍.mutateAsync({ id: 愱壍.id, doc: 閺壍, version: 愱壍.version });
            toast(`Added “${盋壍.title}” to ${愱壍.name}`, { action: { label: "Open", onClick: () => 酒壍.push(`/overview/${愱壍.id}`) }, ms: 6000 });
            牣壍(false);
        }
        catch (抩壍) {
            畓壍(抩壍 instanceof ApiError && 抩壍.status === 409 ? "The dashboard changed elsewhere — try again." : (抩壍 as Error).message || "Couldn't update the dashboard");
        }
    };
    return (<form className="flex flex-col gap-4" onSubmit={(膘壍) => {
            膘壍.preventDefault();
            void 毾壍();
        }}>
      <Field label="Dashboard" error={鼏壍 ? "This dashboard is full (60 widgets)." : null}>
        {(亇壍) => (<Select id={亇壍} value={哬壍} onChange={(浶壍) => 蟽壍(浶壍.target.value)}>
            {鰟壍.map((豥壍) => (<option key={豥壍.id} value={豥壍.id}>
                {`${豥壍.name}${豥壍.isDefault ? " (default)" : ""} · ${豥壍.widgets.length} widgets`}
              </option>))}
          </Select>)}
      </Field>
      <Field label="Widget title">{(奔壍) => <Input id={奔壍} variant="field" value={鋊壍} maxLength={120} onChange={(硃壍) => 徹壍(硃壍.target.value)}/>}</Field>
      <Field label="Subtitle">{(露壍) => <Input id={露壍} variant="field" value={纨壍} maxLength={160} onChange={(搡壍) => 鶗壍(搡壍.target.value)}/>}</Field>
      <div className="flex flex-col gap-1.5 rounded-mini border border-tone/8 bg-fill p-3.5">
        <Switch checked={檆壍} onChange={襵壍} label={`Pin the date range (${dateRangeLabel(鑂壍)})`}/>
        <span className="pl-[42px] text-xs text-muted-3">{檆壍 ? "The widget always shows this range." : "Off: the widget follows the dashboard's date range."}</span>
      </div>
      {噤壍 ? <p className="m-0 text-xs text-crit">× {噤壍}</p> : null}
      <div className="flex justify-end gap-2.5">
        <Button variant="ghost" onClick={() => 牣壍(false)}>
          Cancel
        </Button>
        <Button type="submit" variant="brand" disabled={!愱壍 || 鼏壍} loading={細壍.isPending}>
          Add widget
        </Button>
      </div>
    </form>);
}
