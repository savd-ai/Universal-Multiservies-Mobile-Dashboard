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
const CATEGORIES: (WidgetCategory | "Saved" | "All")[] = ["All", "Performance", "Budget", "Monitoring", "Content", "Saved"];
const BESPOKE_GLYPH: Record<string, Entry["glyph"]> = {
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
export function WidgetGallery({ open, onOpenChange, onPick }: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    onPick: (p: GalleryPick) => void;
}) {
    const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
    const [q, setQ] = useState("");
    const saved = useQuestions();
    const entries = useMemo<Entry[]>(() => {
        const bespoke: Entry[] = WIDGET_LIST.filter((w) => w.type !== "question").map((w) => ({
            key: `w:${w.type}`,
            title: w.title,
            description: w.description,
            category: w.category,
            glyph: BESPOKE_GLYPH[w.type] ?? "list",
            keywords: (w.keywords ?? []).join(" "),
            pick: () => ({ instance: { type: w.type, title: w.title, subtitle: w.subtitle, config: structuredClone(w.defaultConfig) as Record<string, unknown> }, size: w.defaultSize }),
        }));
        const presets: Entry[] = QUESTION_PRESETS.map((p) => ({
            key: `p:${p.id}`,
            title: p.title,
            description: p.description,
            category: p.category,
            glyph: p.viz.type,
            keywords: `${p.subtitle} ${(p.keywords ?? []).join(" ")} ${p.viz.type}`,
            pick: () => ({ instance: { type: "question", title: p.title, subtitle: p.subtitle, config: { preset: p.id, query: structuredClone(p.query), viz: structuredClone(p.viz) } }, size: p.size }),
        }));
        const questions: Entry[] = (saved.data ?? []).map((sq) => {
            const { dateRange: _range, ...query } = sq.query;
            return {
                key: `q:${sq.id}`,
                title: sq.name,
                description: sq.description || "Saved question from Explore",
                category: "Saved" as const,
                glyph: sq.viz.type,
                keywords: sq.origin,
                pick: () => ({ instance: { type: "question", title: sq.name, subtitle: sq.description?.slice(0, 80) || "Saved question", config: { savedQuestionId: sq.id, query, viz: sq.viz } }, size: { w: 6, h: 16 } }),
            };
        });
        return [...presets, ...bespoke, ...questions];
    }, [saved.data]);
    const needle = q.trim().toLowerCase();
    const shown = entries.filter((e) => (cat === "All" || e.category === cat) && (!needle || `${e.title} ${e.description} ${e.keywords}`.toLowerCase().includes(needle)));
    return (<Modal open={open} onOpenChange={onOpenChange} eyebrow="Add widget" title="Widget gallery" description="Ready-made questions, bespoke widgets and your saved questions. Everything follows the dashboard filters unless you change it in the widget's settings." width={880}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search widgets…" aria-label="Search widgets" className="w-56" autoFocus/>
          {CATEGORIES.map((c) => (<Chip key={c} active={cat === c} onClick={() => setCat(c)}>
              {c}
            </Chip>))}
        </div>
        <div className="grid grid-cols-1 max-h-[56vh] gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((e) => (<button key={e.key} type="button" onClick={() => {
                onPick(e.pick());
                onOpenChange(false);
            }} className="group flex gap-3 rounded-mini border border-line bg-fill p-3.5 text-left transition-colors hover:border-teal/40">
              <Glyph kind={e.glyph}/>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-display text-[14px] font-semibold">{e.title}</span>
                  <span className="shrink-0 font-mono text-[9px] tracking-label text-faint uppercase">{e.category}</span>
                </span>
                <span className="line-clamp-2 text-xs leading-snug text-muted-3">{e.description}</span>
              </span>
            </button>))}
          {!shown.length ? <div className="col-span-full p-6 text-center text-[13px] text-muted-3">No widgets match.</div> : null}
        </div>
      </div>
    </Modal>);
}
function Glyph({ kind }: {
    kind: Entry["glyph"];
}) {
    const s = { stroke: "var(--accent-line)", strokeWidth: 1.6, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
    const f = { fill: "var(--accent-line)" };
    const soft = { fill: "rgba(4,191,157,0.25)" };
    let body: React.ReactNode;
    switch (kind) {
        case "line":
        case "trend-multiples":
            body = <path d="M4 26 L12 18 L19 21 L27 11 L35 14 L40 8" {...s}/>;
            break;
        case "area":
            body = (<>
          <path d="M4 28 L12 20 L19 22 L27 13 L35 15 L40 9 L40 32 L4 32 Z" {...soft}/>
          <path d="M4 28 L12 20 L19 22 L27 13 L35 15 L40 9" {...s}/>
        </>);
            break;
        case "bar":
        case "stacked-bar":
            body = [6, 14, 22, 30].map((x, i) => <rect key={x} x={x} y={[16, 10, 20, 7][i]} width="5" height={32 - ([16, 10, 20, 7][i] ?? 0)} rx="1.5" {...f}/>);
            break;
        case "donut":
            body = (<>
          <circle cx="22" cy="18" r="11" stroke="rgba(4,191,157,0.25)" strokeWidth="6" fill="none"/>
          <path d="M22 7 A11 11 0 0 1 32.5 21" stroke="var(--accent-line)" strokeWidth="6" fill="none"/>
        </>);
            break;
        case "heatmap":
            body = [0, 1, 2].flatMap((r) => [0, 1, 2, 3, 4].map((c) => <rect key={`${r}${c}`} x={5 + c * 7} y={7 + r * 8} width="6" height="7" rx="1" fill={`rgba(4,191,157,${0.15 + ((r * 5 + c) % 5) * 0.18})`}/>));
            break;
        case "funnel":
            body = [0, 1, 2].map((i) => <rect key={i} x={6 + i * 5} y={7 + i * 8} width={32 - i * 10} height="6" rx="1.5" fill={`rgba(4,191,157,${0.9 - i * 0.25})`}/>);
            break;
        case "scatter":
            body = [
                [10, 24, 3],
                [18, 14, 5],
                [28, 20, 4],
                [35, 10, 2.5],
            ].map(([x, y, r]) => <circle key={`${x}`} cx={x} cy={y} r={r} fill="rgba(4,191,157,0.55)"/>);
            break;
        case "treemap":
            body = (<>
          <rect x="5" y="6" width="18" height="24" rx="2" fill="rgba(4,191,157,0.85)"/>
          <rect x="25" y="6" width="14" height="13" rx="2" fill="rgba(4,191,157,0.5)"/>
          <rect x="25" y="21" width="14" height="9" rx="2" fill="rgba(4,191,157,0.3)"/>
        </>);
            break;
        case "number":
        case "kpi-strip":
        case "gauge":
        case "progress-goal":
            body = (<>
          <text x="5" y="22" fontSize="13" fontWeight="600" fill="var(--text)" fontFamily="var(--font-display)">
            42
          </text>
          <path d="M26 22 L30 17 L34 19 L39 13" {...s}/>
        </>);
            break;
        case "meter":
            body = (<>
          <rect x="5" y="16" width="34" height="5" rx="2.5" fill="rgba(4,191,157,0.25)"/>
          <rect x="5" y="16" width="22" height="5" rx="2.5" {...f}/>
          <rect x="30" y="12" width="1.6" height="13" fill="var(--text)"/>
        </>);
            break;
        case "text":
            body = [9, 15, 21, 27].map((y, i) => <rect key={y} x="6" y={y} width={i === 3 ? 18 : 30} height="2.5" rx="1.25" fill="rgba(var(--fg-rgb),0.3)"/>);
            break;
        default:
            body = [9, 16, 23, 30].map((y) => <rect key={y} x="5" y={y - 3} width="34" height="2" rx="1" fill="rgba(var(--fg-rgb),0.25)"/>);
    }
    return (<svg viewBox="0 0 44 36" className="h-9 w-11 shrink-0 rounded-[8px] border border-line bg-surface" aria-hidden>
      {body}
    </svg>);
}
