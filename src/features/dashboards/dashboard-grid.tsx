"use client";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import type { MenuItem } from "@/components/ui/overlays";
import { Modal } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import type { DashboardBody, GridItem, WidgetInstance } from "@/lib/domain/contracts/dashboard";
import { useMediaQuery } from "@/lib/use-media-query";
import { widgetDef } from "@/features/widgets/registry";
import type { WidgetRuntime } from "@/features/widgets/types";
import { WidgetFrame } from "@/features/widgets/widget-frame";
import { appendItem, cycleSize, moveItem, readingOrder, removeItem } from "./layout-engine";
import { WidgetConfigDrawer } from "./widget-config-drawer";
const RglGrid = dynamic(() => import("./rgl-grid").then((m) => m.RglGrid), { ssr: false });
interface GridProps {
    draft: DashboardBody;
    rt: WidgetRuntime;
    editing: boolean;
    update: (fn: (d: DashboardBody) => DashboardBody, opts?: {
        undoable?: boolean;
    }) => void;
    undo: () => void;
    onRequestEdit: () => void;
    readOnly?: boolean;
}
function UnknownWidget({ type: value }: {
    type: string;
}) {
    return <div className="p-4 text-[13px] text-muted-3">{`Unknown widget type "${value}". It may come from a newer version.`}</div>;
}
function copyId(text: string): string {
    return `${text.slice(0, 10)}-${Math.random().toString(36).slice(2, 7)}`;
}
export function DashboardGrid({ draft, rt, editing, update, undo, onRequestEdit, readOnly }: GridProps) {
    const order = useMemo(() => readingOrder(draft.layout), [draft.layout]);
    const byId = useMemo(() => new Map(draft.widgets.map((w) => [w.id, w])), [draft.widgets]);
    const [grown, setGrown] = useState<Record<string, number>>({});
    const [configId, setConfigId] = useState<string | null>(null);
    const [focusId, setFocusId] = useState<string | null>(null);
    const wide = useMediaQuery("(min-width: 1180px)");
    const [announcement, setAnnouncement] = useState("");
    const setLayout = useCallback((fn: (l: GridItem[]) => GridItem[]) => update((d) => ({ ...d, layout: fn(d.layout) })), [update]);
    const setWidgetConfig = useCallback((id: string, patch: Record<string, unknown>) => update((d) => ({ ...d, widgets: d.widgets.map((w) => (w.id === id ? { ...w, config: { ...w.config, ...patch } } : w)) }), { undoable: false }), [update]);
    const replaceWidget = useCallback((next: WidgetInstance) => update((d) => ({ ...d, widgets: d.widgets.map((w) => (w.id === next.id ? next : w)) })), [update]);
    const grow = useCallback((id: string, rows: number) => setGrown((g) => (g[id] !== undefined && g[id] >= rows ? g : { ...g, [id]: rows })), []);
    const minSizes = useMemo(() => Object.fromEntries(draft.widgets.map((w) => [w.id, widgetDef(w.type)?.minSize])), [draft.widgets]);
    const remove = (inst: WidgetInstance, title: string) => {
        update((d) => ({ ...d, widgets: d.widgets.filter((w) => w.id !== inst.id), layout: removeItem(d.layout, inst.id) }));
        toast(`Removed “${title}”`, { action: { label: "Undo", onClick: undo } });
        setAnnouncement(`${title} removed. Undo is available.`);
    };
    const move = (id: string, title: string, dir: -1 | 1) => {
        const next = moveItem(draft.layout, id, dir);
        setLayout(() => next);
        const pos = readingOrder(next).findIndex((l) => l.i === id) + 1;
        setAnnouncement(`${title} moved to position ${pos} of ${next.length}.`);
    };
    const resize = (id: string, title: string, minW: number) => {
        const next = cycleSize(draft.layout, id, minW);
        setLayout(() => next);
        const w = next.find((l) => l.i === id)?.w ?? 0;
        setAnnouncement(`${title} is now ${w === 12 ? "full width" : `${w} of 12 columns wide`}.`);
    };
    const duplicate = (inst: WidgetInstance, l: GridItem, title: string) => {
        const id = copyId(inst.type);
        update((d) => ({ ...d, widgets: [...d.widgets, { ...structuredClone(inst), id, title: `${title} (copy)` }], layout: appendItem(d.layout, { ...l, i: id }) }));
        toast(`Duplicated “${title}”`, { action: { label: "Undo", onClick: undo } });
    };
    const renderWidget = (inst: WidgetInstance, size: {
        w: number;
        h: number;
    }) => {
        const def = widgetDef(inst.type);
        const Cmp = def?.Component;
        return Cmp ? <Cmp instance={inst} config={{ ...def.defaultConfig, ...inst.config }} rt={rt} size={size} setConfig={(patch) => setWidgetConfig(inst.id, patch)}/> : <UnknownWidget type={inst.type}/>;
    };
    const frame = (l: GridItem, idx: number, mode: "css" | "rgl") => {
        const inst = byId.get(l.i);
        if (!inst)
            return null;
        const def = widgetDef(inst.type);
        const title = inst.title ?? def?.title ?? inst.type;
        const grows = def ? (typeof def.grows === "function" ? def.grows(inst.config as never) : !!def.grows) : false;
        const h = mode === "css" ? Math.max(l.h, grown[l.i] ?? 0) : l.h;
        const menu: MenuItem[] = [
            { label: "Focus", onSelect: () => setFocusId(inst.id), hint: "full screen", separatorBefore: true },
            ...(readOnly
                ? []
                : [
                    { label: "Duplicate", onSelect: () => duplicate(inst, l, title) },
                    { label: "Settings…", onSelect: () => (onRequestEdit(), setConfigId(inst.id)) },
                    { label: "Remove", danger: true, onSelect: () => remove(inst, title) },
                ]),
        ];
        return (<WidgetFrame key={inst.id} id={inst.id} title={title} subtitle={inst.subtitle ?? def?.subtitle} link={def?.link} editing={editing} width={l.w} className={mode === "css" ? "dash-item print-avoid-break" : "h-full w-full"} style={mode === "css" ? { ["--x" as string]: l.x + 1, ["--w" as string]: l.w, ["--h" as string]: h } : undefined} onLeft={idx > 0 ? () => move(inst.id, title, -1) : undefined} onRight={idx < order.length - 1 ? () => move(inst.id, title, 1) : undefined} onSize={() => resize(inst.id, title, def?.minSize?.w ?? 1)} onConfigure={() => setConfigId(inst.id)} onRemove={() => remove(inst, title)} onNeedRows={grows && mode === "css" ? (rows) => grow(inst.id, rows) : undefined} extraMenu={menu} resetKey={`${inst.type}:${JSON.stringify(inst.config)}`}>
        {renderWidget(inst, { w: l.w, h })}
      </WidgetFrame>);
    };
    const focused = focusId ? byId.get(focusId) : undefined;
    const focusedLayout = focusId ? draft.layout.find((l) => l.i === focusId) : undefined;
    return (<>
      {editing && wide ? (<RglGrid layout={order} minSizes={minSizes} onCommit={(l) => setLayout(() => l)} renderItem={(l) => frame(l, order.findIndex((x) => x.i === l.i), "rgl")}/>) : (<div className="dash-grid" data-editing={editing || undefined}>
          {order.map((l, idx) => frame(l, idx, "css"))}
        </div>)}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <WidgetConfigDrawer instance={configId ? (byId.get(configId) ?? null) : null} onClose={() => setConfigId(null)} onChange={replaceWidget}/>
      <Modal open={!!focused} onOpenChange={(o) => !o && setFocusId(null)} eyebrow={focused ? (widgetDef(focused.type)?.category ?? "Widget") : ""} title={focused ? (focused.title ?? widgetDef(focused.type)?.title ?? focused.type) : ""} width={1180}>
        {focused ? <div className="flex h-[68vh] min-h-0 flex-col">{renderWidget(focused, { w: 12, h: Math.max(focusedLayout?.h ?? 20, 28) })}</div> : null}
      </Modal>
    </>);
}
