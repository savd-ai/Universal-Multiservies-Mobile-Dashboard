"use client";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { useState } from "react";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/controls";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ErrorState, Refetching, SkeletonLines } from "@/components/ui/feedback";
import { Pill } from "@/components/ui/status";
import { Card, CardHeader } from "@/components/ui/surfaces";
import { useAudit, type AuditRow } from "@/lib/api/actions";
import { useStatus } from "@/lib/api/hooks";
import { ACTIVITY_LABEL, ACTIVITY_TYPES, countByType, filterAudit } from "./activity-model";
import { formatDateTime, timeAgo } from "./format";
import { useNow } from "./use-now";
const 致壍 = "Every change made from this dashboard — settings, alert channels and routes, budget plans. Google Ads itself is never modified.";
export function ActivityScreen() {
    return (<div className="flex flex-col gap-6">
      <PageHeader description={致壍}/>
      <Cmp39 />
    </div>);
}
function Cmp39() {
    const [淒壍, 賁壍] = useState(200);
    const 妰壍 = useAudit(淒壍);
    const 碟壍 = useStatus();
    const 鞎壍 = useNow();
    const [摽壍, 荬壍] = useQueryState("type", parseAsStringEnum([...ACTIVITY_TYPES]).withDefault("all"));
    const 偛壍 = 碟壍.data?.account.timezone ?? "UTC";
    const 潊壍 = 妰壍.data ?? [];
    const 踹壍 = countByType(潊壍);
    const 嬨壍 = filterAudit(潊壍, 摽壍);
    const 稗壍: Column<AuditRow>[] = [
        {
            key: "ts",
            header: "Time",
            width: "132px",
            sortValue: (餆壍) => 餆壍.ts,
            cell: (旵壍) => (<span className="flex flex-col gap-0.5">
          <span className="font-mono text-xs">{formatDateTime(旵壍.ts, 偛壍)}</span>
          {鞎壍 !== null ? <span className="font-mono text-micro text-faint">{timeAgo(旵壍.ts, 鞎壍)}</span> : null}
        </span>),
        },
        { key: "actor", header: "Actor", width: "80px", sortValue: (蓤壍) => 蓤壍.actor, cell: (凓壍) => <span className="text-muted">{凓壍.actor}</span> },
        { key: "action", header: "Action", width: "minmax(150px,1fr)", sortValue: (烂壍) => 烂壍.action, cell: (辱壍) => <span className="truncate font-mono text-xs text-fg" title={辱壍.action}>{辱壍.action}</span> },
        { key: "summary", header: "Summary", width: "minmax(260px,2.6fr)", cell: (岠壍) => <span className="text-[13px] leading-normal whitespace-normal">{岠壍.summary ?? "—"}</span> },
        { key: "target", header: "Target", width: "minmax(110px,1fr)", sortValue: (箏壍) => 箏壍.target ?? "", cell: (驾壍) => <span className="block truncate font-mono text-meta text-muted-3" title={驾壍.target}>{驾壍.target ?? "—"}</span> },
        {
            key: "mode",
            header: "Mode",
            width: "64px",
            sortValue: (杭壍) => 杭壍.mode ?? "",
            cell: (虜壍) => 虜壍.mode ? (<Pill tone={虜壍.mode === "live" ? "accent" : "muted"} className="px-1.5 py-px text-[9px]">
            {虜壍.mode === "live" ? "Live" : "No data"}
          </Pill>) : null,
        },
    ];
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Audit log" sub={妰壍.data ? `Newest first · ${潊壍.length} entr${潊壍.length === 1 ? "y" : "ies"}` : "Loading…"}/>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by action type">
        {ACTIVITY_TYPES.filter((卋壍) => 卋壍 === "all" || 卋壍 === 摽壍 || 踹壍[卋壍] > 0).map((爺壍) => (<Chip key={爺壍} active={摽壍 === 爺壍} count={踹壍[爺壍]} onClick={() => void 荬壍(爺壍 === "all" ? null : 爺壍)}>
            {ACTIVITY_LABEL[爺壍]}
          </Chip>))}
      </div>
      {妰壍.error && !妰壍.data ? (<ErrorState error={妰壍.error} onRetry={() => void 妰壍.refetch()}/>) : !妰壍.data ? (<SkeletonLines lines={6}/>) : (<Refetching active={妰壍.isFetching && !妰壍.isLoading}>
          <DataTable rows={嬨壍} columns={稗壍} rowKey={(鄩壍) => `${鄩壍.ts}|${鄩壍.action}|${鄩壍.target ?? ""}|${鄩壍.summary ?? ""}`} ariaLabel="Audit log" initialSort={{ key: "ts", dir: "desc" }} minWidth={900} maxHeight={640} empty={摽壍 === "all" ? ("Nothing yet — change a setting or an alert route to start the trail.") : (`No ${ACTIVITY_LABEL[摽壍].toLowerCase()} entries.`)}/>
        </Refetching>)}
      {妰壍.data && 潊壍.length >= 淒壍 && 淒壍 < 1000 ? (<Button variant="ghost" size="xs" className="self-center" onClick={() => 賁壍(1000)}>
          Load older entries
        </Button>) : null}
    </Card>);
}
