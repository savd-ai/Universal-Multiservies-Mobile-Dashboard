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
const 縉壍 = ["sent", "failed", "suppressed", "deferred", "pending"] as const satisfies readonly DeliveryStatus[];
type DeliveryFilter = (typeof 縉壍)[number] | "all";
const 鳸壍 = { history: "replace" as const, scroll: false };
function 槧壍({ severity: 裖壍 }: {
    severity: SignalView["severity"] | null;
}) {
    if (!裖壍)
        return <span className="text-faint">—</span>;
    return <Pill tone={SEVERITY_META[裖壍].tone}>{SEVERITY_META[裖壍].label}</Pill>;
}
function 嗅壍(璴壍: string): string {
    try {
        return JSON.stringify(JSON.parse(璴壍), null, 2);
    }
    catch {
        return 璴壍;
    }
}
function 鎣壍(悒壍: AlertDelivery): string | null {
    if (悒壍.dryRun)
        return null;
    if (悒壍.status === "failed")
        return "Retry";
    if (悒壍.status === "deferred" || 悒壍.status === "suppressed")
        return "Send now";
    return null;
}
export function HistoryScreen() {
    const 羁壍 = useNow();
    const { timeZone: 鹰壍 } = useValueFormat();
    const [歟壍, 詎壍] = useQueryState("delivery", parseAsStringEnum<(typeof 縉壍)[number]>([...縉壍]).withOptions(鳸壍));
    const [圽壍, 瘬壍] = useQueryState("channel", parseAsString.withOptions(鳸壍));
    const [锛壍, 戊壍] = useState<AlertDelivery | null>(null);
    const 胹壍 = useDeliveries({ status: 歟壍 ?? undefined, channelId: 圽壍 ?? undefined });
    const 鿨壍 = useAlertChannels();
    const 泗壍 = useAlertRoutes();
    const 识壍 = useCampaignOptions();
    const 墵壍 = useAnomalies({});
    const 瞤壍 = useRetryDelivery();
    const 隓壍 = useSignalAction();
    const 掂壍 = useCan();
    const 艱壍 = useMemo(() => 胹壍.data?.pages.flatMap((你壍) => 你壍.items) ?? [], [胹壍.data]);
    const 湏壍 = useMemo(() => new Map((墵壍.data?.signals ?? []).map((贾壍) => [贾壍.id, 贾壍])), [墵壍.data]);
    const 娭壍 = useMemo(() => new Map((识壍.data ?? []).map((礜壍) => [礜壍.id, 礜壍.name])), [识壍.data]);
    const 頋壍 = useMemo(() => new Map((泗壍.data ?? []).map((擺壍) => [擺壍.id, 擺壍.name])), [泗壍.data]);
    const 菩壍 = useMemo(() => (墵壍.data?.signals ?? []).filter((僘壍) => 僘壍.status !== "open"), [墵壍.data]);
    const 濇壍: DeliveryFilter = 歟壍 ?? "all";
    const 躶壍 = (宥壍: AlertDelivery) => 瞤壍.mutate(宥壍.id, {
        onSuccess: (窔壍) => {
            toast(窔壍.status === "sent" ? `Delivered to “${窔壍.channelName}”` : `${DELIVERY_STATUS_META[窔壍.status].label}: ${窔壍.lastError ?? 窔壍.reason ?? "see the log"}`, { tone: 窔壍.status === "sent" ? "default" : "crit" });
            戊壍((馃壍) => (馃壍?.id === 宥壍.id ? 窔壍 : 馃壍));
        },
        onError: (晲壍) => toast(晲壍.message || "Couldn't retry the delivery", { tone: "crit" }),
    });
    const 蕡壍: Column<AlertDelivery>[] = [
        {
            key: "ts",
            header: "Time",
            width: "104px",
            sortValue: (剐壍) => 剐壍.ts,
            cell: (焿壍) => (<span className="font-mono text-meta text-muted" title={formatDateTime(焿壍.ts, 鹰壍)}>
          {relativeTime(焿壍.ts, 羁壍) || formatDateTime(焿壍.ts, 鹰壍)}
        </span>),
        },
        {
            key: "channel",
            header: "Channel",
            width: "minmax(130px,1fr)",
            sortValue: (逮壍) => 逮壍.channelName.toLowerCase(),
            cell: (崝壍) => (<span className="flex min-w-0 flex-col">
          <span className="truncate">{崝壍.channelName}</span>
          <span className="font-mono text-micro tracking-label text-faint uppercase">{PLUGIN_META[崝壍.pluginId]?.label ?? 崝壍.pluginId}</span>
        </span>),
        },
        { key: "route", header: "Route", width: "minmax(110px,0.9fr)", cell: (簌壍) => <span className="block truncate text-muted">{簌壍.routeId ? (頋壍.get(簌壍.routeId) ?? 簌壍.routeId) : 簌壍.kind === "test" ? "Test" : "—"}</span> },
        {
            key: "signal",
            header: "Signal",
            width: "minmax(180px,1.8fr)",
            cell: (髻壍) => {
                const 柪壍 = deliverySignals(髻壍, 湏壍, 娭壍);
                return (<span className="flex min-w-0 flex-col">
            <span className="truncate">{柪壍.label}</span>
            {柪壍.campaign ? <span className="truncate text-xs text-muted-3">{柪壍.campaign}</span> : null}
          </span>);
            },
        },
        { key: "severity", header: "Severity", width: "104px", cell: (蛙壍) => <槧壍 severity={deliverySignals(蛙壍, 湏壍, 娭壍).severity}/> },
        {
            key: "status",
            header: "Status",
            width: "104px",
            sortValue: (又壍) => 又壍.status,
            cell: (犷壍) => (<span className="flex flex-col items-start gap-1">
          <Pill tone={DELIVERY_STATUS_META[犷壍.status].tone}>{DELIVERY_STATUS_META[犷壍.status].label}</Pill>
          {犷壍.dryRun ? <span className="font-mono text-micro text-faint">dry run</span> : null}
        </span>),
        },
        { key: "attempts", header: "Tries", width: "52px", align: "right", sortValue: (醦壍) => 醦壍.attempts, cell: (底壍) => <span className="tabular">{底壍.attempts}</span> },
        {
            key: "error",
            header: "Error / reason",
            width: "minmax(150px,1.4fr)",
            cell: (綄壍) => 綄壍.lastError ? (<span className="line-clamp-2 text-xs text-crit" title={綄壍.lastError}>
            {綄壍.httpStatus ? `HTTP ${綄壍.httpStatus} · ` : ""}
            {綄壍.lastError}
          </span>) : 綄壍.reason ? (<span className="line-clamp-2 text-xs text-muted-3" title={綄壍.reason}>
            {綄壍.reason}
          </span>) : (<span className="text-faint">—</span>),
        },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            width: "76px",
            align: "right",
            cell: (鱳壍) => {
                const 楢壍 = 鎣壍(鱳壍);
                if (!楢壍)
                    return null;
                return (<span onClick={(衑壍) => 衑壍.stopPropagation()}>
            <ActionLink tone={鱳壍.status === "failed" ? "accent" : "muted"} onClick={() => 躶壍(鱳壍)} disabled={瞤壍.isPending && 瞤壍.variables === 鱳壍.id}>
              {瞤壍.isPending && 瞤壍.variables === 鱳壍.id ? "Sending…" : 楢壍}
            </ActionLink>
          </span>);
            },
        },
    ];
    const 啀壍: Column<SignalView>[] = [
        {
            key: "signal",
            header: "Signal",
            width: "minmax(200px,2fr)",
            sortValue: (琯壍) => 琯壍.title,
            cell: (錞壍) => (<span className="flex min-w-0 flex-col">
          <Link href={`/anomalies?focus=${encodeURIComponent(錞壍.id)}`} className="truncate text-fg hover:text-accent">
            {錞壍.title}
          </Link>
          <span className="truncate text-xs text-muted-3">{錞壍.entity.name}</span>
        </span>),
        },
        { key: "severity", header: "Severity", width: "104px", sortValue: (怍壍) => (怍壍.severity === "critical" ? 3 : 怍壍.severity === "warning" ? 2 : 1), cell: (综壍) => <槧壍 severity={综壍.severity}/> },
        {
            key: "status",
            header: "Status",
            width: "minmax(120px,1fr)",
            sortValue: (鷫壍) => 鷫壍.status,
            cell: (櫚壍) => (<span className="flex flex-col items-start gap-1">
          <Pill tone="muted">{STATUS_LABEL[櫚壍.status]}</Pill>
          {櫚壍.status === "snoozed" && 櫚壍.snoozedUntil ? <span className="text-xs text-muted-3">{`until ${formatDateTime(櫚壍.snoozedUntil, 鹰壍)}`}</span> : null}
        </span>),
        },
        {
            key: "first",
            header: "First seen",
            width: "112px",
            sortValue: (觉壍) => 觉壍.firstSeenAt ?? "",
            cell: (嚸壍) => (<span className="font-mono text-meta text-muted" title={formatDateTime(嚸壍.firstSeenAt, 鹰壍)}>
          {嚸壍.firstSeenAt ? relativeTime(嚸壍.firstSeenAt, 羁壍) || formatDateTime(嚸壍.firstSeenAt, 鹰壍) : "—"}
        </span>),
        },
        {
            key: "notes",
            header: "Notes",
            width: "minmax(180px,2fr)",
            sortValue: (疧壍) => 疧壍.notes.length,
            cell: (钖壍) => {
                const 憅壍 = 钖壍.notes[钖壍.notes.length - 1];
                if (!憅壍)
                    return <span className="text-faint">—</span>;
                return (<span className="flex min-w-0 flex-col">
            <span className="line-clamp-2 text-xs text-muted">{憅壍.text}</span>
            <span className="font-mono text-micro text-faint">{`${formatDateTime(憅壍.at, 鹰壍)}${钖壍.notes.length > 1 ? ` · +${钖壍.notes.length - 1} earlier` : ""}`}</span>
          </span>);
            },
        },
        {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            width: "64px",
            align: "right",
            cell: (聴壍) => 掂壍("anomalies.manage") ? (<ActionLink tone="accent" onClick={() => 隓壍.mutate({ id: 聴壍.id, action: { action: "reopen" } }, { onSuccess: () => toast(`Reopened “${聴壍.title}”`), onError: (齣壍) => toast(齣壍.message || "Couldn't reopen the signal", { tone: "crit" }) })}>
            Reopen
          </ActionLink>) : null,
        },
    ];
    const 汒壍 = 锛壍 ? deliverySignals(锛壍, 湏壍, 娭壍) : null;
    const 譁壍 = 锛壍 ? 鎣壍(锛壍) : null;
    return (<div className="flex flex-col gap-6">
      <PageHeader />

      <Card className="flex flex-col gap-4">
        <CardHeader title="Delivery log" sub="Every send, suppression, deferral and retry · newest first" action={胹壍.isFetching && 胹壍.data ? <span className="meta">Refreshing…</span> : null}/>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented ariaLabel="Delivery status" variant="sans" value={濇壍} onChange={(堰壍) => void 詎壍(堰壍 === "all" ? null : 堰壍)} options={[{ value: "all" as DeliveryFilter, label: "All" }, ...縉壍.map((真壍) => ({ value: 真壍 as DeliveryFilter, label: DELIVERY_STATUS_META[真壍].label }))]}/>
          <Select value={圽壍 ?? ""} onChange={(阎壍) => void 瘬壍(阎壍.target.value || null)} aria-label="Channel" className="py-2">
            <option value="">All channels</option>
            {(鿨壍.data ?? []).map((拽壍) => (<option key={拽壍.id} value={拽壍.id}>
                {拽壍.name}
              </option>))}
          </Select>
          <span className="meta ml-auto">{胹壍.data ? `${艱壍.length}${胹壍.hasNextPage ? "+" : ""} shown` : ""}</span>
        </div>
        {胹壍.error && !胹壍.data ? <ErrorState error={胹壍.error} onRetry={() => void 胹壍.refetch()}/> : null}
        {!胹壍.data && !胹壍.error ? <SkeletonLines lines={5}/> : null}
        {胹壍.data ? (<Refetching active={胹壍.isFetching && 胹壍.isPlaceholderData}>
            <DataTable ariaLabel="Alert deliveries" rows={艱壍} columns={蕡壍} rowKey={(臬壍) => 臬壍.id} onRowClick={戊壍} initialSort={{ key: "ts", dir: "desc" }} minWidth={980} maxHeight={560} empty={濇壍 === "all" && !圽壍 ? (<span>
                    No deliveries yet. Add a channel and run alerts on the <Link href="/anomalies/notifications">Notifications</Link> page — every send, suppression and retry lands here.
                  </span>) : ("No deliveries match these filters.")}/>
          </Refetching>) : null}
        {胹壍.hasNextPage ? (<Button variant="ghost" size="xs" onClick={() => void 胹壍.fetchNextPage()} loading={胹壍.isFetchingNextPage} className="self-center">
            Load older deliveries
          </Button>) : null}
      </Card>

      <Card className="flex flex-col gap-4">
        <CardHeader title="Signal lifecycle" sub="Acknowledged, snoozed and resolved signals in the current data window · with notes"/>
        {墵壍.error && !墵壍.data ? <ErrorState error={墵壍.error} onRetry={() => void 墵壍.refetch()}/> : null}
        {!墵壍.data && !墵壍.error ? <SkeletonLines lines={4}/> : null}
        {墵壍.data ? (<DataTable ariaLabel="Signal lifecycle" rows={菩壍} columns={啀壍} rowKey={(仛壍) => 仛壍.id} initialSort={{ key: "first", dir: "desc" }} minWidth={860} empty={<span>
                Nothing acknowledged, snoozed or resolved yet. Actions on the <Link href="/anomalies">Signals</Link> page show up here with their notes.
              </span>}/>) : null}
        <p className="text-xs text-muted-3">Signals are re-detected every day; once a signal stops firing for two evaluations it resolves automatically and leaves this list.</p>
      </Card>

      <Drawer open={!!锛壍} onOpenChange={(淊壍) => !淊壍 && 戊壍(null)} eyebrow={锛壍 ? `${锛壍.kind} · ${DELIVERY_STATUS_META[锛壍.status].label}` : "Delivery"} title={锛壍?.channelName ?? "Delivery"}>
        {锛壍 && 汒壍 ? (<>
            <div role="table" aria-label="Delivery details" className="flex flex-col">
              {[
                ["Time", formatDateTime(锛壍.ts, 鹰壍)],
                ["Channel", `${锛壍.channelName} · ${PLUGIN_META[锛壍.pluginId]?.label ?? 锛壍.pluginId}`],
                ["Route", 锛壍.routeId ? (頋壍.get(锛壍.routeId) ?? 锛壍.routeId) : "—"],
                ["Status", `${DELIVERY_STATUS_META[锛壍.status].label}${锛壍.dryRun ? " (dry run)" : ""}`],
                ["Attempts", String(锛壍.attempts)],
                ...(锛壍.httpStatus ? [["HTTP status", String(锛壍.httpStatus)]] : []),
                ...(锛壍.sentAt ? [["Sent", formatDateTime(锛壍.sentAt, 鹰壍)]] : []),
                ...(锛壍.nextAttemptAt ? [["Next attempt", formatDateTime(锛壍.nextAttemptAt, 鹰壍)]] : []),
            ].map(([貹壍, 妨壍]) => (<div key={貹壍} role="row" className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b border-line-soft py-2 text-[13px]">
                  <span role="rowheader" className="text-muted-3">
                    {貹壍}
                  </span>
                  <span role="cell">{妨壍}</span>
                </div>))}
            </div>
            {锛壍.reason ? <p className="rounded-mini border border-line bg-fill px-3.5 py-3 text-[13px] leading-relaxed text-muted">{锛壍.reason}</p> : null}
            {锛壍.lastError ? (<p role="alert" className="rounded-mini border border-crit/25 bg-crit-t/40 px-3.5 py-3 text-[13px] leading-relaxed text-fg">
                {锛壍.lastError}
              </p>) : null}
            {锛壍.signalIds.length ? (<div className="flex flex-col gap-2">
                <span className="label-mono">{`Signals · ${锛壍.signalIds.length}`}</span>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]">
                  {锛壍.signalIds.slice(0, 12).map((碗壍) => {
                    const 鞆壍 = 湏壍.get(碗壍);
                    return (<li key={碗壍} className="flex items-baseline gap-2">
                        {鞆壍 ? (<Link href={`/anomalies?focus=${encodeURIComponent(碗壍)}`} onClick={() => 戊壍(null)}>
                            {`${鞆壍.title} · ${鞆壍.entity.name}`}
                          </Link>) : (<span className="font-mono text-meta text-muted-3">{碗壍}</span>)}
                      </li>);
                })}
                </ul>
              </div>) : null}
            {锛壍.payloadPreview ? (<div className="flex flex-col gap-2">
                <span className="label-mono">Payload preview · redacted</span>
                <CodeBlock className="max-h-72">{嗅壍(锛壍.payloadPreview)}</CodeBlock>
              </div>) : null}
            {譁壍 && 掂壍("alerts.manage") ? (<div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
                {锛壍.status !== "failed" ? <span className="text-xs text-muted-3">Sends right away — bypasses quiet hours and the no-live-data gate.</span> : null}
                <Button variant="accent" onClick={() => 躶壍(锛壍)} loading={瞤壍.isPending && 瞤壍.variables === 锛壍.id} className="self-start">
                  {譁壍}
                </Button>
              </div>) : null}
          </>) : null}
      </Drawer>
    </div>);
}
