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
function Cmp10({ onEnableBrowser: 荤壍 }: {
    onEnableBrowser: () => void;
}) {
    const 偓壍 = useStatus();
    const 潂壍 = useNow();
    const { timeZone: 踱壍 } = useValueFormat();
    const [嬠壍] = useNotificationPermission();
    const 稏壍 = 偓壍.data;
    const 飾壍 = 稏壍?.scheduler;
    return (<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card className="flex flex-col gap-2.5 p-5">
        <span className="label-mono">Delivery mode</span>
        {稏壍 ? (<>
            <span className="flex items-center gap-2 font-display text-lg font-semibold">
              <Dot tone={稏壍.mode === "live" ? "accent" : "muted"}/>
              {稏壍.mode === "live" ? "Live data" : "No live data"}
            </span>
            <span className="text-xs leading-relaxed text-muted-3">
              {稏壍.mode === "live" ? "Matching signals are sent as soon as a run finds them." : "Scheduled and manual runs log deliveries as suppressed. Tests always go out; use “Send anyway” to send alerts without live data."}
            </span>
          </>) : (<SkeletonLines lines={2}/>)}
      </Card>
      <Card className="flex flex-col gap-2.5 p-5">
        <span className="label-mono">Scheduler</span>
        {飾壍 ? (<>
            <span className="flex items-center gap-2 font-display text-lg font-semibold">
              <Dot tone={飾壍.enabled ? "accent" : "faint"}/>
              {飾壍.enabled ? `On · every ${飾壍.intervalMinutes} min` : "Off"}
            </span>
            <span className="text-xs text-muted-3" title={飾壍.lastRunAt ? formatDateTime(飾壍.lastRunAt, 踱壍) : undefined}>
              {飾壍.lastRunAt ? `Last run ${relativeTime(飾壍.lastRunAt, 潂壍) || formatDateTime(飾壍.lastRunAt, 踱壍)}` : "No scheduled run yet"}
            </span>
            <span className="text-xs leading-relaxed text-muted-3">
              {飾壍.enabled ? "Runs inside this Node server." : "Set ALERTS_SCHEDULER_ENABLED=true for a long-running server, or call /api/cron/alerts from an external cron with Authorization: Bearer $CRON_SECRET."}
            </span>
          </>) : (<SkeletonLines lines={2}/>)}
      </Card>
      <Card className="flex flex-col gap-2.5 p-5">
        <span className="label-mono">Browser notifications</span>
        <span className="flex items-center gap-2 font-display text-lg font-semibold">
          <Dot tone={嬠壍 === "granted" ? "accent" : "faint"}/>
          {嬠壍 === null ? "…" : 嬠壍 === "granted" ? "On" : 嬠壍 === "denied" ? "Blocked" : 嬠壍 === "unsupported" ? "Not supported" : "Off"}
        </span>
        <span className="text-xs leading-relaxed text-muted-3">
          {嬠壍 === "denied" ? "Allow notifications for this site in the browser settings." : "While the dashboard is open, new critical signals pop up as a desktop notification (from the Alerts bell)."}
        </span>
        {嬠壍 === "default" ? (<Button variant="outline" size="xs" onClick={荤壍} className="self-start">
            Enable
          </Button>) : null}
      </Card>
    </div>);
}
function Cmp11({ ch: 蓜壍, onEdit: 凋壍, onDelete: 為壍 }: {
    ch: AlertChannelView;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const 辩壍 = useTestAlertChannel();
    const 岘壍 = useSaveAlertChannel();
    const 箇壍 = useNow();
    const { timeZone: 驶壍 } = useValueFormat();
    const 来壍 = PLUGIN_META[蓜壍.pluginId];
    const 虔壍 = 蓜壍.origin === "env";
    const 千壍 = 蓜壍.lastTest;
    const 爲壍 = () => 辩壍.mutate(蓜壍.id, {
        onSuccess: (鄡壍) => toast(鄡壍.ok ? `Test sent to “${蓜壍.name}”${鄡壍.status ? ` · HTTP ${鄡壍.status}` : ""}` : `Test failed: ${鄡壍.error ?? `HTTP ${鄡壍.status ?? "?"}`}`, { tone: 鄡壍.ok ? "default" : "crit", ms: 鄡壍.ok ? 2400 : 5000 }),
        onError: (帐壍) => toast(帐壍.message || "Couldn't send the test", { tone: "crit" }),
    });
    return (<div className={cn("flex flex-col gap-3.5 rounded-card border bg-card p-5", 蓜壍.enabled ? "border-line" : "border-line opacity-70")}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-mini border border-tone/12 bg-fill font-mono text-eyebrow text-fg" aria-hidden>
          {来壍.abbr}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="truncate font-display text-base font-semibold">{蓜壍.name}</span>
          <span className="font-mono text-micro tracking-label text-faint uppercase">{来壍.label}</span>
        </div>
        {虔壍 ? (<Pill tone="muted">Env</Pill>) : (<Switch checked={蓜壍.enabled} onChange={(糿壍) => 岘壍.mutate({ id: 蓜壍.id, body: { enabled: 糿壍, version: 蓜壍.version } }, { onError: (鯮壍) => toast(鯮壍.message || "Couldn't update the channel", { tone: "crit" }) })} ariaLabel={`${蓜壍.enabled ? "Disable" : "Enable"} ${蓜壍.name}`} disabled={岘壍.isPending}/>)}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-pill border border-line px-2.5 py-1 font-mono text-meta text-muted" title="The webhook URL is stored encrypted; only its last characters are shown.">
          {蓜壍.url.masked ?? "No URL"}
        </span>
        {虔壍 ? <span className="rounded-pill border border-dashed border-tone/20 px-2.5 py-1 font-mono text-micro tracking-label text-muted-3 uppercase">{`.env · ${来壍.envKey}`}</span> : null}
        {蓜壍.signing ? <Pill tone="accent">Signed</Pill> : null}
        {蓜壍.options.mention ? <Pill tone="muted">{蓜壍.options.mention}</Pill> : null}
        {!蓜壍.options.includeLinks ? <Pill tone="faint">No links</Pill> : null}
      </div>

      <div className="text-xs text-muted-3" aria-live="polite">
        {辩壍.isPending ? ("Sending a test…") : 千壍 ? (<span title={formatDateTime(千壍.at, 驶壍)}>
            <span className={千壍.ok ? "text-accent" : "text-crit"}>{千壍.ok ? "✓ Test delivered" : "× Test failed"}</span>
            {` · ${relativeTime(千壍.at, 箇壍) || formatDateTime(千壍.at, 驶壍)}${千壍.status ? ` · HTTP ${千壍.status}` : ""}`}
            {!千壍.ok && 千壍.error ? <span className="mt-1 block text-crit">{千壍.error}</span> : null}
          </span>) : ("Never tested")}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-3.5 gap-y-2 border-t border-line-soft pt-3">
        <Button variant="outline" size="xs" onClick={爲壍} loading={辩壍.isPending} disabled={!蓜壍.url.hasValue}>
          Test send
        </Button>
        {虔壍 ? (<span className="text-xs text-muted-3">Defined in .env — read-only</span>) : (<>
            <ActionLink onClick={凋壍}>Edit</ActionLink>
            <ActionLink tone="crit" onClick={為壍}>
              Delete
            </ActionLink>
          </>)}
      </div>
    </div>);
}
function 棝壍({ route: 蟌壍, channels: 咻壍, campaignNames: 玪壍, onEdit: 銙壍, onToggle: 很壍 }: {
    route: AlertRoute;
    channels: AlertChannelView[];
    campaignNames: Map<string, string>;
    onEdit: () => void;
    onToggle: (繷壍: boolean) => void;
}) {
    const 鵦壍 = routeSummary(蟌壍, { channels: 咻壍, campaignNames: 玪壍 });
    return (<div className={cn("flex flex-wrap items-start gap-x-5 gap-y-3 border-b border-line-soft py-4 last:border-b-0", !蟌壍.enabled && "opacity-60")}>
      <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={銙壍} className="text-left font-display text-base font-semibold hover:text-accent">
            {蟌壍.name}
          </button>
          {蟌壍.implicit ? <Pill tone="muted">Implicit default</Pill> : null}
          <Pill tone="accent">{鵦壍.severity}</Pill>
        </div>
        <span className="text-[13px] text-muted">{`→ ${鵦壍.channels}`}</span>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-3">
          <span>{鵦壍.filters.length ? 鵦壍.filters.join(" · ") : "Every signal kind, metric and campaign"}</span>
          {鵦壍.quiet ? <span>{`Quiet ${鵦壍.quiet}`}</span> : null}
          <span>{鵦壍.renotify}</span>
          {鵦壍.includeResolved ? <span>Resolved notices</span> : null}
          {鵦壍.digest ? <span>{鵦壍.digest}</span> : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {蟌壍.implicit ? (<Button variant="outline" size="xs" onClick={銙壍}>
            Customize
          </Button>) : (<>
            <Switch checked={蟌壍.enabled} onChange={很壍} ariaLabel={`${蟌壍.enabled ? "Disable" : "Enable"} ${蟌壍.name}`}/>
            <ActionLink onClick={銙壍}>Edit</ActionLink>
          </>)}
      </div>
    </div>);
}
export function NotificationsScreen() {
    const 橕壍 = useStatus();
    const 襄壍 = useAlertChannels();
    const 嘳壍 = useAlertRoutes();
    const 產壍 = useCampaignOptions();
    const 鐑壍 = useDeleteAlertChannel();
    const 愀壍 = useDeleteAlertRoute();
    const 翯壍 = useSaveAlertRoute();
    const 點壍 = useRunAlerts();
    const 母壍 = useRunAlerts();
    const 誼壍 = useDigestPreview();
    const [, 垫壍] = useNotificationPermission();
    const { timeZone: 皚壍 } = useValueFormat();
    const [閉壍, 扸壍] = useState<{
        channel?: AlertChannelView;
    } | null>(null);
    const [腧壍, 乖壍] = useState<{
        route?: AlertRoute;
    } | null>(null);
    const [浅壍, 谴壍] = useState<AlertChannelView | null>(null);
    const [夣壍, 砒壍] = useState<AlertRoute | null>(null);
    const [霁壍, 揰壍] = useState(false);
    const [苟壍, 俎壍] = useState(false);
    const 溽壍 = useMemo(() => 襄壍.data ?? [], [襄壍.data]);
    const 趬壍 = 嘳壍.data ?? [];
    const 媛壍 = useMemo(() => new Map((產壍.data ?? []).map((禊壍) => [禊壍.id, 禊壍.name])), [產壍.data]);
    const 项壍 = !!橕壍.data?.security.encryption;
    const 敨壍 = 橕壍.data?.mode !== "live";
    const 著壍 = () => {
        母壍.reset();
        點壍.mutate({ dryRun: true });
        揰壍(true);
    };
    const 兆壍 = () => {
        誼壍.mutate(undefined);
        俎壍(true);
    };
    return (<div className="flex flex-col gap-6">
      <PageHeader actions={<>
            <Button variant="outline" size="xs" onClick={兆壍}>
              Digest preview
            </Button>
            <Button variant="accent" size="xs" onClick={著壍}>
              Run alerts now
            </Button>
          </>}/>

      <Cmp10 onEnableBrowser={() => void 垫壍()}/>

      <section className="flex flex-col gap-4" aria-labelledby="channels-title">
        <CardHeader title={<span id="channels-title">Alert channels</span>} sub="Where alerts, resolved notices and digests are posted" action={<Button variant="outline" size="xs" onClick={() => 扸壍({})}>
              + Add channel
            </Button>}/>
        {襄壍.error ? <ErrorState error={襄壍.error} onRetry={() => void 襄壍.refetch()}/> : null}
        {!襄壍.data && !襄壍.error ? (<div className="grid grid-cols-1 gap-4 md:grid-cols-2 wide:grid-cols-3">
            {[0, 1, 2].map((瀵壍) => (<Skeleton key={瀵壍} height={210} className="rounded-card"/>))}
          </div>) : null}
        {襄壍.data ? (<div className="grid grid-cols-1 gap-4 md:grid-cols-2 wide:grid-cols-3">
            {溽壍.map((輤壍) => (<Cmp11 key={輤壍.id} ch={輤壍} onEdit={() => 扸壍({ channel: 輤壍 })} onDelete={() => 谴壍(輤壍)}/>))}
            <DashedCard interactive role="button" tabIndex={0} onClick={() => 扸壍({})} onKeyDown={(尓壍) => {
                if (尓壍.key !== "Enter" && 尓壍.key !== " ")
                    return;
                尓壍.preventDefault();
                扸壍({});
            }} className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-card p-6 text-[13px]">
              <span className="font-display text-base font-semibold text-fg">+ Add a channel</span>
              <span className="max-w-[40ch] leading-relaxed">Slack, Microsoft Teams (Workflows), Discord or a signed webhook.</span>
              <span className="max-w-[44ch] font-mono text-micro leading-relaxed tracking-label uppercase">Or in .env: SLACK_WEBHOOK_URL · TEAMS_WEBHOOK_URL · DISCORD_WEBHOOK_URL · ALERT_WEBHOOK_URL</span>
            </DashedCard>
          </div>) : null}
        {!项壍 && 橕壍.data ? (<p className="text-xs leading-relaxed text-muted-3">
            <span className="font-mono">APP_ENCRYPTION_KEY</span> isn&apos;t set, so webhook URLs can only come from .env for now (<span className="font-mono">npm run gen:key</span> creates a key).
          </p>) : null}
      </section>

      <Card className="flex flex-col gap-2">
        <CardHeader title="Routes" sub="Which signals go to which channels — first match per channel wins, duplicates are sent once" action={<Button variant="outline" size="xs" onClick={() => 乖壍({})} disabled={!溽壍.length}>
              + New route
            </Button>}/>
        {嘳壍.error ? <ErrorState error={嘳壍.error} onRetry={() => void 嘳壍.refetch()}/> : null}
        {!嘳壍.data && !嘳壍.error ? <SkeletonLines lines={3}/> : null}
        <div className="flex flex-col">
          {趬壍.map((笂壍) => (<棝壍 key={笂壍.id} route={笂壍} channels={溽壍} campaignNames={媛壍} onEdit={() => 乖壍({ route: 笂壍 })} onToggle={(駱壍) => {
                const { id: 曠壍, version: 藏壍, createdAt: _劾壍, updatedAt: _熭壍, implicit: _邜壍, ...嶋壍 } = 笂壍;
                翯壍.mutate({ id: 曠壍, version: 藏壍, body: { ...嶋壍, enabled: 駱壍 } }, { onError: (籺壍) => toast(籺壍.message || "Couldn't update the route", { tone: "crit" }) });
            }}/>))}
        </div>
        {嘳壍.data && 趬壍.every((魩壍) => 魩壍.implicit) ? <p className="text-xs text-muted-3">No routes yet: the implicit default sends warning and critical signals to every enabled channel. Create a route to take control.</p> : null}
      </Card>

      {閉壍 ? <ChannelDialog key={閉壍.channel?.id ?? "new"} channel={閉壍.channel} encryption={项壍} onClose={() => 扸壍(null)}/> : null}
      {腧壍 ? <RouteEditor key={腧壍.route?.id ?? "new"} route={腧壍.route} channels={溽壍} timeZone={皚壍} onClose={() => 乖壍(null)} onDelete={(桘壍) => 砒壍(桘壍)}/> : null}
      {霁壍 ? <RunAlertsDialog dry={點壍} send={母壍} blank={敨壍} onClose={() => 揰壍(false)}/> : null}
      {苟壍 ? <DigestPreviewDialog preview={誼壍} routes={趬壍} onClose={() => 俎壍(false)}/> : null}

      <ConfirmDialog open={!!浅壍} onOpenChange={(蝇壍) => !蝇壍 && 谴壍(null)} title="Delete this channel?" description={浅壍 ? `“${浅壍.name}” stops receiving alerts. Routes that only used it are disabled.` : undefined} confirmLabel="Delete channel" danger onConfirm={() => {
            const 吶壍 = 浅壍;
            if (!吶壍)
                return;
            鐑壍.mutate(吶壍.id, {
                onSuccess: (猥壍) => toast(`Deleted “${吶壍.name}”${猥壍.updatedRoutes.length ? ` · ${猥壍.updatedRoutes.length} route${猥壍.updatedRoutes.length === 1 ? "" : "s"} updated` : ""}`),
                onError: (鈔壍) => toast(鈔壍.message || "Couldn't delete the channel", { tone: "crit" }),
            });
        }}/>
      <ConfirmDialog open={!!夣壍} onOpenChange={(弃壍) => !弃壍 && 砒壍(null)} title="Delete this route?" description={夣壍 ? `“${夣壍.name}” stops routing signals.${趬壍.filter((緲壍) => !緲壍.implicit).length === 1 ? " With no routes left, the implicit default applies again." : ""}` : undefined} confirmLabel="Delete route" danger onConfirm={() => {
            const 鳡壍 = 夣壍;
            if (!鳡壍)
                return;
            愀壍.mutate(鳡壍.id, {
                onSuccess: () => {
                    toast(`Deleted “${鳡壍.name}”`);
                    乖壍(null);
                },
                onError: (槐壍) => toast(槐壍.message || "Couldn't delete the route", { tone: "crit" }),
            });
        }}/>
    </div>);
}
