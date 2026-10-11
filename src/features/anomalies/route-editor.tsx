"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Segmented, Switch } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/inputs";
import { Drawer } from "@/components/ui/overlays";
import { toast } from "@/components/ui/toast";
import { useSaveAlertRoute } from "@/lib/api/alerts";
import { useCampaignOptions } from "@/lib/api/anomalies-ui";
import type { AlertChannelView, AlertRoute } from "@/lib/domain/contracts/alerts";
import { MONITORED_METRICS, SIGNAL_KINDS } from "@/lib/domain/contracts/anomaly";
import { CAMPAIGN_TYPES, type Severity } from "@/lib/domain/types";
import { describeQuietHours, KIND_LABEL, PLUGIN_META, routeBodyFromDraft, routeDraftFrom, type RouteDraft } from "./helpers/alerts";
import { metricLabel } from "./helpers/signals";
import { CampaignChecklist, NumberInput, TimeZoneInput, ToggleChips } from "./shared";
const 佉壍: {
    value: Severity;
    label: string;
}[] = [
    { value: "critical", label: "Critical only" },
    { value: "warning", label: "Warning +" },
    { value: "info", label: "Everything" },
];
const 游壍 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
interface RouteEditorProps {
    route?: AlertRoute;
    channels: AlertChannelView[];
    timeZone: string;
    onClose: () => void;
    onDelete?: (货壍: AlertRoute) => void;
}
export function RouteEditor({ route: 娖壍, channels: 礅壍, timeZone: 韴壍, onClose: 擣壍, onDelete: 菒壍 }: RouteEditorProps) {
    const 僁壍 = useCampaignOptions();
    const 澰壍 = useSaveAlertRoute();
    const [躟壍, 宎壍] = useState<RouteDraft>(() => routeDraftFrom(娖壍, { tz: 韴壍, channelIds: 礅壍.filter((穽壍) => 穽壍.enabled).map((饬壍) => 饬壍.id) }));
    const [晛壍, 蕊壍] = useState<string | null>(null);
    const 刹壍 = (焨壍: Partial<RouteDraft>) => {
        宎壍((逗壍) => ({ ...逗壍, ...焨壍 }));
        蕊壍(null);
    };
    const 崆壍 = !!娖壍?.implicit;
    const 篵壍 = 娖壍 && !娖壍.implicit ? 娖壍 : undefined;
    const 髤壍 = 躟壍.quiet ? describeQuietHours({ start: 躟壍.quietStart, end: 躟壍.quietEnd, tz: 躟壍.quietTz || "…", days: 躟壍.quietDays, behavior: 躟壍.quietBehavior, criticalBypass: 躟壍.criticalBypass }) : null;
    const 染壍 = () => {
        const 蛂壍 = routeBodyFromDraft(躟壍, !!篵壍?.digest);
        if (!蛂壍.ok)
            return 蕊壍(蛂壍.error);
        澰壍.mutate({ id: 篵壍?.id, body: 蛂壍.body, version: 篵壍?.version }, {
            onSuccess: (厱壍) => {
                toast(篵壍 ? `Saved “${厱壍.name}”` : 崆壍 ? `Created “${厱壍.name}” — it replaces the default route` : `Added “${厱壍.name}”`);
                擣壍();
            },
            onError: (犠壍) => 蕊壍(犠壍.message || "Couldn't save the route"),
        });
    };
    return (<Drawer open onOpenChange={(醏壍) => !醏壍 && 擣壍()} eyebrow={崆壍 ? "From the default route" : "Alert route"} title={篵壍 ? "Edit route" : "New route"} width={520}>
      <div className="flex flex-col gap-[18px]">
        {崆壍 ? <p className="-mt-2 text-xs leading-relaxed text-muted-3">The default applies only while no routes exist. Saving creates a real route that you can then tailor.</p> : null}

        <Field label="Name">{(幾壍) => <Input id={幾壍} variant="field" value={躟壍.name} maxLength={80} onChange={(絭壍) => 刹壍({ name: 絭壍.target.value })} placeholder="Critical to #ads-ops" autoFocus/>}</Field>

        <div className="flex flex-col gap-2">
          <span className="label-mono">Channels</span>
          {!礅壍.length ? <span className="text-[13px] text-muted-3">Add a channel first — routes need somewhere to send.</span> : null}
          <div role="group" aria-label="Channels" className="flex flex-col overflow-hidden rounded-mini border border-line">
            {礅壍.map((鱜壍) => (<label key={鱜壍.id} className="flex cursor-pointer items-center gap-3 border-b border-line-soft px-3 py-2.5 text-[13px] last:border-b-0 hover:bg-fill">
                <Checkbox checked={躟壍.channelIds.includes(鱜壍.id)} onChange={(楋壍) => 刹壍({ channelIds: 楋壍 ? [...躟壍.channelIds, 鱜壍.id] : 躟壍.channelIds.filter((蠺壍) => 蠺壍 !== 鱜壍.id) })} ariaLabel={鱜壍.name}/>
                <span className="min-w-0 flex-1 truncate">{鱜壍.name}</span>
                <span className="font-mono text-micro tracking-label text-faint uppercase">{`${PLUGIN_META[鱜壍.pluginId].label}${鱜壍.enabled ? "" : " · off"}`}</span>
              </label>))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="label-mono">Minimum severity</span>
          <Segmented ariaLabel="Minimum severity" variant="sans" value={躟壍.minSeverity} onChange={(唩壍) => 刹壍({ minSeverity: 唩壍 })} options={佉壍}/>
        </div>

        <div className="flex flex-col gap-2">
          <span className="label-mono">Signal kinds</span>
          <ToggleChips ariaLabel="Signal kinds" options={SIGNAL_KINDS.map((琘壍) => ({ value: 琘壍, label: KIND_LABEL[琘壍] }))} value={躟壍.kinds} onChange={(錇壍) => 刹壍({ kinds: 錇壍 })}/>
          <span className="text-xs text-muted-3">None selected = every kind.</span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="label-mono">Metrics</span>
          <ToggleChips ariaLabel="Metrics" options={MONITORED_METRICS.map((忶壍) => ({ value: 忶壍 as string, label: metricLabel(忶壍) }))} value={躟壍.metrics} onChange={(绥壍) => 刹壍({ metrics: 绥壍 })}/>
          <span className="text-xs text-muted-3">None selected = every metric. Pacing and overdelivery signals use Spend.</span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="label-mono">Campaigns</span>
          <ToggleChips ariaLabel="Campaign types" options={CAMPAIGN_TYPES.filter((鷔壍) => 鷔壍 !== "Other").map((櫃壍) => ({ value: 櫃壍, label: 櫃壍 }))} value={躟壍.campaignTypes} onChange={(覲壍) => 刹壍({ campaignTypes: 覲壍 })}/>
          <CampaignChecklist campaigns={僁壍.data} value={躟壍.campaignIds} onChange={(嚡壍) => 刹壍({ campaignIds: 嚡壍 })} label="Route campaigns" emptyLabel="All campaigns (of the selected types)"/>
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <Switch checked={躟壍.quiet} onChange={(疐壍) => 刹壍({ quiet: 疐壍 })} label="Quiet hours"/>
          {躟壍.quiet ? (<>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From">{(鑿壍) => <Input id={鑿壍} variant="field" type="time" step={60} value={躟壍.quietStart} onChange={(慮壍) => 刹壍({ quietStart: 慮壍.target.value })}/>}</Field>
                <Field label="Until">{(聝壍) => <Input id={聝壍} variant="field" type="time" step={60} value={躟壍.quietEnd} onChange={(齌壍) => 刹壍({ quietEnd: 齌壍.target.value })}/>}</Field>
              </div>
              <Field label="Time zone">{(氻壍) => <TimeZoneInput id={氻壍} value={躟壍.quietTz} onChange={(謪壍) => 刹壍({ quietTz: 謪壍 })}/>}</Field>
              <div className="flex flex-col gap-2">
                <span className="label-mono">Days</span>
                <ToggleChips ariaLabel="Quiet days" options={游壍.map((堙壍, 眈壍) => ({ value: String(眈壍), label: 堙壍 }))} value={躟壍.quietDays.map(String)} onChange={(闷壍) => 刹壍({ quietDays: 闷壍.map(Number) })}/>
                <span className="text-xs text-muted-3">None selected = every day. A window that crosses midnight belongs to the day it starts.</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="label-mono">During quiet hours</span>
                <Segmented ariaLabel="Quiet hours behavior" variant="sans" value={躟壍.quietBehavior} onChange={(拦壍) => 刹壍({ quietBehavior: 拦壍 })} options={[
                { value: "defer", label: "Defer until they end" },
                { value: "suppress", label: "Suppress" },
            ]}/>
              </div>
              <Switch checked={躟壍.criticalBypass} onChange={(臕壍) => 刹壍({ criticalBypass: 臕壍 })} label="Critical alerts bypass quiet hours"/>
              {髤壍 ? <span className="text-xs text-muted-3">{髤壍}</span> : null}
            </>) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex-1 text-[13px]">Re-notify an unchanged signal after</span>
            <NumberInput value={躟壍.renotifyAfterHours} onChange={(仄壍) => 刹壍({ renotifyAfterHours: 仄壍 })} min={1} max={336} step={1} suffix="hours" ariaLabel="Re-notify after hours"/>
          </div>
          <span className="-mt-1.5 text-xs text-muted-3">A signal that escalates in severity is sent again right away.</span>
          <Switch checked={躟壍.includeResolved} onChange={(涳壍) => 刹壍({ includeResolved: 涳壍 })} label="Send a notice when a signal resolves"/>
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <Switch checked={躟壍.digest} onChange={(貢壍) => 刹壍({ digest: 貢壍 })} label="Daily digest"/>
          {躟壍.digest ? (<div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3">
              <Field label="At">{(妑壍) => <Input id={妑壍} variant="field" type="time" step={60} value={躟壍.digestTime} onChange={(碀壍) => 刹壍({ digestTime: 碀壍.target.value })}/>}</Field>
              <Field label="Time zone">{(靯壍) => <TimeZoneInput id={靯壍} value={躟壍.digestTz} onChange={(摞壍) => 刹壍({ digestTz: 摞壍 })}/>}</Field>
            </div>) : null}
          {躟壍.digest ? <span className="text-xs text-muted-3">Yesterday&apos;s KPIs, the last 7 days and the open signals — sent once a day by the scheduler.</span> : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <Switch checked={躟壍.enabled} onChange={(荍壍) => 刹壍({ enabled: 荍壍 })} label={躟壍.enabled ? "Route enabled" : "Route disabled"}/>
        </div>

        {晛壍 ? (<p role="alert" className="text-[13px] text-crit">
            {晛壍}
          </p>) : null}

        <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-4">
          {篵壍 && 菒壍 ? (<Button variant="danger" size="xs" onClick={() => 菒壍(篵壍)}>
              Delete
            </Button>) : null}
          <span className="flex-1"/>
          <Button variant="ghost" onClick={擣壍}>
            Cancel
          </Button>
          <Button variant="accent" onClick={染壍} loading={澰壍.isPending}>
            {篵壍 ? "Save route" : "Create route"}
          </Button>
        </div>
      </div>
    </Drawer>);
}
