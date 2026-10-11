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
    onOpen: (茐壍: SavedQuestion) => void;
    onDeleted?: (俿壍: string) => void;
    limit?: number;
    compact?: boolean;
}
export function SavedQuestionList({ catalog: 滮壍, currentId: 距壍, onOpen: 嫌壍, onDeleted: 离壍, limit: 颪壍, compact: 料壍 }: ListProps) {
    const 蒈壍 = useQuestions();
    const 具壍 = useUpdateQuestion();
    const 灦壍 = useDeleteQuestion();
    const [轕壍, 屄壍] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [笳壍, 騢壍] = useState<SavedQuestion | null>(null);
    const 朑壍 = useRef(false);
    if (蒈壍.error)
        return <ErrorState error={蒈壍.error} onRetry={() => void 蒈壍.refetch()}/>;
    if (!蒈壍.data)
        return <SkeletonLines lines={3}/>;
    const 蘀壍 = 颪壍 ? 蒈壍.data.slice(0, 颪壍) : 蒈壍.data;
    if (!蘀壍.length)
        return 料壍 ? null : <EmptyState>No saved questions yet. Build one in the notebook and press Save.</EmptyState>;
    const 勯壍 = async (燞壍: SavedQuestion, 郍壍: string) => {
        屄壍(null);
        const 嶼壍 = 郍壍.trim();
        if (!嶼壍 || 嶼壍 === 燞壍.name)
            return;
        try {
            await 具壍.mutateAsync({ id: 燞壍.id, body: { name: 嶼壍, description: 燞壍.description, query: 燞壍.query, viz: 燞壍.viz, origin: 燞壍.origin } });
            toast(`Renamed to “${嶼壍}”`);
        }
        catch (粫壍) {
            toast((粫壍 as Error).message || "Couldn't rename", { tone: "crit" });
        }
    };
    return (<>
      <ul className="m-0 flex list-none flex-col p-0">
        {蘀壍.map((鮚壍) => {
            const 梉壍 = normalizeVizType(鮚壍.viz?.type ?? "table") ?? "table";
            const 蝸壍 = 鮚壍.id === 距壍;
            return (<li key={鮚壍.id} className={cn("flex items-start gap-3 border-b border-line-soft py-3 last:border-b-0", 蝸壍 && "rounded-mini bg-teal/4 px-2")}>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                {轕壍?.id === 鮚壍.id ? (<Input variant="field" autoFocus aria-label="Question name" value={轕壍.name} maxLength={120} onChange={(呧壍) => 屄壍({ id: 鮚壍.id, name: 呧壍.target.value })} onKeyDown={(獖壍) => {
                        if (獖壍.key === "Enter")
                            獖壍.currentTarget.blur();
                        if (獖壍.key === "Escape") {
                            獖壍.stopPropagation();
                            朑壍.current = true;
                            屄壍(null);
                        }
                    }} onBlur={() => {
                        if (朑壍.current)
                            朑壍.current = false;
                        else
                            void 勯壍(鮚壍, 轕壍.name);
                    }} className="py-1.5"/>) : (<button type="button" onClick={() => 嫌壍(鮚壍)} className="truncate text-left font-display text-[15px] font-semibold text-fg hover:text-accent">
                    {鮚壍.name}
                  </button>)}
                {鮚壍.description && !料壍 ? <span className="line-clamp-2 text-xs leading-relaxed text-muted-3">{鮚壍.description}</span> : null}
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-micro tracking-label text-faint uppercase">
                  <span>{VIZ_META[梉壍].label}</span>
                  <span aria-hidden>·</span>
                  <span>{sourceLabel(鮚壍.query.source)}</span>
                  <span aria-hidden>·</span>
                  <span className="normal-case tracking-normal">{autoTitle(鮚壍.query, 滮壍)}</span>
                  <span aria-hidden>·</span>
                  <span>{formatLong(鮚壍.updatedAt.slice(0, 10))}</span>
                  {蝸壍 ? <Pill tone="accent">Open</Pill> : null}
                </span>
              </div>
              <Button variant="link" className="mt-0.5 text-xs" onClick={() => 嫌壍(鮚壍)}>
                Open →
              </Button>
              <Menu trigger={<IconButton label={`More actions for ${鮚壍.name}`}>
                    <span aria-hidden>⋯</span>
                  </IconButton>} items={[
                    { label: "Rename", onSelect: () => 屄壍({ id: 鮚壍.id, name: 鮚壍.name }) },
                    { label: "Delete", danger: true, separatorBefore: true, onSelect: () => 騢壍(鮚壍) },
                ]}/>
            </li>);
        })}
      </ul>
      <ConfirmDialog open={!!笳壍} onOpenChange={(鉅壍) => !鉅壍 && 騢壍(null)} danger title={`Delete “${笳壍?.name ?? ""}”?`} description="The saved question is removed. Dashboard widgets made from it keep working — they hold their own copy." confirmLabel="Delete" onConfirm={() => {
            const 弴壍 = 笳壍;
            if (!弴壍)
                return;
            void 灦壍
                .mutateAsync(弴壍.id)
                .then(() => {
                toast(`Deleted “${弴壍.name}”`);
                离壍?.(弴壍.id);
            })
                .catch((縣壍: Error) => toast(縣壍.message || "Couldn't delete", { tone: "crit" }));
        }}/>
    </>);
}
export function SavedQuestionsDrawer({ open: 鴒壍, onOpenChange: 樁壍, ...裰壍 }: ListProps & {
    open: boolean;
    onOpenChange: (嗟壍: boolean) => void;
}) {
    return (<Drawer open={鴒壍} onOpenChange={樁壍} eyebrow="Explore" title="Saved questions">
      <SavedQuestionList {...裰壍} onOpen={(瓎壍) => {
            裰壍.onOpen(瓎壍);
            樁壍(false);
        }}/>
    </Drawer>);
}
