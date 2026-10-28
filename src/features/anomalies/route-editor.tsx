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
const SEVERITIES: {
    value: Severity;
    label: string;
}[] = [
    { value: "critical", label: "Critical only" },
    { value: "warning", label: "Warning +" },
    { value: "info", label: "Everything" },
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
interface RouteEditorProps {
    route?: AlertRoute;
    channels: AlertChannelView[];
    timeZone: string;
    onClose: () => void;
    onDelete?: (r: AlertRoute) => void;
}
export function RouteEditor({ route, channels, timeZone, onClose, onDelete }: RouteEditorProps) {
    const campaigns = useCampaignOptions();
    const save = useSaveAlertRoute();
    const [d, setD] = useState<RouteDraft>(() => routeDraftFrom(route, { tz: timeZone, channelIds: channels.filter((c) => c.enabled).map((c) => c.id) }));
    const [error, setError] = useState<string | null>(null);
    const handler = (patch: Partial<RouteDraft>) => {
        setD((p) => ({ ...p, ...patch }));
        setError(null);
    };
    const fromDefault = !!route?.implicit;
    const existing = route && !route.implicit ? route : undefined;
    const quietPreview = d.quiet ? describeQuietHours({ start: d.quietStart, end: d.quietEnd, tz: d.quietTz || "…", days: d.quietDays, behavior: d.quietBehavior, criticalBypass: d.criticalBypass }) : null;
    const submit = () => {
        const built = routeBodyFromDraft(d, !!existing?.digest);
        if (!built.ok)
            return setError(built.error);
        save.mutate({ id: existing?.id, body: built.body, version: existing?.version }, {
            onSuccess: (r) => {
                toast(existing ? `Saved “${r.name}”` : fromDefault ? `Created “${r.name}” — it replaces the default route` : `Added “${r.name}”`);
                onClose();
            },
            onError: (e) => setError(e.message || "Couldn't save the route"),
        });
    };
    return (<Drawer open onOpenChange={(o) => !o && onClose()} eyebrow={fromDefault ? "From the default route" : "Alert route"} title={existing ? "Edit route" : "New route"} width={520}>
      <div className="flex flex-col gap-[18px]">
        {fromDefault ? <p className="-mt-2 text-xs leading-relaxed text-muted-3">The default applies only while no routes exist. Saving creates a real route that you can then tailor.</p> : null}

        <Field label="Name">{(id) => <Input id={id} variant="field" value={d.name} maxLength={80} onChange={(e) => handler({ name: e.target.value })} placeholder="Critical to #ads-ops" autoFocus/>}</Field>

        <div className="flex flex-col gap-2">
          <span className="label-mono">Channels</span>
          {!channels.length ? <span className="text-[13px] text-muted-3">Add a channel first — routes need somewhere to send.</span> : null}
          <div role="group" aria-label="Channels" className="flex flex-col overflow-hidden rounded-mini border border-line">
            {channels.map((c) => (<label key={c.id} className="flex cursor-pointer items-center gap-3 border-b border-line-soft px-3 py-2.5 text-[13px] last:border-b-0 hover:bg-fill">
                <Checkbox checked={d.channelIds.includes(c.id)} onChange={(on) => handler({ channelIds: on ? [...d.channelIds, c.id] : d.channelIds.filter((x) => x !== c.id) })} ariaLabel={c.name}/>
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="font-mono text-micro tracking-label text-faint uppercase">{`${PLUGIN_META[c.pluginId].label}${c.enabled ? "" : " · off"}`}</span>
              </label>))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="label-mono">Minimum severity</span>
          <Segmented ariaLabel="Minimum severity" variant="sans" value={d.minSeverity} onChange={(v) => handler({ minSeverity: v })} options={SEVERITIES}/>
        </div>

        <div className="flex flex-col gap-2">
          <span className="label-mono">Signal kinds</span>
          <ToggleChips ariaLabel="Signal kinds" options={SIGNAL_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} value={d.kinds} onChange={(v) => handler({ kinds: v })}/>
          <span className="text-xs text-muted-3">None selected = every kind.</span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="label-mono">Metrics</span>
          <ToggleChips ariaLabel="Metrics" options={MONITORED_METRICS.map((m) => ({ value: m as string, label: metricLabel(m) }))} value={d.metrics} onChange={(v) => handler({ metrics: v })}/>
          <span className="text-xs text-muted-3">None selected = every metric. Pacing and overdelivery signals use Spend.</span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="label-mono">Campaigns</span>
          <ToggleChips ariaLabel="Campaign types" options={CAMPAIGN_TYPES.filter((t) => t !== "Other").map((t) => ({ value: t, label: t }))} value={d.campaignTypes} onChange={(v) => handler({ campaignTypes: v })}/>
          <CampaignChecklist campaigns={campaigns.data} value={d.campaignIds} onChange={(ids) => handler({ campaignIds: ids })} label="Route campaigns" emptyLabel="All campaigns (of the selected types)"/>
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <Switch checked={d.quiet} onChange={(v) => handler({ quiet: v })} label="Quiet hours"/>
          {d.quiet ? (<>
              <div className="grid grid-cols-2 gap-3">
                <Field label="From">{(id) => <Input id={id} variant="field" type="time" step={60} value={d.quietStart} onChange={(e) => handler({ quietStart: e.target.value })}/>}</Field>
                <Field label="Until">{(id) => <Input id={id} variant="field" type="time" step={60} value={d.quietEnd} onChange={(e) => handler({ quietEnd: e.target.value })}/>}</Field>
              </div>
              <Field label="Time zone">{(id) => <TimeZoneInput id={id} value={d.quietTz} onChange={(tz) => handler({ quietTz: tz })}/>}</Field>
              <div className="flex flex-col gap-2">
                <span className="label-mono">Days</span>
                <ToggleChips ariaLabel="Quiet days" options={DAYS.map((label, i) => ({ value: String(i), label }))} value={d.quietDays.map(String)} onChange={(v) => handler({ quietDays: v.map(Number) })}/>
                <span className="text-xs text-muted-3">None selected = every day. A window that crosses midnight belongs to the day it starts.</span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="label-mono">During quiet hours</span>
                <Segmented ariaLabel="Quiet hours behavior" variant="sans" value={d.quietBehavior} onChange={(v) => handler({ quietBehavior: v })} options={[
                { value: "defer", label: "Defer until they end" },
                { value: "suppress", label: "Suppress" },
            ]}/>
              </div>
              <Switch checked={d.criticalBypass} onChange={(v) => handler({ criticalBypass: v })} label="Critical alerts bypass quiet hours"/>
              {quietPreview ? <span className="text-xs text-muted-3">{quietPreview}</span> : null}
            </>) : null}
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex-1 text-[13px]">Re-notify an unchanged signal after</span>
            <NumberInput value={d.renotifyAfterHours} onChange={(v) => handler({ renotifyAfterHours: v })} min={1} max={336} step={1} suffix="hours" ariaLabel="Re-notify after hours"/>
          </div>
          <span className="-mt-1.5 text-xs text-muted-3">A signal that escalates in severity is sent again right away.</span>
          <Switch checked={d.includeResolved} onChange={(v) => handler({ includeResolved: v })} label="Send a notice when a signal resolves"/>
        </div>

        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <Switch checked={d.digest} onChange={(v) => handler({ digest: v })} label="Daily digest"/>
          {d.digest ? (<div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3">
              <Field label="At">{(id) => <Input id={id} variant="field" type="time" step={60} value={d.digestTime} onChange={(e) => handler({ digestTime: e.target.value })}/>}</Field>
              <Field label="Time zone">{(id) => <TimeZoneInput id={id} value={d.digestTz} onChange={(tz) => handler({ digestTz: tz })}/>}</Field>
            </div>) : null}
          {d.digest ? <span className="text-xs text-muted-3">Yesterday&apos;s KPIs, the last 7 days and the open signals — sent once a day by the scheduler.</span> : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
          <Switch checked={d.enabled} onChange={(v) => handler({ enabled: v })} label={d.enabled ? "Route enabled" : "Route disabled"}/>
        </div>

        {error ? (<p role="alert" className="text-[13px] text-crit">
            {error}
          </p>) : null}

        <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-4">
          {existing && onDelete ? (<Button variant="danger" size="xs" onClick={() => onDelete(existing)}>
              Delete
            </Button>) : null}
          <span className="flex-1"/>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} loading={save.isPending}>
            {existing ? "Save route" : "Create route"}
          </Button>
        </div>
      </div>
    </Drawer>);
}
