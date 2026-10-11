"use client";
import { useMemo, useState } from "react";
import { Chip } from "@/components/ui/controls";
import { Input } from "@/components/ui/inputs";
import { Modal } from "@/components/ui/overlays";
import { useQuestions } from "@/lib/api/hooks";
import type { VizType, WidgetInstance } from "@/lib/domain/contracts/dashboard";
import { QUESTION_PRESETS } from "@/features/widgets/presets";
import { WIDGET_LIST } from "@/features/widgets/registry";
import type { WidgetCategory } from "@/features/widgets/types";
export interface GalleryPick {
    instance: Omit<WidgetInstance, "id">;
    size: {
        w: number;
        h: number;
    };
}
type Entry = {
    key: string;
    title: string;
    description: string;
    category: WidgetCategory | "Saved";
    glyph: VizType | "list" | "meter" | "text";
    keywords: string;
    pick: () => GalleryPick;
};
const 菱壍: (WidgetCategory | "Saved" | "All")[] = ["All", "Performance", "Budget", "Monitoring", "Content", "Saved"];
const 僠壍: Record<string, Entry["glyph"]> = {
    pacing: "meter",
    "goal-tracker": "meter",
    "cumulative-spend": "area",
    forecast: "line",
    "today-so-far": "bar",
    "anomaly-feed": "list",
    "alert-status": "number",
    "data-health": "list",
    "campaign-performance": "table",
    "top-movers": "list",
    opportunities: "list",
    "search-term-waste": "table",
    note: "text",
};
export function WidgetGallery({ open: 濏壍, onOpenChange: 躾壍, onPick: 宭壍 }: {
    open: boolean;
    onOpenChange: (窜壍: boolean) => void;
    onPick: (馋壍: GalleryPick) => void;
}) {
    const [智壍, 蕩壍] = useState<(typeof 菱壍)[number]>("All");
    const [剘壍, 煇壍] = useState("");
    const 逶壍 = useQuestions();
    const 崥壍 = useMemo<Entry[]>(() => {
        const 簔壍: Entry[] = WIDGET_LIST.filter((鬃壍) => 鬃壍.type !== "question").map((柲壍) => ({
            key: `w:${柲壍.type}`,
            title: 柲壍.title,
            description: 柲壍.description,
            category: 柲壍.category,
            glyph: 僠壍[柲壍.type] ?? "list",
            keywords: (柲壍.keywords ?? []).join(" "),
            pick: () => ({ instance: { type: 柲壍.type, title: 柲壍.title, subtitle: 柲壍.subtitle, config: structuredClone(柲壍.defaultConfig) as Record<string, unknown> }, size: 柲壍.defaultSize }),
        }));
        const 蛡壍: Entry[] = QUESTION_PRESETS.map((叐壍) => ({
            key: `p:${叐壍.id}`,
            title: 叐壍.title,
            description: 叐壍.description,
            category: 叐壍.category,
            glyph: 叐壍.viz.type,
            keywords: `${叐壍.subtitle} ${(叐壍.keywords ?? []).join(" ")} ${叐壍.viz.type}`,
            pick: () => ({ instance: { type: "question", title: 叐壍.title, subtitle: 叐壍.subtitle, config: { preset: 叐壍.id, query: structuredClone(叐壍.query), viz: structuredClone(叐壍.viz) } }, size: 叐壍.size }),
        }));
        const 犿壍: Entry[] = (逶壍.data ?? []).map((醮壍) => {
            const { dateRange: _庝壍, ...綌壍 } = 醮壍.query;
            return {
                key: `q:${醮壍.id}`,
                title: 醮壍.name,
                description: 醮壍.description || "Saved question from Explore",
                category: "Saved" as const,
                glyph: 醮壍.viz.type,
                keywords: 醮壍.origin,
                pick: () => ({ instance: { type: "question", title: 醮壍.name, subtitle: 醮壍.description?.slice(0, 80) || "Saved question", config: { savedQuestionId: 醮壍.id, query: 綌壍, viz: 醮壍.viz } }, size: { w: 6, h: 16 } }),
            };
        });
        return [...蛡壍, ...簔壍, ...犿壍];
    }, [逶壍.data]);
    const 鱻壍 = 剘壍.trim().toLowerCase();
    const 楪壍 = 崥壍.filter((衙壍) => (智壍 === "All" || 衙壍.category === 智壍) && (!鱻壍 || `${衙壍.title} ${衙壍.description} ${衙壍.keywords}`.toLowerCase().includes(鱻壍)));
    return (<Modal open={濏壍} onOpenChange={躾壍} eyebrow="Add widget" title="Widget gallery" description="Ready-made questions, bespoke widgets and your saved questions. Everything follows the dashboard filters unless you change it in the widget's settings." width={880}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input value={剘壍} onChange={(啈壍) => 煇壍(啈壍.target.value)} placeholder="Search widgets…" aria-label="Search widgets" className="w-56" autoFocus/>
          {菱壍.map((琷壍) => (<Chip key={琷壍} active={智壍 === 琷壍} onClick={() => 蕩壍(琷壍)}>
              {琷壍}
            </Chip>))}
        </div>
        <div className="grid grid-cols-1 max-h-[56vh] gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
          {楪壍.map((錦壍) => (<button key={錦壍.key} type="button" onClick={() => {
                宭壍(錦壍.pick());
                躾壍(false);
            }} className="group flex gap-3 rounded-mini border border-line bg-fill p-3.5 text-left transition-colors hover:border-teal/40">
              <怕壍 kind={錦壍.glyph}/>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-display text-[14px] font-semibold">{錦壍.title}</span>
                  <span className="shrink-0 font-mono text-[9px] tracking-label text-faint uppercase">{錦壍.category}</span>
                </span>
                <span className="line-clamp-2 text-xs leading-snug text-muted-3">{錦壍.description}</span>
              </span>
            </button>))}
          {!楪壍.length ? <div className="col-span-full p-6 text-center text-[13px] text-muted-3">No widgets match.</div> : null}
        </div>
      </div>
    </Modal>);
}
function 怕壍({ kind: 缄壍 }: {
    kind: Entry["glyph"];
}) {
    const 鷳壍 = { stroke: "var(--accent-line)", strokeWidth: 1.6, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
    const 櫢壍 = { fill: "var(--accent-line)" };
    const 觑壍 = { fill: "rgba(4,191,157,0.25)" };
    let 囀壍: React.ReactNode;
    switch (缄壍) {
        case "line":
        case "trend-multiples":
            囀壍 = <path d="M4 26 L12 18 L19 21 L27 11 L35 14 L40 8" {...鷳壍}/>;
            break;
        case "area":
            囀壍 = (<>
          <path d="M4 28 L12 20 L19 22 L27 13 L35 15 L40 9 L40 32 L4 32 Z" {...觑壍}/>
          <path d="M4 28 L12 20 L19 22 L27 13 L35 15 L40 9" {...鷳壍}/>
        </>);
            break;
        case "bar":
        case "stacked-bar":
            囀壍 = [6, 14, 22, 30].map((疯壍, 钞壍) => <rect key={疯壍} x={疯壍} y={[16, 10, 20, 7][钞壍]} width="5" height={32 - ([16, 10, 20, 7][钞壍] ?? 0)} rx="1.5" {...櫢壍}/>);
            break;
        case "donut":
            囀壍 = (<>
          <circle cx="22" cy="18" r="11" stroke="rgba(4,191,157,0.25)" strokeWidth="6" fill="none"/>
          <path d="M22 7 A11 11 0 0 1 32.5 21" stroke="var(--accent-line)" strokeWidth="6" fill="none"/>
        </>);
            break;
        case "heatmap":
            囀壍 = [0, 1, 2].flatMap((憍壍) => [0, 1, 2, 3, 4].map((聼壍) => <rect key={`${憍壍}${聼壍}`} x={5 + 聼壍 * 7} y={7 + 憍壍 * 8} width="6" height="7" rx="1" fill={`rgba(4,191,157,${0.15 + ((憍壍 * 5 + 聼壍) % 5) * 0.18})`}/>));
            break;
        case "funnel":
            囀壍 = [0, 1, 2].map((齫壍) => <rect key={齫壍} x={6 + 齫壍 * 5} y={7 + 齫壍 * 8} width={32 - 齫壍 * 10} height="6" rx="1.5" fill={`rgba(4,191,157,${0.9 - 齫壍 * 0.25})`}/>);
            break;
        case "scatter":
            囀壍 = [
                [10, 24, 3],
                [18, 14, 5],
                [28, 20, 4],
                [35, 10, 2.5],
            ].map(([汚壍, 證壍, 堸壍]) => <circle key={`${汚壍}`} cx={汚壍} cy={證壍} r={堸壍} fill="rgba(4,191,157,0.55)"/>);
            break;
        case "treemap":
            囀壍 = (<>
          <rect x="5" y="6" width="18" height="24" rx="2" fill="rgba(4,191,157,0.85)"/>
          <rect x="25" y="6" width="14" height="13" rx="2" fill="rgba(4,191,157,0.5)"/>
          <rect x="25" y="21" width="14" height="9" rx="2" fill="rgba(4,191,157,0.3)"/>
        </>);
            break;
        case "number":
        case "kpi-strip":
        case "gauge":
        case "progress-goal":
            囀壍 = (<>
          <text x="5" y="22" fontSize="13" fontWeight="600" fill="var(--text)" fontFamily="var(--font-display)">
            42
          </text>
          <path d="M26 22 L30 17 L34 19 L39 13" {...鷳壍}/>
        </>);
            break;
        case "meter":
            囀壍 = (<>
          <rect x="5" y="16" width="34" height="5" rx="2.5" fill="rgba(4,191,157,0.25)"/>
          <rect x="5" y="16" width="22" height="5" rx="2.5" {...櫢壍}/>
          <rect x="30" y="12" width="1.6" height="13" fill="var(--text)"/>
        </>);
            break;
        case "text":
            囀壍 = [9, 15, 21, 27].map((眧壍, 阖壍) => <rect key={眧壍} x="6" y={眧壍} width={阖壍 === 3 ? 18 : 30} height="2.5" rx="1.25" fill="rgba(var(--fg-rgb),0.3)"/>);
            break;
        default:
            囀壍 = [9, 16, 23, 30].map((挅壍) => <rect key={挅壍} x="5" y={挅壍 - 3} width="34" height="2" rx="1" fill="rgba(var(--fg-rgb),0.25)"/>);
    }
    return (<svg viewBox="0 0 44 36" className="h-9 w-11 shrink-0 rounded-[8px] border border-line bg-surface" aria-hidden>
      {囀壍}
    </svg>);
}
