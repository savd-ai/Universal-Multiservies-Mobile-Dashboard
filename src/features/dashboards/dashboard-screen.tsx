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
const SAVE_LABEL: Record<SaveStatus, string> = { idle: "", pending: "Unsaved changes…", saving: "Saving…", saved: "Saved", error: "Not saved" };
function newId(text: string): string {
    return `${text.slice(0, 10)}-${Math.random().toString(36).slice(2, 7)}`;
}
export function DashboardScreen({ dashboardId }: {
    dashboardId?: string;
}) {
    const status = useStatus();
    const dashboards = useDashboards();
    const list = useMemo(() => dashboards.data ?? [], [dashboards.data]);
    const current = dashboardId ? list.find((d) => d.id === dashboardId) : (list.find((d) => d.isDefault) ?? list[0]);
    const today = status.data?.today;
    const filters = useFilters(today);
    const [, setCampaign] = useQueryState("campaign", parseAsString.withOptions({ history: "push", scroll: false }));
    const [editing, setEditing] = useState(false);
    const canEdit = useCan()("dashboards.edit");
    const { draft, update, undo, redo, canUndo, canRedo, status: saveStatus } = useDashboardDraft(current);
    const qc = useQueryClient();
    const settings = useSettings();
    useEffect(() => {
        const every = settings.data?.refreshSeconds ?? 0;
        if (!every || editing)
            return;
        const t = setInterval(() => void qc.invalidateQueries({ queryKey: ["acct"] }), Math.max(30, every) * 1000);
        return () => clearInterval(t);
    }, [qc, settings.data?.refreshSeconds, editing]);
    useEffect(() => {
        if (!canEdit)
            return;
        const toggle = () => setEditing((v) => !v);
        window.addEventListener("savd:toggle-edit", toggle);
        return () => window.removeEventListener("savd:toggle-edit", toggle);
    }, [canEdit]);
    useEffect(() => {
        if (!editing)
            return;
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (t && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable))
                return;
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
                e.preventDefault();
                if (e.shiftKey)
                    redo();
                else
                    undo();
            }
            else if (e.key === "Escape")
                setEditing(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [editing, undo, redo]);
    const toggleCrossFilter = useCallback((dim: string, value: string, opts: {
        exclude?: boolean;
    } = {}) => {
        const cur = parseCrossFilters(filters.state.xf);
        const i = cur.findIndex((c) => c.dim === dim && !!c.exclude === !!opts.exclude);
        let next = cur;
        if (i < 0)
            next = [...cur, { dim, values: [value], exclude: !!opts.exclude }];
        else {
            const c = cur[i];
            if (!c)
                return;
            const values = c.values.includes(value) ? c.values.filter((v) => v !== value) : [...c.values, value];
            next = values.length ? cur.map((x, j) => (j === i ? { ...x, values } : x)) : cur.filter((_, j) => j !== i);
        }
        void filters.set({ xf: serializeCrossFilters(next) });
    }, [filters]);
    const rt: WidgetRuntime | null = useMemo(() => status.data && current
        ? {
            filters,
            today: status.data.today,
            dataThrough: status.data.dataThrough,
            currency: status.data.display.currency || status.data.account.currency,
            money: moneyFromStatus(status.data),
            mode: status.data.mode,
            editing,
            dashboardId: current.id,
            openCampaign: (id: string) => void setCampaign(id),
            toggleCrossFilter,
        }
        : null, [status.data, current, filters, editing, setCampaign, toggleCrossFilter]);
    if (dashboards.error)
        return <ErrorState error={dashboards.error} onRetry={() => void dashboards.refetch()}/>;
    if (!dashboards.data || !status.data)
        return <DashboardSkeleton />;
    if (!current) {
        return (<div className="flex flex-col gap-6">
        <PageHeader />
        <EmptyState action={<Link href="/overview">Open the default dashboard →</Link>}>This dashboard doesn&apos;t exist (it may have been deleted).</EmptyState>
      </div>);
    }
    const body = draft ?? bodyOf(current);
    return (<div className="flex flex-col gap-6">
      <PageHeader headline={body.headline || "What is *actually* driving your growth?"} eyebrow="Overview" actions={<HeaderActions editing={editing} setEditing={setEditing} canEdit={canEdit} dashboard={current} body={body} update={update} list={list}/>}/>
      <DashboardTabs list={list} current={current}/>
      <FilterBar filters={filters as never}/>
      {editing ? <EditBar body={body} update={update} undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} saveStatus={saveStatus}/> : null}
      {rt && body.widgets.length ? (<DashboardGrid draft={body} rt={rt} editing={editing} update={update} undo={undo} onRequestEdit={() => setEditing(true)} readOnly={!canEdit}/>) : (<EmptyState action={canEdit ? <Button variant="accent" onClick={() => setEditing(true)}>Add widgets</Button> : undefined}>This dashboard is empty.</EmptyState>)}
    </div>);
}
function DashboardSkeleton() {
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
        ].map(([x, w, h], i) => (<div key={i} className="dash-item animate-shimmer rounded-card bg-tone/8" style={{ ["--x" as string]: x, ["--w" as string]: w, ["--h" as string]: h }}/>))}
      </div>
    </div>);
}
function DashboardTabs({ list, current }: {
    list: Dashboard[];
    current: Dashboard;
}) {
    const search = useSearchParams();
    const qs = search.toString();
    if (list.length < 2)
        return null;
    return (<nav aria-label="Dashboards" className="-mb-2 flex flex-wrap gap-0.5 self-start rounded-pill border border-line bg-fill p-[3px]">
      {list.map((d) => {
            const on = d.id === current.id;
            const href = `${d.isDefault ? "/overview" : `/overview/${d.id}`}${qs ? `?${qs}` : ""}`;
            return (<Link key={d.id} href={href} aria-current={on ? "page" : undefined} className={cn("flex items-center gap-2 rounded-pill px-4 py-[7px] text-[13px] transition-colors", on ? "bg-accent text-on-accent hover:opacity-100" : "text-muted hover:text-fg hover:opacity-100")}>
            {d.name}
            {d.isDefault ? <span className={cn("font-mono text-micro", on ? "text-on-accent" : "text-faint")}>default</span> : null}
          </Link>);
        })}
    </nav>);
}
function HeaderActions({ editing, setEditing, canEdit, dashboard, body, update, list }: {
    editing: boolean;
    setEditing: (v: boolean) => void;
    canEdit: boolean;
    dashboard: Dashboard;
    body: DashboardBody;
    update: (fn: (d: DashboardBody) => DashboardBody) => void;
    list: Dashboard[];
}) {
    const router = useRouter();
    const pathname = usePathname();
    const create = useCreateDashboard();
    const duplicate = useDuplicateDashboard();
    const remove = useDeleteDashboard();
    const templates = useDashboardTemplates();
    const [newParam, setNewParam] = useQueryState("new", parseAsString);
    const [dialog, setDialog] = useState<null | "rename" | "new" | "delete" | "reset">(() => (newParam ? "new" : null));
    const [name, setName] = useState(body.name);
    const [headline, setHeadline] = useState(body.headline ?? "");
    const fileRef = useRef<HTMLInputElement>(null);
    const go = (d: Dashboard) => router.push(d.isDefault ? "/overview" : `/overview/${d.id}`);
    const exportJson = () => {
        const doc = dashboardExportSchema.parse({ kind: "savd.dashboard", schemaVersion: 1, doc: body });
        saveBlob(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }), `${body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.dashboard.json`);
    };
    const importJson = async (file: File) => {
        try {
            const parsed = dashboardExportSchema.safeParse(JSON.parse(await file.text()));
            if (!parsed.success)
                throw new Error("Not a SAVD dashboard export (kind: savd.dashboard).");
            const created = await create.mutateAsync({ doc: { ...parsed.data.doc, isDefault: false, order: list.length } });
            toast(`Imported “${created.name}”`);
            go(created);
        }
        catch (e) {
            toast((e as Error).message || "Import failed", { tone: "crit" });
        }
    };
    const exportItem: MenuItem = { label: "Export JSON", onSelect: exportJson };
    const printItem: MenuItem = { label: "Print / PDF", onSelect: () => window.print(), hint: "⌘P" };
    const tvItem: MenuItem = { label: "TV mode", onSelect: () => window.open(`/tv/${dashboard.id}`, "_blank", "noopener"), hint: "kiosk" };
    const items: MenuItem[] = canEdit
        ? [
            { label: "Rename…", onSelect: () => (setName(body.name), setHeadline(body.headline ?? ""), setDialog("rename")) },
            { label: "Duplicate", onSelect: () => void duplicate.mutateAsync(dashboard.id).then((d) => (toast(`Created “${d.name}”`), go(d))) },
            { label: "Set as default", disabled: body.isDefault, onSelect: () => update((d) => ({ ...d, isDefault: true })) },
            { label: "New dashboard…", separatorBefore: true, onSelect: () => setDialog("new") },
            exportItem,
            { label: "Import JSON…", onSelect: () => fileRef.current?.click() },
            printItem,
            tvItem,
            { label: "Delete dashboard", danger: true, separatorBefore: true, disabled: list.length <= 1, onSelect: () => setDialog("delete") },
        ]
        : [exportItem, printItem, tvItem];
    return (<>
      {editing ? (<Button variant="ghost" onClick={() => setDialog("reset")}>
          Reset layout
        </Button>) : null}
      {canEdit ? (<Button variant={editing ? "accent" : "outline"} onClick={() => setEditing(!editing)} aria-pressed={editing}>
          {editing ? "Done" : "Customize dashboard"}
        </Button>) : null}
      {!editing ? (<Menu trigger={<IconButton label="Dashboard options" size="md">
              ⋯
            </IconButton>} items={items}/>) : null}
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => (e.target.files?.[0] ? void importJson(e.target.files[0]) : undefined, (e.target.value = ""))}/>

      <Modal open={dialog === "rename"} onOpenChange={(o) => !o && setDialog(null)} eyebrow="Dashboard" title="Rename" footer={<>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant="accent" disabled={!name.trim()} onClick={() => {
                update((d) => ({ ...d, name: name.trim().slice(0, 80), headline: headline.trim().slice(0, 140) || d.headline }));
                setDialog(null);
            }}>
              Save
            </Button>
          </>}>
        <div className="flex flex-col gap-4">
          <Field label="Name">{(id) => <Input id={id} variant="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus/>}</Field>
          <Field label="Headline" hint="Wrap exactly one word in *asterisks* for the italic accent.">
            {(id) => <Input id={id} variant="field" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={140} placeholder="What is *actually* driving your growth?"/>}
          </Field>
        </div>
      </Modal>

      <Modal open={dialog === "new" || !!newParam} onOpenChange={(o) => {
            if (o)
                return;
            setDialog(null);
            if (newParam)
                void setNewParam(null);
        }} eyebrow="New dashboard" title="Start from a template" width={560}>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {[...(templates.data ?? []), { id: "blank", name: "Blank", headline: "A *fresh* canvas", description: "An empty grid — add widgets from the gallery." }].map((t) => (<button key={t.id} type="button" disabled={create.isPending} onClick={() => void create.mutateAsync({ template: t.id, name: t.id === "blank" ? "Untitled dashboard" : t.name }).then((d) => {
                setDialog(null);
                void setNewParam(null);
                toast(`Created “${d.name}”`);
                go(d);
            })} className="flex flex-col gap-1.5 rounded-mini border border-line bg-fill p-3.5 text-left transition-colors hover:border-teal/40">
              <span className="font-display text-[15px] font-semibold">{t.name}</span>
              <span className="text-xs leading-normal text-muted-3">{t.description}</span>
            </button>))}
        </div>
      </Modal>

      <ConfirmDialog open={dialog === "delete"} onOpenChange={(o) => !o && setDialog(null)} title={`Delete “${body.name}”?`} description="The dashboard and its layout are removed for everyone using this server. Widgets' data is not affected." confirmLabel="Delete" danger onConfirm={() => void remove.mutateAsync(dashboard.id).then(() => {
            setDialog(null);
            toast(`Deleted “${body.name}”`);
            if (pathname !== "/overview")
                router.push("/overview");
        })}/>
      <ConfirmDialog open={dialog === "reset"} onOpenChange={(o) => !o && setDialog(null)} title="Reset layout?" description={`Restores the ${body.template && body.template !== "blank" ? `“${body.template}” template` : "empty"} layout. You can undo this.`} confirmLabel="Reset layout" onConfirm={() => {
            const fresh = buildFromTemplate((body.template ?? "blank") as DashboardTemplate);
            update((d) => ({ ...d, widgets: fresh.widgets, layout: fresh.layout }));
            setDialog(null);
        }}/>
    </>);
}
function EditBar({ body, update, undo, redo, canUndo, canRedo, saveStatus }: {
    body: DashboardBody;
    update: (fn: (d: DashboardBody) => DashboardBody) => void;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    saveStatus: SaveStatus;
}) {
    const template = body.template && body.template !== "blank" ? buildFromTemplate(body.template) : null;
    const hidden = template ? template.widgets.filter((w) => !body.widgets.some((x) => x.id === w.id)) : [];
    const restore = (id: string) => {
        if (!template)
            return;
        const inst = template.widgets.find((w) => w.id === id);
        const lay = template.layout.find((l) => l.i === id);
        if (!inst || !lay)
            return;
        update((d) => ({ ...d, widgets: [...d.widgets, inst], layout: appendItem(d.layout, { ...lay, w: lay.w === 12 ? 12 : Math.max(lay.w, 6) }) }));
    };
    const [gallery, setGallery] = useState(false);
    const add = ({ instance, size }: GalleryPick) => {
        const id = newId(instance.type);
        update((d) => ({ ...d, widgets: [...d.widgets, { ...instance, id }], layout: appendItem(d.layout, { i: id, x: 0, y: 0, w: size.w, h: size.h }) }));
        toast(`Added “${instance.title ?? widgetDef(instance.type)?.title ?? instance.type}”`);
    };
    return (<div className="flex flex-wrap items-center gap-2.5 rounded-mini border border-dashed border-teal/30 bg-teal/4 px-[18px] py-3.5" role="region" aria-label="Layout editor">
      <span className="font-mono text-meta tracking-meta text-accent uppercase">Editing layout</span>
      <span className="text-[13px] text-muted-3">Move, resize or remove widgets. Layout saves automatically.</span>
      <span aria-live="polite" className={cn("font-mono text-micro tracking-label uppercase", saveStatus === "error" ? "text-crit" : "text-faint")}>
        {SAVE_LABEL[saveStatus]}
      </span>
      <div className="flex-1"/>
      {hidden.map((w) => (<button key={w.id} type="button" onClick={() => restore(w.id)} className="rounded-pill border border-teal/30 px-3.5 py-1.5 text-xs text-accent hover:border-teal/60">
          + {w.title ?? widgetDef(w.type)?.title}
        </button>))}
      <button type="button" onClick={() => setGallery(true)} className="rounded-pill border border-teal/30 bg-teal-t px-3.5 py-1.5 text-xs font-semibold text-accent hover:border-teal/60">
        + Add widget
      </button>
      <WidgetGallery open={gallery} onOpenChange={setGallery} onPick={add}/>
      <IconButton label="Undo (⌘Z)" onClick={undo} disabled={!canUndo} className="disabled:opacity-40">
        ↶
      </IconButton>
      <IconButton label="Redo (⌘⇧Z)" onClick={redo} disabled={!canRedo} className="disabled:opacity-40">
        ↷
      </IconButton>
    </div>);
}
