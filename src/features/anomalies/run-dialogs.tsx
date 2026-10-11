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
function 澙壍({ notes: 躈壍 }: {
    notes: string[];
}) {
    if (!躈壍.length)
        return null;
    return (<ul className="m-0 flex list-none flex-col gap-1.5 rounded-mini border border-line bg-fill p-3.5 text-xs leading-relaxed text-muted">
      {躈壍.map((孷壍) => (<li key={孷壍}>{孷壍}</li>))}
    </ul>);
}
function 穦壍({ d: 饕壍 }: {
    d: AlertDelivery;
}) {
    const 晄壍 = DELIVERY_STATUS_META[饕壍.status];
    return (<li className="flex flex-col gap-1 border-b border-line-soft py-2.5 last:border-b-0">
      <div className="flex items-center gap-2.5 text-[13px]">
        <span className="font-mono text-micro text-faint">{PLUGIN_META[饕壍.pluginId].abbr}</span>
        <span className="min-w-0 flex-1 truncate">{饕壍.channelName}</span>
        <span className="font-mono text-meta text-muted-3">{`${饕壍.kind} · ${饕壍.signalIds.length} signal${饕壍.signalIds.length === 1 ? "" : "s"}`}</span>
        <Pill tone={晄壍.tone}>{饕壍.dryRun && 饕壍.status === "pending" ? "Would send" : 晄壍.label}</Pill>
      </div>
      {饕壍.reason ? <span className="pl-7 text-xs text-muted-3">{饕壍.reason}</span> : null}
      {饕壍.lastError ? <span className="pl-7 text-xs text-crit">{饕壍.lastError}</span> : null}
    </li>);
}
function 蔳壍({ s: 刢壍 }: {
    s: AlertRunSummary;
}) {
    const 焑壍 = 刢壍.dryRun
        ? [
            ["Evaluated", 刢壍.evaluated],
            ["Candidates", 刢壍.candidates],
            ["Would send", 刢壍.pending],
            ["Suppressed", 刢壍.suppressed],
            ["Deferred", 刢壍.deferred],
            ["Deduped", 刢壍.deduped],
        ]
        : [
            ["Evaluated", 刢壍.evaluated],
            ["Candidates", 刢壍.candidates],
            ["Sent", 刢壍.sent],
            ["Suppressed", 刢壍.suppressed],
            ["Failed", 刢壍.failed],
            ["Deferred", 刢壍.deferred],
        ];
    return (<div className="flex flex-col gap-3">
      <TileGrid min={110}>
        {焑壍.map(([退壍, 峯壍]) => (<StatTile key={退壍} label={退壍} value={<span className={退壍 === "Failed" && Number(峯壍) > 0 ? "text-crit" : undefined}>{峯壍}</span>}/>))}
      </TileGrid>
      <澙壍 notes={刢壍.notes}/>
      {刢壍.deliveries.length ? (<div className="flex flex-col gap-1">
          <span className="label-mono">{刢壍.dryRun ? "Planned deliveries" : "Deliveries"}</span>
          <ul className="m-0 flex max-h-64 list-none flex-col overflow-y-auto p-0">
            {刢壍.deliveries.map((篞壍) => (<穦壍 key={篞壍.id} d={篞壍}/>))}
          </ul>
        </div>) : (<span className="text-[13px] text-muted-3">{刢壍.dryRun ? "Nothing would be sent right now." : "Nothing was sent."}</span>)}
    </div>);
}
export function RunAlertsDialog({ dry: 髍壍, send: 枼壍, blank: 蚫壍, onClose: 厚壍 }: {
    dry: RunMutation;
    send: RunMutation;
    blank: boolean;
    onClose: () => void;
}) {
    const 犉壍 = 枼壍.data ?? null;
    const 酸壍 = 髍壍.data ?? null;
    const [幧壍, 絖壍] = useState(false);
    const 鱅壍 = 髍壍.isPending || 枼壍.isPending;
    return (<Modal open onOpenChange={(椴壍) => !椴壍 && !鱅壍 && 厚壍()} eyebrow={犉壍 ? (犉壍.forced ? "Sent · forced" : "Sent") : "Dry run"} title="Run alerts now" description={犉壍 ? "The run finished. Every delivery (and every suppression) is in the History log." : "Evaluates signals with the saved rules and plans deliveries per route and channel. Nothing is sent until you confirm."} width={620} footer={犉壍 ? (<>
            <Link href="/anomalies/history" className="mr-auto self-center text-[13px]" onClick={厚壍}>
              Open the delivery log →
            </Link>
            <Button variant="accent" onClick={厚壍}>
              Done
            </Button>
          </>) : (<>
            <Button variant="ghost" onClick={厚壍} disabled={枼壍.isPending}>
              Cancel
            </Button>
            {蚫壍 ? (幧壍 ? (<Button variant="danger" onClick={() => 枼壍.mutate({ force: true })} loading={枼壍.isPending}>
                  Send anyway
                </Button>) : (<Button variant="outline" onClick={() => 絖壍(true)} disabled={!酸壍 || 鱅壍}>
                  Send anyway…
                </Button>)) : null}
            <Button variant="accent" onClick={() => 枼壍.mutate({})} loading={枼壍.isPending && !枼壍.variables?.force} disabled={!酸壍 || 鱅壍}>
              {蚫壍 ? "Run (logs as suppressed)" : "Send now"}
            </Button>
          </>)}>
      {髍壍.isPending ? <SkeletonLines lines={5}/> : null}
      {髍壍.error ? <ErrorState error={髍壍.error} onRetry={() => 髍壍.mutate({ dryRun: true })}/> : null}
      {枼壍.error ? <ErrorState error={枼壍.error}/> : null}
      {幧壍 && !犉壍 ? (<p role="alert" className="rounded-mini border border-line-strong bg-fill px-3.5 py-3 text-[13px] leading-relaxed text-fg">
          The dashboard has no live data. Forcing the run posts these alerts to your real channels.
        </p>) : null}
      {犉壍 ? <蔳壍 s={犉壍}/> : 酸壍 ? <蔳壍 s={酸壍}/> : null}
    </Modal>);
}
type DigestMutation = ReturnType<typeof useDigestPreview>;
export function DigestPreviewDialog({ preview: 蠣壍, routes: 唒壍, onClose: 琁壍 }: {
    preview: DigestMutation;
    routes: AlertRoute[];
    onClose: () => void;
}) {
    const [鋰壍, 忟壍] = useState<AlertChannelPlugin>("slack");
    const [绎壍, 鶽壍] = useState<string>(蠣壍.variables ?? "");
    const 檬壍 = 蠣壍.data;
    const 覛壍 = 檬壍?.message.digest;
    const 嚊壍 = 唒壍.filter((畹壍) => !畹壍.implicit);
    return (<Modal open onOpenChange={(鑨壍) => !鑨壍 && 琁壍()} eyebrow="Digest preview" title="Today's digest" description="Rendered exactly as each channel type would receive it. Nothing is sent." width={760}>
      {嚊壍.length ? (<label className="flex items-center gap-3 text-[13px] text-muted">
          <span className="label-mono">Route</span>
          <Select value={绎壍} onChange={(慗壍) => {
                鶽壍(慗壍.target.value);
                蠣壍.mutate(慗壍.target.value || undefined);
            }} className="min-w-0 flex-1 py-2">
            <option value="">All open signals (no route filter)</option>
            {嚊壍.map((聆壍) => (<option key={聆壍.id} value={聆壍.id}>
                {聆壍.name}
              </option>))}
          </Select>
        </label>) : null}
      {蠣壍.isPending ? <SkeletonLines lines={6}/> : null}
      {蠣壍.error ? <ErrorState error={蠣壍.error} onRetry={() => 蠣壍.mutate(绎壍 || undefined)}/> : null}
      {檬壍 && 覛壍 ? (<div className="flex flex-col gap-4">
          <TileGrid min={140}>
            {覛壍.kpis.slice(0, 8).map((鼵壍) => (<StatTile key={鼵壍.label} label={鼵壍.label} value={<span className="text-xl">{鼵壍.value}</span>}>
                {鼵壍.delta ? <span className="font-mono text-meta text-muted-3">{鼵壍.delta}</span> : null}
              </StatTile>))}
          </TileGrid>
          {覛壍.narrative ? <p className="font-serif text-[16px] leading-[1.45] text-fg italic">{覛壍.narrative}</p> : null}
          <span className="meta">{`${覛壍.openSignals} open signals · ${覛壍.critical} critical · ${檬壍.message.signals.length} in the message · ${檬壍.message.mode} data`}</span>
          <Tabs value={鋰壍} onChange={忟壍} tabs={ALERT_CHANNEL_PLUGINS.map((氤壍) => ({ value: 氤壍, label: PLUGIN_META[氤壍].label }))}/>
          <CodeBlock className="max-h-[360px]">{JSON.stringify(檬壍.payloads[鋰壍], null, 2)}</CodeBlock>
        </div>) : null}
    </Modal>);
}
