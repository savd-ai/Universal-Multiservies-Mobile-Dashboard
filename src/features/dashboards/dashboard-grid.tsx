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
const 蚡壍 = dynamic(() => import("./rgl-grid").then((厐壍) => 厐壍.RglGrid), { ssr: false });
interface GridProps {
    draft: DashboardBody;
    rt: WidgetRuntime;
    editing: boolean;
    update: (牿壍: (酮壍: DashboardBody) => DashboardBody, 幝壍?: {
        undoable?: boolean;
    }) => void;
    undo: () => void;
    onRequestEdit: () => void;
    readOnly?: boolean;
}
function 経壍({ type: 鰻壍 }: {
    type: string;
}) {
    return <div className="p-4 text-[13px] text-muted-3">{`Unknown widget type "${鰻壍}". It may come from a newer version.`}</div>;
}
function 椪壍(蠙壍: string): string {
    return `${蠙壍.slice(0, 10)}-${Math.random().toString(36).slice(2, 7)}`;
}
export function DashboardGrid({ draft: 唈壍, rt: 珷壍, editing: 鋦壍, update: 忕壍, undo: 组壍, onRequestEdit: 鶳壍, readOnly: 檢壍 }: GridProps) {
    const 覑壍 = useMemo(() => readingOrder(唈壍.layout), [唈壍.layout]);
    const 嚀壍 = useMemo(() => new Map(唈壍.widgets.map((畯壍) => [畯壍.id, 畯壍])), [唈壍.widgets]);
    const [鑞壍, 慍壍] = useState<Record<string, number>>({});
    const [耼壍, 鼫壍] = useState<string | null>(null);
    const [氚壍, 謉壍] = useState<string | null>(null);
    const 埸壍 = useMediaQuery("(min-width: 1180px)");
    const [盧壍, 闖壍] = useState("");
    const 担壍 = useCallback((膴壍: (亣壍: GridItem[]) => GridItem[]) => 忕壍((涒壍) => ({ ...涒壍, layout: 膴壍(涒壍.layout) })), [忕壍]);
    const 貁壍 = useCallback((奰壍: string, 硟壍: Record<string, unknown>) => 忕壍((靎壍) => ({ ...靎壍, widgets: 靎壍.widgets.map((搽壍) => (搽壍.id === 奰壍 ? { ...搽壍, config: { ...搽壍.config, ...硟壍 } } : 搽壍)) }), { undoable: false }), [忕壍]);
    const 茬壍 = useCallback((倛壍: WidgetInstance) => 忕壍((漊壍) => ({ ...漊壍, widgets: 漊壍.widgets.map((跹壍) => (跹壍.id === 倛壍.id ? 倛壍 : 跹壍)) })), [忕壍]);
    const 嫨壍 = useCallback((秗壍: string, 飆壍: number) => 慍壍((斵壍) => (斵壍[秗壍] !== undefined && 斵壍[秗壍] >= 飆壍 ? 斵壍 : { ...斵壍, [秗壍]: 飆壍 })), []);
    const 蒤壍 = useMemo(() => Object.fromEntries(唈壍.widgets.map((冓壍) => [冓壍.id, widgetDef(冓壍.type)?.minSize])), [唈壍.widgets]);
    const 炂壍 = (轱壍: WidgetInstance, 屠壍: string) => {
        忕壍((筏壍) => ({ ...筏壍, widgets: 筏壍.widgets.filter((騾壍) => 騾壍.id !== 轱壍.id), layout: removeItem(筏壍.layout, 轱壍.id) }));
        toast(`Removed “${屠壍}”`, { action: { label: "Undo", onClick: 组壍 } });
        闖壍(`${屠壍} removed. Undo is available.`);
    };
    const 札壍 = (蘜壍: string, 匋壍: string, 燺壍: -1 | 1) => {
        const 郩壍 = moveItem(唈壍.layout, 蘜壍, 燺壍);
        担壍(() => 郩壍);
        const 巘壍 = readingOrder(郩壍).findIndex((糇壍) => 糇壍.i === 蘜壍) + 1;
        闖壍(`${匋壍} moved to position ${巘壍} of ${郩壍.length}.`);
    };
    const 鮶壍 = (梥壍: string, 螔壍: string, 咃壍: number) => {
        const 獲壍 = cycleSize(唈壍.layout, 梥壍, 咃壍);
        担壍(() => 獲壍);
        const 鉡壍 = 獲壍.find((彐壍) => 彐壍.i === 梥壍)?.w ?? 0;
        闖壍(`${螔壍} is now ${鉡壍 === 12 ? "full width" : `${鉡壍} of 12 columns wide`}.`);
    };
    const 縿壍 = (鴮壍: WidgetInstance, 樝壍: GridItem, 褌壍: string) => {
        const 嗻壍 = 椪壍(鴮壍.type);
        忕壍((瓪壍) => ({ ...瓪壍, widgets: [...瓪壍.widgets, { ...structuredClone(鴮壍), id: 嗻壍, title: `${褌壍} (copy)` }], layout: appendItem(瓪壍.layout, { ...樝壍, i: 嗻壍 }) }));
        toast(`Duplicated “${褌壍}”`, { action: { label: "Undo", onClick: 组壍 } });
    };
    const 鏙壍 = (惈壍: WidgetInstance, 羷壍: {
        w: number;
        h: number;
    }) => {
        const 麦壍 = widgetDef(惈壍.type);
        const 殕壍 = 麦壍?.Component;
        return 殕壍 ? <殕壍 instance={惈壍} config={{ ...麦壍.defaultConfig, ...惈壍.config }} rt={珷壍} size={羷壍} setConfig={(誄壍) => 貁壍(惈壍.id, 誄壍)}/> : <経壍 type={惈壍.type}/>;
    };
    const 坳壍 = (癢壍: GridItem, 镑壍: number, 所壍: "css" | "rgl") => {
        const 脯壍 = 嚀壍.get(癢壍.i);
        if (!脯壍)
            return null;
        const 丞壍 = widgetDef(脯壍.type);
        const 洍壍 = 脯壍.title ?? 丞壍?.title ?? 脯壍.type;
        const 诼壍 = 丞壍 ? (typeof 丞壍.grows === "function" ? 丞壍.grows(脯壍.config as never) : !!丞壍.grows) : false;
        const 士壍 = 所壍 === "css" ? Math.max(癢壍.h, 鑞壍[癢壍.i] ?? 0) : 癢壍.h;
        const 矚壍: MenuItem[] = [
            { label: "Focus", onSelect: () => 謉壍(脯壍.id), hint: "full screen", separatorBefore: true },
            ...(檢壍
                ? []
                : [
                    { label: "Duplicate", onSelect: () => 縿壍(脯壍, 癢壍, 洍壍) },
                    { label: "Settings…", onSelect: () => (鶳壍(), 鼫壍(脯壍.id)) },
                    { label: "Remove", danger: true, onSelect: () => 炂壍(脯壍, 洍壍) },
                ]),
        ];
        return (<WidgetFrame key={脯壍.id} id={脯壍.id} title={洍壍} subtitle={脯壍.subtitle ?? 丞壍?.subtitle} link={丞壍?.link} editing={鋦壍} width={癢壍.w} className={所壍 === "css" ? "dash-item print-avoid-break" : "h-full w-full"} style={所壍 === "css" ? { ["--x" as string]: 癢壍.x + 1, ["--w" as string]: 癢壍.w, ["--h" as string]: 士壍 } : undefined} onLeft={镑壍 > 0 ? () => 札壍(脯壍.id, 洍壍, -1) : undefined} onRight={镑壍 < 覑壍.length - 1 ? () => 札壍(脯壍.id, 洍壍, 1) : undefined} onSize={() => 鮶壍(脯壍.id, 洍壍, 丞壍?.minSize?.w ?? 1)} onConfigure={() => 鼫壍(脯壍.id)} onRemove={() => 炂壍(脯壍, 洍壍)} onNeedRows={诼壍 && 所壍 === "css" ? (雉壍) => 嫨壍(脯壍.id, 雉壍) : undefined} extraMenu={矚壍} resetKey={`${脯壍.type}:${JSON.stringify(脯壍.config)}`}>
        {鏙壍(脯壍, { w: 癢壍.w, h: 士壍 })}
      </WidgetFrame>);
    };
    const 掸壍 = 氚壍 ? 嚀壍.get(氚壍) : undefined;
    const 芧壍 = 氚壍 ? 唈壍.layout.find((侖壍) => 侖壍.i === 氚壍) : undefined;
    return (<>
      {鋦壍 && 埸壍 ? (<蚡壍 layout={覑壍} minSizes={蒤壍} onCommit={(溅壍) => 担壍(() => 溅壍)} renderItem={(赴壍) => 坳壍(赴壍, 覑壍.findIndex((婣壍) => 婣壍.i === 赴壍.i), "rgl")}/>) : (<div className="dash-grid" data-editing={鋦壍 || undefined}>
          {覑壍.map((祒壍, 顁壍) => 坳壍(祒壍, 顁壍, "css"))}
        </div>)}
      <div aria-live="polite" className="sr-only">
        {盧壍}
      </div>
      <WidgetConfigDrawer instance={耼壍 ? (嚀壍.get(耼壍) ?? null) : null} onClose={() => 鼫壍(null)} onChange={茬壍}/>
      <Modal open={!!掸壍} onOpenChange={(攰壍) => !攰壍 && 謉壍(null)} eyebrow={掸壍 ? (widgetDef(掸壍.type)?.category ?? "Widget") : ""} title={掸壍 ? (掸壍.title ?? widgetDef(掸壍.type)?.title ?? 掸壍.type) : ""} width={1180}>
        {掸壍 ? <div className="flex h-[68vh] min-h-0 flex-col">{鏙壍(掸壍, { w: 12, h: Math.max(芧壍?.h ?? 20, 28) })}</div> : null}
      </Modal>
    </>);
}
