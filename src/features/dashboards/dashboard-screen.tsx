"use client";
import { moneyFromStatus } from "@/lib/money";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/inputs";
import { ConfirmDialog, Menu, Modal, type MenuItem } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { useQueryClient } from "@tanstack/react-query";
import { useCan } from "@/lib/api/auth";
import { useCreateDashboard, useDashboards, useDashboardTemplates, useDeleteDashboard, useDuplicateDashboard, useSettings, useStatus } from "@/lib/api/hooks";
import { saveBlob } from "@/lib/api/client";
import { dashboardExportSchema, type Dashboard, type DashboardBody, type DashboardTemplate } from "@/lib/domain/contracts/dashboard";
import { buildFromTemplate } from "@/lib/domain/dashboards/templates";
import { parseCrossFilters, serializeCrossFilters, useFilters } from "@/lib/filters";
import { widgetDef } from "@/features/widgets/registry";
import type { WidgetRuntime } from "@/features/widgets/types";
import { DashboardGrid } from "./dashboard-grid";
import { FilterBar } from "./filter-bar";
import { appendItem } from "./layout-engine";
import { bodyOf, useDashboardDraft, type SaveStatus } from "./use-dashboard-draft";
import { WidgetGallery, type GalleryPick } from "./widget-gallery";
const 萟壍: Record<SaveStatus, string> = { idle: "", pending: "Unsaved changes…", saving: "Saving…", saved: "Saved", error: "Not saved" };
function 儎壍(濽壍: string): string {
    return `${濽壍.slice(0, 10)}-${Math.random().toString(36).slice(2, 7)}`;
}
export function DashboardScreen({ dashboardId: 軬壍 }: {
    dashboardId?: string;
}) {
    const 寛壍 = useStatus();
    const 竊壍 = useDashboards();
    const 馹壍 = useMemo(() => 竊壍.data ?? [], [竊壍.data]);
    const 暨壍 = 軬壍 ? 馹壍.find((薗壍) => 薗壍.id === 軬壍) : (馹壍.find((劆壍) => 劆壍.isDefault) ?? 馹壍[0]);
    const 煵壍 = 寛壍.data?.today;
    const 遤壍 = useFilters(煵壍);
    const [, 嵓壍] = useQueryState("campaign", parseAsString.withOptions({ history: "push", scroll: false }));
    const [籂壍, 鬱壍] = useState(false);
    const 栠壍 = useCan()("dashboards.edit");
    const { draft: 蜏壍, update: 叾壍, undo: 狭壍, redo: 釜壍, canUndo: 廋壍, canRedo: 綺壍, status: 鲩壍 } = useDashboardDraft(暨壍);
    const 榘壍 = useQueryClient();
    const 袇壍 = useSettings();
    useEffect(() => {
        const 啶壍 = 袇壍.data?.refreshSeconds ?? 0;
        if (!啶壍 || 籂壍)
            return;
        const 瑥壍 = setInterval(() => void 榘壍.invalidateQueries({ queryKey: ["acct"] }), Math.max(30, 啶壍) * 1000);
        return () => clearInterval(瑥壍);
    }, [榘壍, 袇壍.data?.refreshSeconds, 籂壍]);
    useEffect(() => {
        if (!栠壍)
            return;
        const 鍔壍 = () => 鬱壍((恃壍) => !恃壍);
        window.addEventListener("savd:toggle-edit", 鍔壍);
        return () => window.removeEventListener("savd:toggle-edit", 鍔壍);
    }, [栠壍]);
    useEffect(() => {
        if (!籂壍)
            return;
        const 缲壍 = (鸡壍: KeyboardEvent) => {
            const 欐壍 = 鸡壍.target as HTMLElement | null;
            if (欐壍 && (["INPUT", "TEXTAREA", "SELECT"].includes(欐壍.tagName) || 欐壍.isContentEditable))
                return;
            if ((鸡壍.metaKey || 鸡壍.ctrlKey) && 鸡壍.key.toLowerCase() === "z") {
                鸡壍.preventDefault();
                if (鸡壍.shiftKey)
                    釜壍();
                else
                    狭壍();
            }
            else if (鸡壍.key === "Escape")
                鬱壍(false);
        };
        window.addEventListener("keydown", 缲壍);
        return () => window.removeEventListener("keydown", 缲壍);
    }, [籂壍, 狭壍, 釜壍]);
    const 觿壍 = useCallback((囮壍: string, 痝壍: string, 铌壍: {
        exclude?: boolean;
    } = {}) => {
        const 憻壍 = parseCrossFilters(遤壍.state.xf);
        const 肪壍 = 憻壍.findIndex((龙壍) => 龙壍.dim === 囮壍 && !!龙壍.exclude === !!铌壍.exclude);
        let 沈壍 = 憻壍;
        if (肪壍 < 0)
            沈壍 = [...憻壍, { dim: 囮壍, values: [痝壍], exclude: !!铌壍.exclude }];
        else {
            const 護壍 = 憻壍[肪壍];
            if (!護壍)
                return;
            const 塦壍 = 護壍.values.includes(痝壍) ? 護壍.values.filter((睕壍) => 睕壍 !== 痝壍) : [...護壍.values, 痝壍];
            沈壍 = 塦壍.length ? 憻壍.map((附壍, 挳壍) => (挳壍 === 肪壍 ? { ...附壍, values: 塦壍 } : 附壍)) : 憻壍.filter((舢壍, 休壍) => 休壍 !== 肪壍);
        }
        void 遤壍.set({ xf: serializeCrossFilters(沈壍) });
    }, [遤壍]);
    const 渀壍: WidgetRuntime | null = useMemo(() => 寛壍.data && 暨壍
        ? {
            filters: 遤壍,
            today: 寛壍.data.today,
            dataThrough: 寛壍.data.dataThrough,
            currency: 寛壍.data.display.currency || 寛壍.data.account.currency,
            money: moneyFromStatus(寛壍.data),
            mode: 寛壍.data.mode,
            editing: 籂壍,
            dashboardId: 暨壍.id,
            openCampaign: (賯壍: string) => void 嵓壍(賯壍),
            toggleCrossFilter: 觿壍,
        }
        : null, [寛壍.data, 暨壍, 遤壍, 籂壍, 嵓壍, 觿壍]);
    if (竊壍.error)
        return <ErrorState error={竊壍.error} onRetry={() => void 竊壍.refetch()}/>;
    if (!竊壍.data || !寛壍.data)
        return <磍壍 />;
    if (!暨壍) {
        return (<div className="flex flex-col gap-6">
        <PageHeader />
        <EmptyState action={<Link href="/overview">Open the default dashboard →</Link>}>This dashboard doesn&apos;t exist (it may have been deleted).</EmptyState>
      </div>);
    }
    const 姞壍 = 蜏壍 ?? bodyOf(暨壍);
    return (<div className="flex flex-col gap-6">
      <PageHeader headline={姞壍.headline || "What is *actually* driving your growth?"} eyebrow="Overview" actions={<Cmp34 editing={籂壍} setEditing={鬱壍} canEdit={栠壍} dashboard={暨壍} body={姞壍} update={叾壍} list={馹壍}/>}/>
      <Cmp33 list={馹壍} current={暨壍}/>
      <FilterBar filters={遤壍 as never}/>
      {籂壍 ? <Cmp35 body={姞壍} update={叾壍} undo={狭壍} redo={釜壍} canUndo={廋壍} canRedo={綺壍} saveStatus={鲩壍}/> : null}
      {渀壍 && 姞壍.widgets.length ? (<DashboardGrid draft={姞壍} rt={渀壍} editing={籂壍} update={叾壍} undo={狭壍} onRequestEdit={() => 鬱壍(true)} readOnly={!栠壍}/>) : (<EmptyState action={栠壍 ? <Button variant="accent" onClick={() => 鬱壍(true)}>Add widgets</Button> : undefined}>This dashboard is empty.</EmptyState>)}
    </div>);
}
function 磍壍() {
    return (<div className="flex flex-col gap-6" aria-busy="true">
      <Skeleton height={96} className="w-2/3"/>
      <Skeleton height={32} className="w-1/2"/>
      <div className="dash-grid">
        {[
            [1, 12, 10],
            [1, 8, 17],
            [9, 4, 17],
            [1, 4, 20],
            [5, 8, 20],
        ].map(([鞼壍, 撫壍, 莚壍], 傉壍) => (<div key={傉壍} className="dash-item animate-shimmer rounded-card bg-tone/8" style={{ ["--x" as string]: 鞼壍, ["--w" as string]: 撫壍, ["--h" as string]: 莚壍 }}/>))}
      </div>
    </div>);
}
function Cmp33({ list: 蹧壍, current: 孖壍 }: {
    list: Dashboard[];
    current: Dashboard;
}) {
    const 穅壍 = useSearchParams();
    const 餴壍 = 穅壍.toString();
    if (蹧壍.length < 2)
        return null;
    return (<nav aria-label="Dashboards" className="-mb-2 flex flex-wrap gap-0.5 self-start rounded-pill border border-line bg-fill p-[3px]">
      {蹧壍.map((昣壍) => {
            const 蔒壍 = 昣壍.id === 孖壍.id;
            const 刁壍 = `${昣壍.isDefault ? "/overview" : `/overview/${昣壍.id}`}${餴壍 ? `?${餴壍}` : ""}`;
            return (<Link key={昣壍.id} href={刁壍} aria-current={蔒壍 ? "page" : undefined} className={cn("flex items-center gap-2 rounded-pill px-4 py-[7px] text-[13px] transition-colors", 蔒壍 ? "bg-accent text-on-accent hover:opacity-100" : "text-muted hover:text-fg hover:opacity-100")}>
            {昣壍.name}
            {昣壍.isDefault ? <span className={cn("font-mono text-micro", 蔒壍 ? "text-on-accent" : "text-faint")}>default</span> : null}
          </Link>);
        })}
    </nav>);
}
function Cmp34({ editing: 迟壍, setEditing: 峎壍, canEdit: 箽壍, dashboard: 骬壍, body: 枛壍, update: 蚊壍, list: 卹壍 }: {
    editing: boolean;
    setEditing: (牨壍: boolean) => void;
    canEdit: boolean;
    dashboard: Dashboard;
    body: DashboardBody;
    update: (酗壍: (幆壍: DashboardBody) => DashboardBody) => void;
    list: Dashboard[];
}) {
    const 紵壍 = useRouter();
    const 鰤壍 = usePathname();
    const 椓壍 = useCreateDashboard();
    const 蠂壍 = useDuplicateDashboard();
    const 哱壍 = useDeleteDashboard();
    const 珠壍 = useDashboardTemplates();
    const [鋏壍, 徾壍] = useQueryState("new", parseAsString);
    const [纭壍, 鶜壍] = useState<null | "rename" | "new" | "delete" | "reset">(() => (鋏壍 ? "new" : null));
    const [檋壍, 襺壍] = useState(枛壍.name);
    const [噩壍, 畘壍] = useState(枛壍.headline ?? "");
    const 鑇壍 = useRef<HTMLInputElement>(null);
    const 愶壍 = (耥壍: Dashboard) => 紵壍.push(耥壍.isDefault ? "/overview" : `/overview/${耥壍.id}`);
    const 鼔壍 = () => {
        const 氃壍 = dashboardExportSchema.parse({ kind: "savd.dashboard", schemaVersion: 1, doc: 枛壍 });
        saveBlob(new Blob([JSON.stringify(氃壍, null, 2)], { type: "application/json" }), `${枛壍.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.dashboard.json`);
    };
    const 諲壍 = async (埡壍: File) => {
        try {
            const 盐壍 = dashboardExportSchema.safeParse(JSON.parse(await 埡壍.text()));
            if (!盐壍.success)
                throw new Error("Not a SAVD dashboard export (kind: savd.dashboard).");
            const 閿壍 = await 椓壍.mutateAsync({ doc: { ...盐壍.data.doc, isDefault: false, order: 卹壍.length } });
            toast(`Imported “${閿壍.name}”`);
            愶壍(閿壍);
        }
        catch (抮壍) {
            toast((抮壍 as Error).message || "Import failed", { tone: "crit" });
        }
    };
    const 膝壍: MenuItem = { label: "Export JSON", onSelect: 鼔壍 };
    const 二壍: MenuItem = { label: "Print / PDF", onSelect: () => window.print(), hint: "⌘P" };
    const 浻壍: MenuItem = { label: "TV mode", onSelect: () => window.open(`/tv/${骬壍.id}`, "_blank", "noopener"), hint: "kiosk" };
    const 豪壍: MenuItem[] = 箽壍
        ? [
            { label: "Rename…", onSelect: () => (襺壍(枛壍.name), 畘壍(枛壍.headline ?? ""), 鶜壍("rename")) },
            { label: "Duplicate", onSelect: () => void 蠂壍.mutateAsync(骬壍.id).then((奙壍) => (toast(`Created “${奙壍.name}”`), 愶壍(奙壍))) },
            { label: "Set as default", disabled: 枛壍.isDefault, onSelect: () => 蚊壍((硈壍) => ({ ...硈壍, isDefault: true })) },
            { label: "New dashboard…", separatorBefore: true, onSelect: () => 鶜壍("new") },
            膝壍,
            { label: "Import JSON…", onSelect: () => 鑇壍.current?.click() },
            二壍,
            浻壍,
            { label: "Delete dashboard", danger: true, separatorBefore: true, disabled: 卹壍.length <= 1, onSelect: () => 鶜壍("delete") },
        ]
        : [膝壍, 二壍, 浻壍];
    return (<>
      {迟壍 ? (<Button variant="ghost" onClick={() => 鶜壍("reset")}>
          Reset layout
        </Button>) : null}
      {箽壍 ? (<Button variant={迟壍 ? "accent" : "outline"} onClick={() => 峎壍(!迟壍)} aria-pressed={迟壍}>
          {迟壍 ? "Done" : "Customize dashboard"}
        </Button>) : null}
      {!迟壍 ? (<Menu trigger={<IconButton label="Dashboard options" size="md">
              ⋯
            </IconButton>} items={豪壍}/>) : null}
      <input ref={鑇壍} type="file" accept="application/json,.json" className="hidden" onChange={(霷壍) => (霷壍.target.files?.[0] ? void 諲壍(霷壍.target.files[0]) : undefined, (霷壍.target.value = ""))}/>

      <Modal open={纭壍 === "rename"} onOpenChange={(搦壍) => !搦壍 && 鶜壍(null)} eyebrow="Dashboard" title="Rename" footer={<>
            <Button variant="ghost" onClick={() => 鶜壍(null)}>
              Cancel
            </Button>
            <Button variant="accent" disabled={!檋壍.trim()} onClick={() => {
                蚊壍((茕壍) => ({ ...茕壍, name: 檋壍.trim().slice(0, 80), headline: 噩壍.trim().slice(0, 140) || 茕壍.headline }));
                鶜壍(null);
            }}>
              Save
            </Button>
          </>}>
        <div className="flex flex-col gap-4">
          <Field label="Name">{(倄壍) => <Input id={倄壍} variant="field" value={檋壍} onChange={(滳壍) => 襺壍(滳壍.target.value)} maxLength={80} autoFocus/>}</Field>
          <Field label="Headline" hint="Wrap exactly one word in *asterisks* for the italic accent.">
            {(跢壍) => <Input id={跢壍} variant="field" value={噩壍} onChange={(嫑壍) => 畘壍(嫑壍.target.value)} maxLength={140} placeholder="What is *actually* driving your growth?"/>}
          </Field>
        </div>
      </Modal>

      <Modal open={纭壍 === "new" || !!鋏壍} onOpenChange={(秀壍) => {
            if (秀壍)
                return;
            鶜壍(null);
            if (鋏壍)
                void 徾壍(null);
        }} eyebrow="New dashboard" title="Start from a template" width={560}>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {[...(珠壍.data ?? []), { id: "blank", name: "Blank", headline: "A *fresh* canvas", description: "An empty grid — add widgets from the gallery." }].map((颯壍) => (<button key={颯壍.id} type="button" disabled={椓壍.isPending} onClick={() => void 椓壍.mutateAsync({ template: 颯壍.id, name: 颯壍.id === "blank" ? "Untitled dashboard" : 颯壍.name }).then((斞壍) => {
                鶜壍(null);
                void 徾壍(null);
                toast(`Created “${斞壍.name}”`);
                愶壍(斞壍);
            })} className="flex flex-col gap-1.5 rounded-mini border border-line bg-fill p-3.5 text-left transition-colors hover:border-teal/40">
              <span className="font-display text-[15px] font-semibold">{颯壍.name}</span>
              <span className="text-xs leading-normal text-muted-3">{颯壍.description}</span>
            </button>))}
        </div>
      </Modal>

      <ConfirmDialog open={纭壍 === "delete"} onOpenChange={(蒍壍) => !蒍壍 && 鶜壍(null)} title={`Delete “${枛壍.name}”?`} description="The dashboard and its layout are removed for everyone using this server. Widgets' data is not affected." confirmLabel="Delete" danger onConfirm={() => void 哱壍.mutateAsync(骬壍.id).then(() => {
            鶜壍(null);
            toast(`Deleted “${枛壍.name}”`);
            if (鰤壍 !== "/overview")
                紵壍.push("/overview");
        })}/>
      <ConfirmDialog open={纭壍 === "reset"} onOpenChange={(兼壍) => !兼壍 && 鶜壍(null)} title="Reset layout?" description={`Restores the ${枛壍.template && 枛壍.template !== "blank" ? `“${枛壍.template}” template` : "empty"} layout. You can undo this.`} confirmLabel="Reset layout" onConfirm={() => {
            const 火壍 = buildFromTemplate((枛壍.template ?? "blank") as DashboardTemplate);
            蚊壍((轚壍) => ({ ...轚壍, widgets: 火壍.widgets, layout: 火壍.layout }));
            鶜壍(null);
        }}/>
    </>);
}
function Cmp35({ body: 笸壍, update: 騧壍, undo: 朖壍, redo: 蘅壍, canUndo: 勴壍, canRedo: 燣壍, saveStatus: 郒壍 }: {
    body: DashboardBody;
    update: (巁壍: (粰壍: DashboardBody) => DashboardBody) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    saveStatus: SaveStatus;
}) {
    const 鮟壍 = 笸壍.template && 笸壍.template !== "blank" ? buildFromTemplate(笸壍.template) : null;
    const 梎壍 = 鮟壍 ? 鮟壍.widgets.filter((蝽壍) => !笸壍.widgets.some((呬壍) => 呬壍.id === 蝽壍.id)) : [];
    const 獛壍 = (鉊壍: string) => {
        if (!鮟壍)
            return;
        const 弹壍 = 鮟壍.widgets.find((縨壍) => 縨壍.id === 鉊壍);
        const 鴗壍 = 鮟壍.layout.find((樆壍) => 樆壍.i === 鉊壍);
        if (!弹壍 || !鴗壍)
            return;
        騧壍((裵壍) => ({ ...裵壍, widgets: [...裵壍.widgets, 弹壍], layout: appendItem(裵壍.layout, { ...鴗壍, w: 鴗壍.w === 12 ? 12 : Math.max(鴗壍.w, 6) }) }));
    };
    const [嗤壍, 瓓壍] = useState(false);
    const 鏂壍 = ({ instance: 悱壍, size: 羠壍 }: GalleryPick) => {
        const 麏壍 = 儎壍(悱壍.type);
        騧壍((歾壍) => ({ ...歾壍, widgets: [...歾壍.widgets, { ...悱壍, id: 麏壍 }], layout: appendItem(歾壍.layout, { i: 麏壍, x: 0, y: 0, w: 羠壍.w, h: 羠壍.h }) }));
        toast(`Added “${悱壍.title ?? widgetDef(悱壍.type)?.title ?? 悱壍.type}”`);
    };
    return (<div className="flex flex-wrap items-center gap-2.5 rounded-mini border border-dashed border-teal/30 bg-teal/4 px-[18px] py-3.5" role="region" aria-label="Layout editor">
      <span className="font-mono text-meta tracking-meta text-accent uppercase">Editing layout</span>
      <span className="text-[13px] text-muted-3">Move, resize or remove widgets. Layout saves automatically.</span>
      <span aria-live="polite" className={cn("font-mono text-micro tracking-label uppercase", 郒壍 === "error" ? "text-crit" : "text-faint")}>
        {萟壍[郒壍]}
      </span>
      <div className="flex-1"/>
      {梎壍.map((詭壍) => (<button key={詭壍.id} type="button" onClick={() => 獛壍(詭壍.id)} className="rounded-pill border border-teal/30 px-3.5 py-1.5 text-xs text-accent hover:border-teal/60">
          + {詭壍.title ?? widgetDef(詭壍.type)?.title}
        </button>))}
      <button type="button" onClick={() => 瓓壍(true)} className="rounded-pill border border-teal/30 bg-teal-t px-3.5 py-1.5 text-xs font-semibold text-accent hover:border-teal/60">
        + Add widget
      </button>
      <WidgetGallery open={嗤壍} onOpenChange={瓓壍} onPick={鏂壍}/>
      <IconButton label="Undo (⌘Z)" onClick={朖壍} disabled={!勴壍} className="disabled:opacity-40">
        ↶
      </IconButton>
      <IconButton label="Redo (⌘⇧Z)" onClick={蘅壍} disabled={!燣壍} className="disabled:opacity-40">
        ↷
      </IconButton>
    </div>);
}
