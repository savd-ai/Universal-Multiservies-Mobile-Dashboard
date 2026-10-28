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
const DESCRIPTION = "Every change made from this dashboard — settings, alert channels and routes, budget plans. Google Ads itself is never modified.";
export function ActivityScreen() {
    return (<div className="flex flex-col gap-6">
      <PageHeader description={DESCRIPTION}/>
      <SimulatedActions />
    </div>);
}
function SimulatedActions() {
    const [limit, setLimit] = useState(200);
    const audit = useAudit(limit);
    const status = useStatus();
    const now = useNow();
    const [first, setType] = useQueryState("type", parseAsStringEnum([...ACTIVITY_TYPES]).withDefault("all"));
    const tz = status.data?.account.timezone ?? "UTC";
    const rows = audit.data ?? [];
    const counts = countByType(rows);
    const visible = filterAudit(rows, first);
    const columns: Column<AuditRow>[] = [
        {
            key: "ts",
            header: "Time",
            width: "132px",
            sortValue: (r) => r.ts,
            cell: (r) => (<span className="flex flex-col gap-0.5">
          <span className="font-mono text-xs">{formatDateTime(r.ts, tz)}</span>
          {now !== null ? <span className="font-mono text-micro text-faint">{timeAgo(r.ts, now)}</span> : null}
        </span>),
        },
        { key: "actor", header: "Actor", width: "80px", sortValue: (r) => r.actor, cell: (r) => <span className="text-muted">{r.actor}</span> },
        { key: "action", header: "Action", width: "minmax(150px,1fr)", sortValue: (r) => r.action, cell: (r) => <span className="truncate font-mono text-xs text-fg" title={r.action}>{r.action}</span> },
        { key: "summary", header: "Summary", width: "minmax(260px,2.6fr)", cell: (r) => <span className="text-[13px] leading-normal whitespace-normal">{r.summary ?? "—"}</span> },
        { key: "target", header: "Target", width: "minmax(110px,1fr)", sortValue: (r) => r.target ?? "", cell: (r) => <span className="block truncate font-mono text-meta text-muted-3" title={r.target}>{r.target ?? "—"}</span> },
        {
            key: "mode",
            header: "Mode",
            width: "64px",
            sortValue: (r) => r.mode ?? "",
            cell: (r) => r.mode ? (<Pill tone={r.mode === "live" ? "accent" : "muted"} className="px-1.5 py-px text-[9px]">
            {r.mode === "live" ? "Live" : "Demo"}
          </Pill>) : null,
        },
    ];
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Audit log" sub={audit.data ? `Newest first · ${rows.length} entr${rows.length === 1 ? "y" : "ies"}` : "Loading…"}/>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by action type">
        {ACTIVITY_TYPES.filter((t) => t === "all" || t === first || counts[t] > 0).map((t) => (<Chip key={t} active={first === t} count={counts[t]} onClick={() => void setType(t === "all" ? null : t)}>
            {ACTIVITY_LABEL[t]}
          </Chip>))}
      </div>
      {audit.error && !audit.data ? (<ErrorState error={audit.error} onRetry={() => void audit.refetch()}/>) : !audit.data ? (<SkeletonLines lines={6}/>) : (<Refetching active={audit.isFetching && !audit.isLoading}>
          <DataTable rows={visible} columns={columns} rowKey={(r) => `${r.ts}|${r.action}|${r.target ?? ""}|${r.summary ?? ""}`} ariaLabel="Audit log" initialSort={{ key: "ts", dir: "desc" }} minWidth={900} maxHeight={640} empty={first === "all" ? ("Nothing yet — change a setting or an alert route to start the trail.") : (`No ${ACTIVITY_LABEL[first].toLowerCase()} entries.`)}/>
        </Refetching>)}
      {audit.data && rows.length >= limit && limit < 1000 ? (<Button variant="ghost" size="xs" className="self-center" onClick={() => setLimit(1000)}>
          Load older entries
        </Button>) : null}
    </Card>);
}
