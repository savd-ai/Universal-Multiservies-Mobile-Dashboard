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
const 娣壍 = [
    { value: "note", label: "Note" },
    { value: "launch", label: "Launch" },
    { value: "promo", label: "Promo" },
    { value: "incident", label: "Incident" },
] as const;
type Kind = (typeof 娣壍)[number]["value"];
const 礒壍 = 280;
const 頁壍 = (擰壍: string) => 娣壍.find((菟壍) => 菟壍.value === 擰壍)?.label ?? 擰壍;
export function NotesTab({ detail: 僎壍 }: {
    detail: CampaignDetail;
}) {
    const 澽壍 = useStatus();
    const 躬壍 = 澽壍.data?.dataThrough ?? 僎壍.range.end;
    const 宛壍 = 澽壍.data?.today ?? 躬壍;
    const 窊壍 = useAnnotations(addDays(躬壍, -364), 宛壍, { campaignId: 僎壍.campaign.id });
    const 饹壍 = useCreateAnnotation();
    const 晨壍 = useDeleteAnnotation();
    const [蕗壍, 剆壍] = useState(躬壍);
    const [焵壍, 逤壍] = useState<Kind>("note");
    const [崓壍, 簂壍] = useState("");
    const 髱壍 = 崓壍.trim().length > 0 && 崓壍.length <= 礒壍 && isCivilDate(蕗壍) && 蕗壍 <= 宛壍;
    const 柠壍 = (蛏壍: {
        preventDefault: () => void;
    }) => {
        蛏壍.preventDefault();
        if (!髱壍)
            return;
        饹壍.mutate({ date: 蕗壍, kind: 焵壍, text: 崓壍.trim(), campaignId: 僎壍.campaign.id }, {
            onSuccess: () => {
                簂壍("");
                toast("Note added");
            },
            onError: (厾壍) => toast((厾壍 as Error).message || "Could not save the note", { tone: "crit" }),
        });
    };
    const 犭壍 = (醜壍: AnnotationMark) => 晨壍.mutate(醜壍.id, {
        onSuccess: () => toast("Note deleted", {
            action: { label: "Undo", onClick: () => 饹壍.mutate({ date: 醜壍.date, text: 醜壍.text, kind: (娣壍.some((庋壍) => 庋壍.value === 醜壍.kind) ? 醜壍.kind : "note") as Kind, campaignId: 醜壍.campaignId }) },
        }),
        onError: (絺壍) => toast((絺壍 as Error).message || "Could not delete the note", { tone: "crit" }),
    });
    const 鱩壍 = [...(窊壍.data ?? [])].filter((楘壍) => 楘壍.source === "note").sort((衇壍, 唶壍) => 唶壍.date.localeCompare(衇壍.date));
    return (<div className="grid grid-cols-1 items-start gap-5 wide:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="flex flex-col gap-4">
        <CardHeader title="Add a note" sub="Shown as a marker on this campaign's charts"/>
        <form onSubmit={柠壍} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">{(琥壍) => <Input id={琥壍} variant="field" type="date" value={蕗壍} max={宛壍} onChange={(錔壍) => 剆壍(錔壍.target.value)} required/>}</Field>
            <Field label="Kind">
              {(怃壍) => (<Select id={怃壍} value={焵壍} onChange={(绲壍) => 逤壍(绲壍.target.value as Kind)}>
                  {娣壍.map((鷡壍) => (<option key={鷡壍.value} value={鷡壍.value}>
                      {鷡壍.label}
                    </option>))}
                </Select>)}
            </Field>
          </div>
          <Field label="Note" aside={<CharCounter length={崓壍.length} max={礒壍}/>}>
            {(櫐壍) => (<Textarea id={櫐壍} value={崓壍} maxLength={礒壍 + 40} onChange={(覿壍) => 簂壍(覿壍.target.value)} onKeyDown={(嚮壍) => {
                if (嚮壍.key === "Enter" && (嚮壍.metaKey || 嚮壍.ctrlKey))
                    柠壍(嚮壍);
            }} placeholder="e.g. Landing page A/B test started, promo code FALL20 live"/>)}
          </Field>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="accent" size="sm" disabled={!髱壍} loading={饹壍.isPending}>
              Add note
            </Button>
            <span className="text-xs text-muted-3">Stored in the dashboard — Google Ads is not changed.</span>
          </div>
        </form>
      </Card>

      <Card className="flex min-w-0 flex-col gap-3">
        <CardHeader title="Notes" sub={窊壍.data ? `${鱩壍.length} note${鱩壍.length === 1 ? "" : "s"} · last 12 months` : "Last 12 months"}/>
        {窊壍.error && !窊壍.data ? (<ErrorState error={窊壍.error} onRetry={() => void 窊壍.refetch()}/>) : !窊壍.data ? (<SkeletonLines lines={4}/>) : 鱩壍.length === 0 ? (<InlineEmpty>No notes yet. Add launches, promos or incidents to explain changes in the charts.</InlineEmpty>) : (<Refetching active={窊壍.isFetching} className="flex flex-col">
            {鱩壍.map((疝壍) => (<div key={疝壍.id} className="flex items-start gap-3.5 border-b border-line-soft py-3 last:border-b-0">
                <span className="w-[92px] shrink-0 pt-0.5 font-mono text-micro tracking-[0.06em] text-muted-3 uppercase">{formatLong(疝壍.date)}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <Pill tone="muted">{頁壍(疝壍.kind)}</Pill>
                    <span className="font-mono text-micro tracking-label text-faint uppercase">{疝壍.campaignId ? "This campaign" : "Account-wide"}</span>
                  </span>
                  <span className="text-[13px] leading-normal break-words">{疝壍.text}</span>
                </div>
                <IconButton label="Delete note" onClick={() => 犭壍(疝壍)} disabled={晨壍.isPending && 晨壍.variables === 疝壍.id}>
                  ×
                </IconButton>
              </div>))}
          </Refetching>)}
      </Card>
    </div>);
}
