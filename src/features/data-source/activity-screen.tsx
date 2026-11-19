"use client";

import Link from "next/link";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { useState } from "react";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Chip } from "@/components/ui/controls";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ErrorState, InlineEmpty, Refetching, SkeletonLines } from "@/components/ui/feedback";
import { Pill, SimulatedBadge } from "@/components/ui/status";
import { Card, CardHeader } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useActions, useAudit, useRevertAction, type AuditRow } from "@/lib/api/actions";
import { useStatus } from "@/lib/api/hooks";
import { ACTIVITY_LABEL, ACTIVITY_TYPES, countByType, filterAudit, SIMULATED_LABEL, sortActions } from "./activity-model";
import { formatDateTime, timeAgo } from "./format";
import { useNow } from "./use-now";

// Activity log (Data source › Activity): simulated demo actions with Revert, and the audit trail of everything
// changed from this dashboard, filterable by action family (?type=). Google Ads itself is never modified.

const DESCRIPTION = "Every change made from this dashboard — plugin connections, settings, alert routes, budget plans and simulated actions. Google Ads itself is never modified.";

export function ActivityScreen() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader description={DESCRIPTION} />
      <SimulatedActions />
      <AuditLog />
    </div>
  );
}

function SimulatedActions() {
  const actions = useActions();
  const revert = useRevertAction();
  const status = useStatus();
  const now = useNow();
  const tz = status.data?.account.timezone ?? "UTC";
  const list = sortActions(actions.data ?? []);
  const activeCount = list.filter((a) => !a.revertedAt).length;
  const when = (iso: string) => (now !== null ? timeAgo(iso, now) : formatDateTime(iso, tz));

  return (
    <Card className="flex flex-col gap-4">
      <CardHeader title="Simulated actions" sub="Demo overlays on this dashboard · revert any time" action={<span className="meta">{activeCount} active</span>} />
      {actions.error && !actions.data ? (
        <ErrorState error={actions.error} onRetry={() => void actions.refetch()} />
      ) : !actions.data ? (
        <SkeletonLines lines={3} />
      ) : list.length === 0 ? (
        <InlineEmpty>No simulated actions yet — pausing a campaign or applying a budget plan in demo mode shows up here.</InlineEmpty>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {list.map((a) => (
            <li key={a.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line-soft py-3 last:border-b-0", a.revertedAt && "opacity-60")}>
              <SimulatedBadge />
              <span className="w-[120px] shrink-0 font-mono text-micro tracking-label text-faint uppercase">{SIMULATED_LABEL[a.type] ?? a.type}</span>
              <span className="min-w-[200px] flex-1 text-[13px] leading-normal">{a.summary}</span>
              <span className="font-mono text-micro text-muted-3" title={formatDateTime(a.createdAt, tz)}>
                {when(a.createdAt)}
              </span>
              {a.revertedAt ? (
                <span className="w-[88px] text-right font-mono text-micro tracking-label text-muted-3 uppercase" title={formatDateTime(a.revertedAt, tz)}>
                  Reverted
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="xs"
                  className="w-[88px] justify-center"
                  loading={revert.isPending && revert.variables === a.id}
                  disabled={revert.isPending}
                  onClick={() => revert.mutate(a.id, { onSuccess: () => toast("Reverted"), onError: (e) => toast(e.message || "Revert failed", { tone: "crit" }) })}
                >
                  ↻ Revert
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <span className="text-xs leading-normal text-muted-3">Simulated · demo — these only change what this dashboard shows. In live mode every write is read-only and handed off as a deep link, change list or Ads Editor CSV.</span>
    </Card>
  );
}

function AuditLog() {
  const [limit, setLimit] = useState(200);
  const audit = useAudit(limit);
  const status = useStatus();
  const now = useNow();
  const [type, setType] = useQueryState("type", parseAsStringEnum([...ACTIVITY_TYPES]).withDefault("all"));
  const tz = status.data?.account.timezone ?? "UTC";
  const rows = audit.data ?? [];
  const counts = countByType(rows);
  const visible = filterAudit(rows, type);

  const columns: Column<AuditRow>[] = [
    {
      key: "ts",
      header: "Time",
      width: "132px",
      sortValue: (r) => r.ts,
      cell: (r) => (
        <span className="flex flex-col gap-0.5">
          <span className="font-mono text-xs">{formatDateTime(r.ts, tz)}</span>
          {now !== null ? <span className="font-mono text-micro text-faint">{timeAgo(r.ts, now)}</span> : null}
        </span>
      ),
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
      cell: (r) =>
        r.mode ? (
          <Pill tone={r.mode === "live" ? "accent" : "muted"} className="px-1.5 py-px text-[9px]">
            {r.mode === "live" ? "Live" : "Demo"}
          </Pill>
        ) : null,
    },
  ];

  return (
    <Card className="flex flex-col gap-4">
      <CardHeader title="Audit log" sub={audit.data ? `Newest first · ${rows.length} entr${rows.length === 1 ? "y" : "ies"}` : "Loading…"} />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by action type">
        {ACTIVITY_TYPES.filter((t) => t === "all" || t === type || counts[t] > 0).map((t) => (
          <Chip key={t} active={type === t} count={counts[t]} onClick={() => void setType(t === "all" ? null : t)}>
            {ACTIVITY_LABEL[t]}
          </Chip>
        ))}
      </div>
      {audit.error && !audit.data ? (
        <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />
      ) : !audit.data ? (
        <SkeletonLines lines={6} />
      ) : (
        <Refetching active={audit.isFetching && !audit.isLoading}>
          <DataTable
            rows={visible}
            columns={columns}
            rowKey={(r) => `${r.ts}|${r.action}|${r.target ?? ""}|${r.summary ?? ""}`}
            ariaLabel="Audit log"
            initialSort={{ key: "ts", dir: "desc" }}
            minWidth={900}
            maxHeight={640}
            empty={
              type === "all" ? (
                <>
                  Nothing yet — connect a plugin on <Link href="/plugins">Plugins</Link> or change a setting to start the trail.
                </>
              ) : (
                `No ${ACTIVITY_LABEL[type].toLowerCase()} entries.`
              )
            }
          />
        </Refetching>
      )}
      {audit.data && rows.length >= limit && limit < 1000 ? (
        <Button variant="ghost" size="xs" className="self-center" onClick={() => setLimit(1000)}>
          Load older entries
        </Button>
      ) : null}
    </Card>
  );
}
