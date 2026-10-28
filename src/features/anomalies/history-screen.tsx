"use client";
import Link from "next/link";
import { parseAsString, parseAsStringEnum, useQueryState } from "nuqs";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ErrorState, Refetching, SkeletonLines } from "@/components/ui/feedback";
import { Select } from "@/components/ui/inputs";
import { Drawer } from "@/components/ui/overlays";
import { Pill, SEVERITY_META } from "@/components/ui/status";
import { Card, CardHeader, CodeBlock } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useAlertChannels, useAlertRoutes, useDeliveries, useRetryDelivery } from "@/lib/api/alerts";
import { useAnomalies, useSignalAction } from "@/lib/api/analytics";
import { useCan } from "@/lib/api/auth";
import { useCampaignOptions } from "@/lib/api/anomalies-ui";
import type { AlertDelivery, DeliveryStatus } from "@/lib/domain/contracts/alerts";
import type { SignalView } from "@/lib/domain/contracts/anomaly";
import { DELIVERY_STATUS_META, deliverySignals, PLUGIN_META } from "./helpers/alerts";
import { STATUS_LABEL } from "./helpers/signals";
import { formatDateTime, relativeTime } from "./helpers/time";
import { ActionLink, useNow, useValueFormat } from "./shared";
const DELIVERY_FILTERS = ["sent", "failed", "suppressed", "deferred", "pending"] as const satisfies readonly DeliveryStatus[];
type DeliveryFilter = (typeof DELIVERY_FILTERS)[number] | "all";
const urlOpts = { history: "replace" as const, scroll: false };
function SeverityCell({ severity }: {
    severity: SignalView["severity"] | null;
}) {
    if (!severity)
        return <span className="text-faint">—</span>;
    return <Pill tone={SEVERITY_META[severity].tone}>{SEVERITY_META[severity].label}</Pill>;
}
function prettyPayload(raw: string): string {
    try {
        return JSON.stringify(JSON.parse(raw), null, 2);
    }
    catch {
        return raw;
    }
}
function retryLabel(d: AlertDelivery): string | null {
    if (d.dryRun)
        return null;
    if (d.status === "failed")
        return "Retry";
    if (d.status === "deferred" || d.status === "suppressed")
        return "Send now";
    return null;
}
export function HistoryScreen() {
    const now = useNow();
    const { timeZone } = useValueFormat();
    const [statusParam, setStatusParam] = useQueryState("delivery", parseAsStringEnum<(typeof DELIVERY_FILTERS)[number]>([...DELIVERY_FILTERS]).withOptions(urlOpts));
    const [channelParam, setChannelParam] = useQueryState("channel", parseAsString.withOptions(urlOpts));
    const [detail, setDetail] = useState<AlertDelivery | null>(null);
    const deliveries = useDeliveries({ status: statusParam ?? undefined, channelId: channelParam ?? undefined });
    const channels = useAlertChannels();
    const routes = useAlertRoutes();
    const campaigns = useCampaignOptions();
    const feed = useAnomalies({});
    const retry = useRetryDelivery();
    const action = useSignalAction();
    const can = useCan();
    const items = useMemo(() => deliveries.data?.pages.flatMap((p) => p.items) ?? [], [deliveries.data]);
    const signalsById = useMemo(() => new Map((feed.data?.signals ?? []).map((s) => [s.id, s])), [feed.data]);
    const campaignNames = useMemo(() => new Map((campaigns.data ?? []).map((c) => [c.id, c.name])), [campaigns.data]);
    const routeNames = useMemo(() => new Map((routes.data ?? []).map((r) => [r.id, r.name])), [routes.data]);
    const lifecycle = useMemo(() => (feed.data?.signals ?? []).filter((s) => s.status !== "open"), [feed.data]);
    const filter: DeliveryFilter = statusParam ?? "all";
    const runRetry = (d: AlertDelivery) => retry.mutate(d.id, {
        onSuccess: (r) => {
            toast(r.status === "sent" ? `Delivered to “${r.channelName}”` : `${DELIVERY_STATUS_META[r.status].label}: ${r.lastError ?? r.reason ?? "see the log"}`, { tone: r.status === "sent" ? "default" : "crit" });
            setDetail((cur) => (cur?.id === d.id ? r : cur));
        },
        onError: (e) => toast(e.message || "Couldn't retry the delivery", { tone: "crit" }),
    });
    const deliveryColumns: Column<AlertDelivery>[] = [
        {
            key: "ts",
            header: "Time",
            width: "104px",
            sortValue: (d) => d.ts,
            cell: (d) => (<span className="font-mono text-meta text-muted" title={formatDateTime(d.ts, timeZone)}>
          {relativeTime(d.ts, now) || formatDateTime(d.ts, timeZone)}
        </span>),
        },
        {
            key: "channel",
            header: "Channel",
            width: "minmax(130px,1fr)",
            sortValue: (d) => d.channelName.toLowerCase(),
            cell: (d) => (<span className="flex min-w-0 flex-col">
          <span className="truncate">{d.channelName}</span>
          <span className="font-mono text-micro tracking-label text-faint uppercase">{PLUGIN_META[d.pluginId]?.label ?? d.pluginId}</span>
        </span>),
        },
        { key: "route", header: "Route", width: "minmax(110px,0.9fr)", cell: (d) => <span className="block truncate text-muted">{d.routeId ? (routeNames.get(d.routeId) ?? d.routeId) : d.kind === "test" ? "Test" : "—"}</span> },
        {
            key: "signal",
            header: "Signal",
            width: "minmax(180px,1.8fr)",
            cell: (d) => {
                const info = deliverySignals(d, signalsById, campaignNames);
                return (<span className="flex min-w-0 flex-col">
            <span className="truncate">{info.label}</span>
            {info.campaign ? <span className="truncate text-xs text-muted-3">{info.campaign}</span> : null}
          </span>);
            },
        },
        { key: "severity", header: "Severity", width: "104px", cell: (d) => <SeverityCell severity={deliverySignals(d, signalsById, campaignNames).severity}/> },
        {
            key: "status",
            header: "Status",
            width: "104px",
            sortValue: (d) => d.status,
            cell: (d) => (<span className="flex flex-col items-start gap-1">
          <Pill tone={DELIVERY_STATUS_META[d.status].tone}>{DELIVERY_STATUS_META[d.status].label}</Pill>
          {d.dryRun ? <span className="font-mono text-micro text-faint">dry run</span> : null}
        </span>),
        },
        { key: "attempts", header: "Tries", width: "52px", align: "right", sortValue: (d) => d.attempts, cell: (d) => <span className="tabular">{d.attempts}</span> },
        {
            key: "error",
            header: "Error / reason",
            width: "minmax(150px,1.4fr)",
            cell: (d) => d.lastError ? (<span className="line-clamp-2 text-xs text-crit" title={d.lastError}>
            {d.httpStatus ? `HTTP ${d.httpStatus} · ` : ""}
            {d.lastError}
          </span>) : d.reason ? (<span className="line-clamp-2 text-xs text-muted-3" title={d.reason}>
            {d.reason}
          </span>) : (<span className="text-faint">—</span>),
        },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            width: "76px",
            align: "right",
            cell: (d) => {
                const label = retryLabel(d);
                if (!label)
                    return null;
                return (<span onClick={(e) => e.stopPropagation()}>
            <ActionLink tone={d.status === "failed" ? "accent" : "muted"} onClick={() => runRetry(d)} disabled={retry.isPending && retry.variables === d.id}>
              {retry.isPending && retry.variables === d.id ? "Sending…" : label}
            </ActionLink>
          </span>);
            },
        },
    ];
    const lifecycleColumns: Column<SignalView>[] = [
        {
            key: "signal",
            header: "Signal",
            width: "minmax(200px,2fr)",
            sortValue: (s) => s.title,
            cell: (s) => (<span className="flex min-w-0 flex-col">
          <Link href={`/anomalies?focus=${encodeURIComponent(s.id)}`} className="truncate text-fg hover:text-accent">
            {s.title}
          </Link>
          <span className="truncate text-xs text-muted-3">{s.entity.name}</span>
        </span>),
        },
        { key: "severity", header: "Severity", width: "104px", sortValue: (s) => (s.severity === "critical" ? 3 : s.severity === "warning" ? 2 : 1), cell: (s) => <SeverityCell severity={s.severity}/> },
        {
            key: "status",
            header: "Status",
            width: "minmax(120px,1fr)",
            sortValue: (s) => s.status,
            cell: (s) => (<span className="flex flex-col items-start gap-1">
          <Pill tone="muted">{STATUS_LABEL[s.status]}</Pill>
          {s.status === "snoozed" && s.snoozedUntil ? <span className="text-xs text-muted-3">{`until ${formatDateTime(s.snoozedUntil, timeZone)}`}</span> : null}
        </span>),
        },
        {
            key: "first",
            header: "First seen",
            width: "112px",
            sortValue: (s) => s.firstSeenAt ?? "",
            cell: (s) => (<span className="font-mono text-meta text-muted" title={formatDateTime(s.firstSeenAt, timeZone)}>
          {s.firstSeenAt ? relativeTime(s.firstSeenAt, now) || formatDateTime(s.firstSeenAt, timeZone) : "—"}
        </span>),
        },
        {
            key: "notes",
            header: "Notes",
            width: "minmax(180px,2fr)",
            sortValue: (s) => s.notes.length,
            cell: (s) => {
                const last = s.notes[s.notes.length - 1];
                if (!last)
                    return <span className="text-faint">—</span>;
                return (<span className="flex min-w-0 flex-col">
            <span className="line-clamp-2 text-xs text-muted">{last.text}</span>
            <span className="font-mono text-micro text-faint">{`${formatDateTime(last.at, timeZone)}${s.notes.length > 1 ? ` · +${s.notes.length - 1} earlier` : ""}`}</span>
          </span>);
            },
        },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            width: "64px",
            align: "right",
            cell: (s) => can("anomalies.manage") ? (<ActionLink tone="accent" onClick={() => action.mutate({ id: s.id, action: { action: "reopen" } }, { onSuccess: () => toast(`Reopened “${s.title}”`), onError: (e) => toast(e.message || "Couldn't reopen the signal", { tone: "crit" }) })}>
            Reopen
          </ActionLink>) : null,
        },
    ];
    const detailInfo = detail ? deliverySignals(detail, signalsById, campaignNames) : null;
    const detailRetry = detail ? retryLabel(detail) : null;
    return (<div className="flex flex-col gap-6">
      <PageHeader />

      <Card className="flex flex-col gap-4">
        <CardHeader title="Delivery log" sub="Every send, suppression, deferral and retry · newest first" action={deliveries.isFetching && deliveries.data ? <span className="meta">Refreshing…</span> : null}/>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented ariaLabel="Delivery status" variant="sans" value={filter} onChange={(v) => void setStatusParam(v === "all" ? null : v)} options={[{ value: "all" as DeliveryFilter, label: "All" }, ...DELIVERY_FILTERS.map((s) => ({ value: s as DeliveryFilter, label: DELIVERY_STATUS_META[s].label }))]}/>
          <Select value={channelParam ?? ""} onChange={(e) => void setChannelParam(e.target.value || null)} aria-label="Channel" className="py-2">
            <option value="">All channels</option>
            {(channels.data ?? []).map((c) => (<option key={c.id} value={c.id}>
                {c.name}
              </option>))}
          </Select>
          <span className="meta ml-auto">{deliveries.data ? `${items.length}${deliveries.hasNextPage ? "+" : ""} shown` : ""}</span>
        </div>
        {deliveries.error && !deliveries.data ? <ErrorState error={deliveries.error} onRetry={() => void deliveries.refetch()}/> : null}
        {!deliveries.data && !deliveries.error ? <SkeletonLines lines={5}/> : null}
        {deliveries.data ? (<Refetching active={deliveries.isFetching && deliveries.isPlaceholderData}>
            <DataTable ariaLabel="Alert deliveries" rows={items} columns={deliveryColumns} rowKey={(d) => d.id} onRowClick={setDetail} initialSort={{ key: "ts", dir: "desc" }} minWidth={980} maxHeight={560} empty={filter === "all" && !channelParam ? (<span>
                    No deliveries yet. Add a channel and run alerts on the <Link href="/anomalies/notifications">Notifications</Link> page — every send, suppression and retry lands here.
                  </span>) : ("No deliveries match these filters.")}/>
          </Refetching>) : null}
        {deliveries.hasNextPage ? (<Button variant="ghost" size="xs" onClick={() => void deliveries.fetchNextPage()} loading={deliveries.isFetchingNextPage} className="self-center">
            Load older deliveries
          </Button>) : null}
      </Card>

      <Card className="flex flex-col gap-4">
        <CardHeader title="Signal lifecycle" sub="Acknowledged, snoozed and resolved signals in the current data window · with notes"/>
        {feed.error && !feed.data ? <ErrorState error={feed.error} onRetry={() => void feed.refetch()}/> : null}
        {!feed.data && !feed.error ? <SkeletonLines lines={4}/> : null}
        {feed.data ? (<DataTable ariaLabel="Signal lifecycle" rows={lifecycle} columns={lifecycleColumns} rowKey={(s) => s.id} initialSort={{ key: "first", dir: "desc" }} minWidth={860} empty={<span>
                Nothing acknowledged, snoozed or resolved yet. Actions on the <Link href="/anomalies">Signals</Link> page show up here with their notes.
              </span>}/>) : null}
        <p className="text-xs text-muted-3">Signals are re-detected every day; once a signal stops firing for two evaluations it resolves automatically and leaves this list.</p>
      </Card>

      <Drawer open={!!detail} onOpenChange={(o) => !o && setDetail(null)} eyebrow={detail ? `${detail.kind} · ${DELIVERY_STATUS_META[detail.status].label}` : "Delivery"} title={detail?.channelName ?? "Delivery"}>
        {detail && detailInfo ? (<>
            <div role="table" aria-label="Delivery details" className="flex flex-col">
              {[
                ["Time", formatDateTime(detail.ts, timeZone)],
                ["Channel", `${detail.channelName} · ${PLUGIN_META[detail.pluginId]?.label ?? detail.pluginId}`],
                ["Route", detail.routeId ? (routeNames.get(detail.routeId) ?? detail.routeId) : "—"],
                ["Status", `${DELIVERY_STATUS_META[detail.status].label}${detail.dryRun ? " (dry run)" : ""}`],
                ["Attempts", String(detail.attempts)],
                ...(detail.httpStatus ? [["HTTP status", String(detail.httpStatus)]] : []),
                ...(detail.sentAt ? [["Sent", formatDateTime(detail.sentAt, timeZone)]] : []),
                ...(detail.nextAttemptAt ? [["Next attempt", formatDateTime(detail.nextAttemptAt, timeZone)]] : []),
            ].map(([k, v]) => (<div key={k} role="row" className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b border-line-soft py-2 text-[13px]">
                  <span role="rowheader" className="text-muted-3">
                    {k}
                  </span>
                  <span role="cell">{v}</span>
                </div>))}
            </div>
            {detail.reason ? <p className="rounded-mini border border-line bg-fill px-3.5 py-3 text-[13px] leading-relaxed text-muted">{detail.reason}</p> : null}
            {detail.lastError ? (<p role="alert" className="rounded-mini border border-crit/25 bg-crit-t/40 px-3.5 py-3 text-[13px] leading-relaxed text-fg">
                {detail.lastError}
              </p>) : null}
            {detail.signalIds.length ? (<div className="flex flex-col gap-2">
                <span className="label-mono">{`Signals · ${detail.signalIds.length}`}</span>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]">
                  {detail.signalIds.slice(0, 12).map((id) => {
                    const s = signalsById.get(id);
                    return (<li key={id} className="flex items-baseline gap-2">
                        {s ? (<Link href={`/anomalies?focus=${encodeURIComponent(id)}`} onClick={() => setDetail(null)}>
                            {`${s.title} · ${s.entity.name}`}
                          </Link>) : (<span className="font-mono text-meta text-muted-3">{id}</span>)}
                      </li>);
                })}
                </ul>
              </div>) : null}
            {detail.payloadPreview ? (<div className="flex flex-col gap-2">
                <span className="label-mono">Payload preview · redacted</span>
                <CodeBlock className="max-h-72">{prettyPayload(detail.payloadPreview)}</CodeBlock>
              </div>) : null}
            {detailRetry && can("alerts.manage") ? (<div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
                {detail.status !== "failed" ? <span className="text-xs text-muted-3">Sends right away — bypasses quiet hours and the no-live-data gate.</span> : null}
                <Button variant="accent" onClick={() => runRetry(detail)} loading={retry.isPending && retry.variables === detail.id} className="self-start">
                  {detailRetry}
                </Button>
              </div>) : null}
          </>) : null}
      </Drawer>
    </div>);
}
