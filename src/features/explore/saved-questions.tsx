"use client";
import { useRef, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { EmptyState, ErrorState, SkeletonLines } from "@/components/ui/feedback";
import { Input } from "@/components/ui/inputs";
import { ConfirmDialog, Drawer, Menu } from "@/components/ui/overlays";
import { Pill } from "@/components/ui/status";
import { toast } from "@/components/ui/toast";
import { useDeleteQuestion, useUpdateQuestion } from "@/lib/api/explore";
import { useQuestions, type Catalog } from "@/lib/api/hooks";
import type { SavedQuestion } from "@/lib/domain/contracts/dashboard";
import { formatLong } from "@/lib/domain/dates";
import { normalizeVizType } from "./codec";
import { autoTitle, sourceLabel } from "./describe";
import { VIZ_META } from "./viz-suggest";
interface ListProps {
    catalog?: Catalog;
    currentId?: string | null;
    onOpen: (q: SavedQuestion) => void;
    onDeleted?: (id: string) => void;
    limit?: number;
    compact?: boolean;
}
export function SavedQuestionList({ catalog, currentId, onOpen, onDeleted, limit, compact }: ListProps) {
    const questions = useQuestions();
    const update = useUpdateQuestion();
    const del = useDeleteQuestion();
    const [renaming, setRenaming] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [deleting, setDeleting] = useState<SavedQuestion | null>(null);
    const skipBlur = useRef(false);
    if (questions.error)
        return <ErrorState error={questions.error} onRetry={() => void questions.refetch()}/>;
    if (!questions.data)
        return <SkeletonLines lines={3}/>;
    const list = limit ? questions.data.slice(0, limit) : questions.data;
    if (!list.length)
        return compact ? null : <EmptyState>No saved questions yet. Build one in the notebook and press Save.</EmptyState>;
    const rename = async (q: SavedQuestion, name: string) => {
        setRenaming(null);
        const next = name.trim();
        if (!next || next === q.name)
            return;
        try {
            await update.mutateAsync({ id: q.id, body: { name: next, description: q.description, query: q.query, viz: q.viz, origin: q.origin } });
            toast(`Renamed to “${next}”`);
        }
        catch (e) {
            toast((e as Error).message || "Couldn't rename", { tone: "crit" });
        }
    };
    return (<>
      <ul className="m-0 flex list-none flex-col p-0">
        {list.map((q) => {
            const vizType = normalizeVizType(q.viz?.type ?? "table") ?? "table";
            const isCurrent = q.id === currentId;
            return (<li key={q.id} className={cn("flex items-start gap-3 border-b border-line-soft py-3 last:border-b-0", isCurrent && "rounded-mini bg-teal/4 px-2")}>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {renaming?.id === q.id ? (<Input variant="field" autoFocus aria-label="Question name" value={renaming.name} maxLength={120} onChange={(e) => setRenaming({ id: q.id, name: e.target.value })} onKeyDown={(e) => {
                        if (e.key === "Enter")
                            e.currentTarget.blur();
                        if (e.key === "Escape") {
                            e.stopPropagation();
                            skipBlur.current = true;
                            setRenaming(null);
                        }
                    }} onBlur={() => {
                        if (skipBlur.current)
                            skipBlur.current = false;
                        else
                            void rename(q, renaming.name);
                    }} className="py-1.5"/>) : (<button type="button" onClick={() => onOpen(q)} className="truncate text-left font-display text-[15px] font-semibold text-fg hover:text-accent">
                    {q.name}
                  </button>)}
                {q.description && !compact ? <span className="line-clamp-2 text-xs leading-relaxed text-muted-3">{q.description}</span> : null}
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-micro tracking-label text-faint uppercase">
                  <span>{VIZ_META[vizType].label}</span>
                  <span aria-hidden>·</span>
                  <span>{sourceLabel(q.query.source)}</span>
                  <span aria-hidden>·</span>
                  <span className="normal-case tracking-normal">{autoTitle(q.query, catalog)}</span>
                  <span aria-hidden>·</span>
                  <span>{formatLong(q.updatedAt.slice(0, 10))}</span>
                  {isCurrent ? <Pill tone="accent">Open</Pill> : null}
                </span>
              </div>
              <Button variant="link" className="mt-0.5 text-xs" onClick={() => onOpen(q)}>
                Open →
              </Button>
              <Menu trigger={<IconButton label={`More actions for ${q.name}`}>
                    <span aria-hidden>⋯</span>
                  </IconButton>} items={[
                    { label: "Rename", onSelect: () => setRenaming({ id: q.id, name: q.name }) },
                    { label: "Delete", danger: true, separatorBefore: true, onSelect: () => setDeleting(q) },
                ]}/>
            </li>);
        })}
      </ul>
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} danger title={`Delete “${deleting?.name ?? ""}”?`} description="The saved question is removed. Dashboard widgets made from it keep working — they hold their own copy." confirmLabel="Delete" onConfirm={() => {
            const q = deleting;
            if (!q)
                return;
            void del
                .mutateAsync(q.id)
                .then(() => {
                toast(`Deleted “${q.name}”`);
                onDeleted?.(q.id);
            })
                .catch((e: Error) => toast(e.message || "Couldn't delete", { tone: "crit" }));
        }}/>
    </>);
}
export function SavedQuestionsDrawer({ open, onOpenChange, ...list }: ListProps & {
    open: boolean;
    onOpenChange: (o: boolean) => void;
}) {
    return (<Drawer open={open} onOpenChange={onOpenChange} eyebrow="Explore" title="Saved questions">
      <SavedQuestionList {...list} onOpen={(q) => {
            list.onOpen(q);
            onOpenChange(false);
        }}/>
    </Drawer>);
}
