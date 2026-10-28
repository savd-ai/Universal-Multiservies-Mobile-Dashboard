"use client";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Switch } from "@/components/ui/controls";
import { DashedCard, Card, CardHeader } from "@/components/ui/surfaces";
import { ErrorState, Skeleton, SkeletonLines } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/overlays";
import { Dot, Pill } from "@/components/ui/status";
import { toast } from "@/components/ui/toast";
import { useAlertChannels, useAlertRoutes, useDeleteAlertChannel, useDeleteAlertRoute, useDigestPreview, useRunAlerts, useSaveAlertChannel, useTestAlertChannel, useSaveAlertRoute } from "@/lib/api/alerts";
import { useCampaignOptions } from "@/lib/api/anomalies-ui";
import { useStatus } from "@/lib/api/hooks";
import type { AlertChannelView, AlertRoute } from "@/lib/domain/contracts/alerts";
import { ChannelDialog } from "./channel-dialog";
import { PLUGIN_META, routeSummary } from "./helpers/alerts";
import { formatDateTime, relativeTime } from "./helpers/time";
import { RouteEditor } from "./route-editor";
import { DigestPreviewDialog, RunAlertsDialog } from "./run-dialogs";
import { ActionLink, useNotificationPermission, useNow, useValueFormat } from "./shared";
function StatusStrip({ onEnableBrowser }: {
    onEnableBrowser: () => void;
}) {
    const status = useStatus();
    const now = useNow();
    const { timeZone } = useValueFormat();
    const [perm] = useNotificationPermission();
    const d = status.data;
    const sched = d?.scheduler;
    return (<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="flex flex-col gap-2.5 p-5">
        <span className="label-mono">Delivery mode</span>
        {d ? (<>
            <span className="flex items-center gap-2 font-display text-lg font-semibold">
              <Dot tone={d.mode === "live" ? "accent" : "muted"}/>
              {d.mode === "live" ? "Live data" : "No live data"}
            </span>
            <span className="text-xs leading-relaxed text-muted-3">
              {d.mode === "live" ? "Matching signals are sent as soon as a run finds them." : "Scheduled and manual runs log deliveries as suppressed. Tests always go out; use “Send anyway” to send alerts without live data."}
            </span>
          </>) : (<SkeletonLines lines={2}/>)}
      </Card>
      <Card className="flex flex-col gap-2.5 p-5">
        <span className="label-mono">Scheduler</span>
        {sched ? (<>
            <span className="flex items-center gap-2 font-display text-lg font-semibold">
              <Dot tone={sched.enabled ? "accent" : "faint"}/>
              {sched.enabled ? `On · every ${sched.intervalMinutes} min` : "Off"}
            </span>
            <span className="text-xs text-muted-3" title={sched.lastRunAt ? formatDateTime(sched.lastRunAt, timeZone) : undefined}>
              {sched.lastRunAt ? `Last run ${relativeTime(sched.lastRunAt, now) || formatDateTime(sched.lastRunAt, timeZone)}` : "No scheduled run yet"}
            </span>
            <span className="text-xs leading-relaxed text-muted-3">
              {sched.enabled ? "Runs inside this Node server." : "Set ALERTS_SCHEDULER_ENABLED=true for a long-running server, or call /api/cron/alerts from an external cron with Authorization: Bearer $CRON_SECRET."}
            </span>
          </>) : (<SkeletonLines lines={2}/>)}
      </Card>
      <Card className="flex flex-col gap-2.5 p-5">
        <span className="label-mono">Browser notifications</span>
        <span className="flex items-center gap-2 font-display text-lg font-semibold">
          <Dot tone={perm === "granted" ? "accent" : "faint"}/>
          {perm === null ? "…" : perm === "granted" ? "On" : perm === "denied" ? "Blocked" : perm === "unsupported" ? "Not supported" : "Off"}
        </span>
        <span className="text-xs leading-relaxed text-muted-3">
          {perm === "denied" ? "Allow notifications for this site in the browser settings." : "While the dashboard is open, new critical signals pop up as a desktop notification (from the Alerts bell)."}
        </span>
        {perm === "default" ? (<Button variant="outline" size="xs" onClick={onEnableBrowser} className="self-start">
            Enable
          </Button>) : null}
      </Card>
    </div>);
}
function ChannelCard({ ch, onEdit, onDelete }: {
    ch: AlertChannelView;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const test = useTestAlertChannel();
    const save = useSaveAlertChannel();
    const now = useNow();
    const { timeZone } = useValueFormat();
    const meta = PLUGIN_META[ch.pluginId];
    const env = ch.origin === "env";
    const last = ch.lastTest;
    const runTest = () => test.mutate(ch.id, {
        onSuccess: (r) => toast(r.ok ? `Test sent to “${ch.name}”${r.status ? ` · HTTP ${r.status}` : ""}` : `Test failed: ${r.error ?? `HTTP ${r.status ?? "?"}`}`, { tone: r.ok ? "default" : "crit", ms: r.ok ? 2400 : 5000 }),
        onError: (e) => toast(e.message || "Couldn't send the test", { tone: "crit" }),
    });
    return (<div className={cn("flex flex-col gap-3.5 rounded-card border bg-card p-5", ch.enabled ? "border-line" : "border-line opacity-70")}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-mini border border-tone/12 bg-fill font-mono text-eyebrow text-fg" aria-hidden>
          {meta.abbr}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="truncate font-display text-base font-semibold">{ch.name}</span>
          <span className="font-mono text-micro tracking-label text-faint uppercase">{meta.label}</span>
        </div>
        {env ? (<Pill tone="muted">Env</Pill>) : (<Switch checked={ch.enabled} onChange={(v) => save.mutate({ id: ch.id, body: { enabled: v, version: ch.version } }, { onError: (e) => toast(e.message || "Couldn't update the channel", { tone: "crit" }) })} ariaLabel={`${ch.enabled ? "Disable" : "Enable"} ${ch.name}`} disabled={save.isPending}/>)}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-pill border border-line px-2.5 py-1 font-mono text-meta text-muted" title="The webhook URL is stored encrypted; only its last characters are shown.">
          {ch.url.masked ?? "No URL"}
        </span>
        {env ? <span className="rounded-pill border border-dashed border-tone/20 px-2.5 py-1 font-mono text-micro tracking-label text-muted-3 uppercase">{`.env · ${meta.envKey}`}</span> : null}
        {ch.signing ? <Pill tone="accent">Signed</Pill> : null}
        {ch.options.mention ? <Pill tone="muted">{ch.options.mention}</Pill> : null}
        {!ch.options.includeLinks ? <Pill tone="faint">No links</Pill> : null}
      </div>

      <div className="text-xs text-muted-3" aria-live="polite">
        {test.isPending ? ("Sending a test…") : last ? (<span title={formatDateTime(last.at, timeZone)}>
            <span className={last.ok ? "text-accent" : "text-crit"}>{last.ok ? "✓ Test delivered" : "× Test failed"}</span>
            {` · ${relativeTime(last.at, now) || formatDateTime(last.at, timeZone)}${last.status ? ` · HTTP ${last.status}` : ""}`}
            {!last.ok && last.error ? <span className="mt-1 block text-crit">{last.error}</span> : null}
          </span>) : ("Never tested")}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-3.5 gap-y-2 border-t border-line-soft pt-3">
        <Button variant="outline" size="xs" onClick={runTest} loading={test.isPending} disabled={!ch.url.hasValue}>
          Test send
        </Button>
        {env ? (<span className="text-xs text-muted-3">Defined in .env — read-only</span>) : (<>
            <ActionLink onClick={onEdit}>Edit</ActionLink>
            <ActionLink tone="crit" onClick={onDelete}>
              Delete
            </ActionLink>
          </>)}
      </div>
    </div>);
}
function RouteRow({ route, channels, campaignNames, onEdit, onToggle }: {
    route: AlertRoute;
    channels: AlertChannelView[];
    campaignNames: Map<string, string>;
    onEdit: () => void;
    onToggle: (v: boolean) => void;
}) {
    const s = routeSummary(route, { channels, campaignNames });
    return (<div className={cn("flex flex-wrap items-start gap-x-5 gap-y-3 border-b border-line-soft py-4 last:border-b-0", !route.enabled && "opacity-60")}>
      <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={onEdit} className="text-left font-display text-base font-semibold hover:text-accent">
            {route.name}
          </button>
          {route.implicit ? <Pill tone="muted">Implicit default</Pill> : null}
          <Pill tone="accent">{s.severity}</Pill>
        </div>
        <span className="text-[13px] text-muted">{`→ ${s.channels}`}</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-3">
          <span>{s.filters.length ? s.filters.join(" · ") : "Every signal kind, metric and campaign"}</span>
          {s.quiet ? <span>{`Quiet ${s.quiet}`}</span> : null}
          <span>{s.renotify}</span>
          {s.includeResolved ? <span>Resolved notices</span> : null}
          {s.digest ? <span>{s.digest}</span> : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {route.implicit ? (<Button variant="outline" size="xs" onClick={onEdit}>
            Customize
          </Button>) : (<>
            <Switch checked={route.enabled} onChange={onToggle} ariaLabel={`${route.enabled ? "Disable" : "Enable"} ${route.name}`}/>
            <ActionLink onClick={onEdit}>Edit</ActionLink>
          </>)}
      </div>
    </div>);
}
export function NotificationsScreen() {
    const status = useStatus();
    const channels = useAlertChannels();
    const routes = useAlertRoutes();
    const campaigns = useCampaignOptions();
    const deleteChannel = useDeleteAlertChannel();
    const deleteRoute = useDeleteAlertRoute();
    const saveRoute = useSaveAlertRoute();
    const dry = useRunAlerts();
    const send = useRunAlerts();
    const digest = useDigestPreview();
    const [, requestPermission] = useNotificationPermission();
    const { timeZone } = useValueFormat();
    const [channelDialog, setChannelDialog] = useState<{
        channel?: AlertChannelView;
    } | null>(null);
    const [routeEditor, setRouteEditor] = useState<{
        route?: AlertRoute;
    } | null>(null);
    const [confirmChannel, setConfirmChannel] = useState<AlertChannelView | null>(null);
    const [confirmRoute, setConfirmRoute] = useState<AlertRoute | null>(null);
    const [runOpen, setRunOpen] = useState(false);
    const [digestOpen, setDigestOpen] = useState(false);
    const channelList = useMemo(() => channels.data ?? [], [channels.data]);
    const routeList = routes.data ?? [];
    const campaignNames = useMemo(() => new Map((campaigns.data ?? []).map((c) => [c.id, c.name])), [campaigns.data]);
    const encryption = !!status.data?.security.encryption;
    const demo = status.data?.mode !== "live";
    const openRun = () => {
        send.reset();
        dry.mutate({ dryRun: true });
        setRunOpen(true);
    };
    const openDigest = () => {
        digest.mutate(undefined);
        setDigestOpen(true);
    };
    return (<div className="flex flex-col gap-6">
      <PageHeader actions={<>
            <Button variant="outline" size="xs" onClick={openDigest}>
              Digest preview
            </Button>
            <Button variant="accent" size="xs" onClick={openRun}>
              Run alerts now
            </Button>
          </>}/>

      <StatusStrip onEnableBrowser={() => void requestPermission()}/>

      <section className="flex flex-col gap-4" aria-labelledby="channels-title">
        <CardHeader title={<span id="channels-title">Alert channels</span>} sub="Where alerts, resolved notices and digests are posted" action={<Button variant="outline" size="xs" onClick={() => setChannelDialog({})}>
              + Add channel
            </Button>}/>
        {channels.error ? <ErrorState error={channels.error} onRetry={() => void channels.refetch()}/> : null}
        {!channels.data && !channels.error ? (<div className="grid grid-cols-1 gap-4 md:grid-cols-2 wide:grid-cols-3">
            {[0, 1, 2].map((i) => (<Skeleton key={i} height={210} className="rounded-card"/>))}
          </div>) : null}
        {channels.data ? (<div className="grid grid-cols-1 gap-4 md:grid-cols-2 wide:grid-cols-3">
            {channelList.map((ch) => (<ChannelCard key={ch.id} ch={ch} onEdit={() => setChannelDialog({ channel: ch })} onDelete={() => setConfirmChannel(ch)}/>))}
            <DashedCard interactive role="button" tabIndex={0} onClick={() => setChannelDialog({})} onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ")
                    return;
                e.preventDefault();
                setChannelDialog({});
            }} className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-card p-6 text-[13px]">
              <span className="font-display text-base font-semibold text-fg">+ Add a channel</span>
              <span className="max-w-[40ch] leading-relaxed">Slack, Microsoft Teams (Workflows), Discord or a signed webhook.</span>
              <span className="max-w-[44ch] font-mono text-micro leading-relaxed tracking-label uppercase">Or in .env: SLACK_WEBHOOK_URL · TEAMS_WEBHOOK_URL · DISCORD_WEBHOOK_URL · ALERT_WEBHOOK_URL</span>
            </DashedCard>
          </div>) : null}
        {!encryption && status.data ? (<p className="text-xs leading-relaxed text-muted-3">
            <span className="font-mono">APP_ENCRYPTION_KEY</span> isn&apos;t set, so webhook URLs can only come from .env for now (<span className="font-mono">npm run gen:key</span> creates a key).
          </p>) : null}
      </section>

      <Card className="flex flex-col gap-2">
        <CardHeader title="Routes" sub="Which signals go to which channels — first match per channel wins, duplicates are sent once" action={<Button variant="outline" size="xs" onClick={() => setRouteEditor({})} disabled={!channelList.length}>
              + New route
            </Button>}/>
        {routes.error ? <ErrorState error={routes.error} onRetry={() => void routes.refetch()}/> : null}
        {!routes.data && !routes.error ? <SkeletonLines lines={3}/> : null}
        <div className="flex flex-col">
          {routeList.map((r) => (<RouteRow key={r.id} route={r} channels={channelList} campaignNames={campaignNames} onEdit={() => setRouteEditor({ route: r })} onToggle={(v) => {
                const { id, version, createdAt: _c, updatedAt: _u, implicit: _i, ...body } = r;
                saveRoute.mutate({ id, version, body: { ...body, enabled: v } }, { onError: (e) => toast(e.message || "Couldn't update the route", { tone: "crit" }) });
            }}/>))}
        </div>
        {routes.data && routeList.every((r) => r.implicit) ? <p className="text-xs text-muted-3">No routes yet: the implicit default sends warning and critical signals to every enabled channel. Create a route to take control.</p> : null}
      </Card>

      {channelDialog ? <ChannelDialog key={channelDialog.channel?.id ?? "new"} channel={channelDialog.channel} encryption={encryption} onClose={() => setChannelDialog(null)}/> : null}
      {routeEditor ? <RouteEditor key={routeEditor.route?.id ?? "new"} route={routeEditor.route} channels={channelList} timeZone={timeZone} onClose={() => setRouteEditor(null)} onDelete={(r) => setConfirmRoute(r)}/> : null}
      {runOpen ? <RunAlertsDialog dry={dry} send={send} blank={demo} onClose={() => setRunOpen(false)}/> : null}
      {digestOpen ? <DigestPreviewDialog preview={digest} routes={routeList} onClose={() => setDigestOpen(false)}/> : null}

      <ConfirmDialog open={!!confirmChannel} onOpenChange={(o) => !o && setConfirmChannel(null)} title="Delete this channel?" description={confirmChannel ? `“${confirmChannel.name}” stops receiving alerts. Routes that only used it are disabled.` : undefined} confirmLabel="Delete channel" danger onConfirm={() => {
            const ch = confirmChannel;
            if (!ch)
                return;
            deleteChannel.mutate(ch.id, {
                onSuccess: (r) => toast(`Deleted “${ch.name}”${r.updatedRoutes.length ? ` · ${r.updatedRoutes.length} route${r.updatedRoutes.length === 1 ? "" : "s"} updated` : ""}`),
                onError: (e) => toast(e.message || "Couldn't delete the channel", { tone: "crit" }),
            });
        }}/>
      <ConfirmDialog open={!!confirmRoute} onOpenChange={(o) => !o && setConfirmRoute(null)} title="Delete this route?" description={confirmRoute ? `“${confirmRoute.name}” stops routing signals.${routeList.filter((r) => !r.implicit).length === 1 ? " With no routes left, the implicit default applies again." : ""}` : undefined} confirmLabel="Delete route" danger onConfirm={() => {
            const r = confirmRoute;
            if (!r)
                return;
            deleteRoute.mutate(r.id, {
                onSuccess: () => {
                    toast(`Deleted “${r.name}”`);
                    setRouteEditor(null);
                },
                onError: (e) => toast(e.message || "Couldn't delete the route", { tone: "crit" }),
            });
        }}/>
    </div>);
}
