"use client";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { ErrorState, InlineEmpty, Refetching, SkeletonLines } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/inputs";
import { CharCounter, Pill } from "@/components/ui/status";
import { Card, CardHeader } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useCreateAnnotation, useDeleteAnnotation } from "@/lib/api/campaigns";
import { useAnnotations, useStatus, type AnnotationMark } from "@/lib/api/hooks";
import type { CampaignDetail } from "@/lib/domain/contracts/actions";
import { addDays, formatLong, isCivilDate } from "@/lib/domain/dates";
const KINDS = [
    { value: "note", label: "Note" },
    { value: "launch", label: "Launch" },
    { value: "promo", label: "Promo" },
    { value: "incident", label: "Incident" },
] as const;
type Kind = (typeof KINDS)[number]["value"];
const MAX = 280;
const kindLabel = (k: string) => KINDS.find((x) => x.value === k)?.label ?? k;
export function NotesTab({ detail: d }: {
    detail: CampaignDetail;
}) {
    const status = useStatus();
    const end = status.data?.dataThrough ?? d.range.end;
    const today = status.data?.today ?? end;
    const notes = useAnnotations(addDays(end, -364), today, { campaignId: d.campaign.id });
    const create = useCreateAnnotation();
    const remove = useDeleteAnnotation();
    const [date, setDate] = useState(end);
    const [kind, setKind] = useState<Kind>("note");
    const [text, setText] = useState("");
    const valid = text.trim().length > 0 && text.length <= MAX && isCivilDate(date) && date <= today;
    const submit = (e: {
        preventDefault: () => void;
    }) => {
        e.preventDefault();
        if (!valid)
            return;
        create.mutate({ date, kind, text: text.trim(), campaignId: d.campaign.id }, {
            onSuccess: () => {
                setText("");
                toast("Note added");
            },
            onError: (err) => toast((err as Error).message || "Could not save the note", { tone: "crit" }),
        });
    };
    const del = (a: AnnotationMark) => remove.mutate(a.id, {
        onSuccess: () => toast("Note deleted", {
            action: { label: "Undo", onClick: () => create.mutate({ date: a.date, text: a.text, kind: (KINDS.some((k) => k.value === a.kind) ? a.kind : "note") as Kind, campaignId: a.campaignId }) },
        }),
        onError: (err) => toast((err as Error).message || "Could not delete the note", { tone: "crit" }),
    });
    const list = [...(notes.data ?? [])].filter((a) => a.source === "note").sort((a, b) => b.date.localeCompare(a.date));
    return (<div className="grid grid-cols-1 items-start gap-5 wide:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="flex flex-col gap-4">
        <CardHeader title="Add a note" sub="Shown as a marker on this campaign's charts"/>
        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">{(id) => <Input id={id} variant="field" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required/>}</Field>
            <Field label="Kind">
              {(id) => (<Select id={id} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                  {KINDS.map((k) => (<option key={k.value} value={k.value}>
                      {k.label}
                    </option>))}
                </Select>)}
            </Field>
          </div>
          <Field label="Note" aside={<CharCounter length={text.length} max={MAX}/>}>
            {(id) => (<Textarea id={id} value={text} maxLength={MAX + 40} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                    submit(e);
            }} placeholder="e.g. Landing page A/B test started, promo code FALL20 live"/>)}
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="accent" size="sm" disabled={!valid} loading={create.isPending}>
              Add note
            </Button>
            <span className="text-xs text-muted-3">Stored in the dashboard — Google Ads is not changed.</span>
          </div>
        </form>
      </Card>

      <Card className="flex min-w-0 flex-col gap-3">
        <CardHeader title="Notes" sub={notes.data ? `${list.length} note${list.length === 1 ? "" : "s"} · last 12 months` : "Last 12 months"}/>
        {notes.error && !notes.data ? (<ErrorState error={notes.error} onRetry={() => void notes.refetch()}/>) : !notes.data ? (<SkeletonLines lines={4}/>) : list.length === 0 ? (<InlineEmpty>No notes yet. Add launches, promos or incidents to explain changes in the charts.</InlineEmpty>) : (<Refetching active={notes.isFetching} className="flex flex-col">
            {list.map((a) => (<div key={a.id} className="flex items-start gap-3.5 border-b border-line-soft py-3 last:border-b-0">
                <span className="w-[92px] shrink-0 pt-0.5 font-mono text-micro tracking-[0.06em] text-muted-3 uppercase">{formatLong(a.date)}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <Pill tone="muted">{kindLabel(a.kind)}</Pill>
                    <span className="font-mono text-micro tracking-label text-faint uppercase">{a.campaignId ? "This campaign" : "Account-wide"}</span>
                  </span>
                  <span className="text-[13px] leading-normal break-words">{a.text}</span>
                </div>
                <IconButton label="Delete note" onClick={() => del(a)} disabled={remove.isPending && remove.variables === a.id}>
                  ×
                </IconButton>
              </div>))}
          </Refetching>)}
      </Card>
    </div>);
}
