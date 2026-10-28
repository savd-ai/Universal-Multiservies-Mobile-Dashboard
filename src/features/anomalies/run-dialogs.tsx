"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState, SkeletonLines } from "@/components/ui/feedback";
import { Select } from "@/components/ui/inputs";
import { Modal } from "@/components/ui/overlays";
import { Pill } from "@/components/ui/status";
import { CodeBlock, StatTile, TileGrid } from "@/components/ui/surfaces";
import { Tabs } from "@/components/ui/tabs";
import type { useDigestPreview, useRunAlerts } from "@/lib/api/alerts";
import { ALERT_CHANNEL_PLUGINS, type AlertChannelPlugin, type AlertDelivery, type AlertRoute, type AlertRunSummary } from "@/lib/domain/contracts/alerts";
import { DELIVERY_STATUS_META, PLUGIN_META } from "./helpers/alerts";
type RunMutation = ReturnType<typeof useRunAlerts>;
function Notes({ notes }: {
    notes: string[];
}) {
    if (!notes.length)
        return null;
    return (<ul className="m-0 flex list-none flex-col gap-1.5 rounded-mini border border-line bg-fill p-3.5 text-xs leading-relaxed text-muted">
      {notes.map((n) => (<li key={n}>{n}</li>))}
    </ul>);
}
function DeliveryRow({ d }: {
    d: AlertDelivery;
}) {
    const m = DELIVERY_STATUS_META[d.status];
    return (<li className="flex flex-col gap-1 border-b border-line-soft py-2.5 last:border-b-0">
      <div className="flex items-center gap-2.5 text-[13px]">
        <span className="font-mono text-micro text-faint">{PLUGIN_META[d.pluginId].abbr}</span>
        <span className="min-w-0 flex-1 truncate">{d.channelName}</span>
        <span className="font-mono text-meta text-muted-3">{`${d.kind} · ${d.signalIds.length} signal${d.signalIds.length === 1 ? "" : "s"}`}</span>
        <Pill tone={m.tone}>{d.dryRun && d.status === "pending" ? "Would send" : m.label}</Pill>
      </div>
      {d.reason ? <span className="pl-7 text-xs text-muted-3">{d.reason}</span> : null}
      {d.lastError ? <span className="pl-7 text-xs text-crit">{d.lastError}</span> : null}
    </li>);
}
function Summary({ s }: {
    s: AlertRunSummary;
}) {
    const tiles = s.dryRun
        ? [
            ["Evaluated", s.evaluated],
            ["Candidates", s.candidates],
            ["Would send", s.pending],
            ["Suppressed", s.suppressed],
            ["Deferred", s.deferred],
            ["Deduped", s.deduped],
        ]
        : [
            ["Evaluated", s.evaluated],
            ["Candidates", s.candidates],
            ["Sent", s.sent],
            ["Suppressed", s.suppressed],
            ["Failed", s.failed],
            ["Deferred", s.deferred],
        ];
    return (<div className="flex flex-col gap-3">
      <TileGrid min={110}>
        {tiles.map(([label, value]) => (<StatTile key={label} label={label} value={<span className={label === "Failed" && Number(value) > 0 ? "text-crit" : undefined}>{value}</span>}/>))}
      </TileGrid>
      <Notes notes={s.notes}/>
      {s.deliveries.length ? (<div className="flex flex-col gap-1">
          <span className="label-mono">{s.dryRun ? "Planned deliveries" : "Deliveries"}</span>
          <ul className="m-0 flex max-h-64 list-none flex-col overflow-y-auto p-0">
            {s.deliveries.map((d) => (<DeliveryRow key={d.id} d={d}/>))}
          </ul>
        </div>) : (<span className="text-[13px] text-muted-3">{s.dryRun ? "Nothing would be sent right now." : "Nothing was sent."}</span>)}
    </div>);
}
export function RunAlertsDialog({ dry, send, blank: demo, onClose }: {
    dry: RunMutation;
    send: RunMutation;
    blank: boolean;
    onClose: () => void;
}) {
    const result = send.data ?? null;
    const plan = dry.data ?? null;
    const [confirmForce, setConfirmForce] = useState(false);
    const busy = dry.isPending || send.isPending;
    return (<Modal open onOpenChange={(o) => !o && !busy && onClose()} eyebrow={result ? (result.forced ? "Sent · forced" : "Sent") : "Dry run"} title="Run alerts now" description={result ? "The run finished. Every delivery (and every suppression) is in the History log." : "Evaluates signals with the saved rules and plans deliveries per route and channel. Nothing is sent until you confirm."} width={620} footer={result ? (<>
            <Link href="/anomalies/history" className="mr-auto self-center text-[13px]" onClick={onClose}>
              Open the delivery log →
            </Link>
            <Button variant="accent" onClick={onClose}>
              Done
            </Button>
          </>) : (<>
            <Button variant="ghost" onClick={onClose} disabled={send.isPending}>
              Cancel
            </Button>
            {demo ? (confirmForce ? (<Button variant="danger" onClick={() => send.mutate({ force: true })} loading={send.isPending}>
                  Send anyway
                </Button>) : (<Button variant="outline" onClick={() => setConfirmForce(true)} disabled={!plan || busy}>
                  Send anyway…
                </Button>)) : null}
            <Button variant="accent" onClick={() => send.mutate({})} loading={send.isPending && !send.variables?.force} disabled={!plan || busy}>
              {demo ? "Run (logs as suppressed)" : "Send now"}
            </Button>
          </>)}>
      {dry.isPending ? <SkeletonLines lines={5}/> : null}
      {dry.error ? <ErrorState error={dry.error} onRetry={() => dry.mutate({ dryRun: true })}/> : null}
      {send.error ? <ErrorState error={send.error}/> : null}
      {confirmForce && !result ? (<p role="alert" className="rounded-mini border border-line-strong bg-fill px-3.5 py-3 text-[13px] leading-relaxed text-fg">
          The dashboard has no live data. Forcing the run posts these alerts to your real channels.
        </p>) : null}
      {result ? <Summary s={result}/> : plan ? <Summary s={plan}/> : null}
    </Modal>);
}
type DigestMutation = ReturnType<typeof useDigestPreview>;
export function DigestPreviewDialog({ preview, routes, onClose }: {
    preview: DigestMutation;
    routes: AlertRoute[];
    onClose: () => void;
}) {
    const [tab, setTab] = useState<AlertChannelPlugin>("slack");
    const [routeId, setRouteId] = useState<string>(preview.variables ?? "");
    const data = preview.data;
    const digest = data?.message.digest;
    const choices = routes.filter((r) => !r.implicit);
    return (<Modal open onOpenChange={(o) => !o && onClose()} eyebrow="Digest preview" title="Today's digest" description="Rendered exactly as each channel type would receive it. Nothing is sent." width={760}>
      {choices.length ? (<label className="flex items-center gap-3 text-[13px] text-muted">
          <span className="label-mono">Route</span>
          <Select value={routeId} onChange={(e) => {
                setRouteId(e.target.value);
                preview.mutate(e.target.value || undefined);
            }} className="min-w-0 flex-1 py-2">
            <option value="">All open signals (no route filter)</option>
            {choices.map((r) => (<option key={r.id} value={r.id}>
                {r.name}
              </option>))}
          </Select>
        </label>) : null}
      {preview.isPending ? <SkeletonLines lines={6}/> : null}
      {preview.error ? <ErrorState error={preview.error} onRetry={() => preview.mutate(routeId || undefined)}/> : null}
      {data && digest ? (<div className="flex flex-col gap-4">
          <TileGrid min={140}>
            {digest.kpis.slice(0, 8).map((k) => (<StatTile key={k.label} label={k.label} value={<span className="text-xl">{k.value}</span>}>
                {k.delta ? <span className="font-mono text-meta text-muted-3">{k.delta}</span> : null}
              </StatTile>))}
          </TileGrid>
          {digest.narrative ? <p className="font-serif text-[16px] leading-[1.45] text-fg italic">{digest.narrative}</p> : null}
          <span className="meta">{`${digest.openSignals} open signals · ${digest.critical} critical · ${data.message.signals.length} in the message · ${data.message.mode} data`}</span>
          <Tabs value={tab} onChange={setTab} tabs={ALERT_CHANNEL_PLUGINS.map((p) => ({ value: p, label: PLUGIN_META[p].label }))}/>
          <CodeBlock className="max-h-[360px]">{JSON.stringify(data.payloads[tab], null, 2)}</CodeBlock>
        </div>) : null}
    </Modal>);
}
