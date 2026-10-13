"use client";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shell/page-chrome";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Dot, Pill, type Tone } from "@/components/ui/status";
import { Card, CardHeader, CodeBlock, MetaStat } from "@/components/ui/surfaces";
import { toast } from "@/components/ui/toast";
import { useAccounts, useRefreshGoogleAds, useSwitchAccount, useTestGoogleAds, type GoogleAdsHealth } from "@/lib/api/data-source";
import { qk, useStatus } from "@/lib/api/hooks";
import type { StatusResponse } from "@/lib/domain/contracts/status";
import { formatLong } from "@/lib/domain/dates";
import { DisplayPreferences } from "./display-prefs";
import { coreGoogleAdsRows, envExample, envRowStatus, goLiveChecklist } from "./env-model";
import { EnvironmentSection } from "./env-table";
import { formatAccountId, formatInterval, timeAgo } from "./format";
import { useNow } from "./use-now";
const 帘壍: Record<Tone, string> = { accent: "var(--accent)", crit: "var(--crit)", warn: "var(--warn)", muted: "var(--muted)", faint: "var(--faint)" };
const 紇壍 = (<>
    The dashboard reads <span className="font-mono text-fg">.env</span> on the server. Live data requires every required key plus a successful Google Ads API check; until then every page shows generated demo accounts.
  </>);
type Health = StatusResponse["googleAds"]["health"];
const 鯶壍: Record<NonNullable<StatusResponse["reason"]>["code"], string> = {
    no_env: "No credentials",
    missing_keys: "Keys missing",
    auth_failed: "Auth failed",
    api_error: "API error",
    demo: "Demo data",
};
function 棥壍(蟔壍: Health, 哃壍: number): {
    label: string;
    tone: Tone;
} {
    if (蟔壍?.ok)
        return { label: "Reachable", tone: "accent" };
    if (蟔壍)
        return { label: 蟔壍.errorCode ? `Unreachable · ${蟔壍.errorCode}` : "Unreachable", tone: "crit" };
    if (哃壍)
        return { label: "Skipped", tone: "faint" };
    return { label: "Not checked", tone: "faint" };
}
export function ConnectionScreen() {
    const 玲壍 = useStatus();
    const 銡壍 = useTestGoogleAds();
    const 徐壍 = useRefreshGoogleAds();
    const 繿壍 = useQueryClient();
    const 鵮壍 = () => 銡壍.mutate(undefined, {
        onSuccess: (橝壍) => toast(橝壍.mode === "live" ? (橝壍.ok ? "Google Ads API reachable" : "Google Ads API check failed") : "No live data — no API call was made", { tone: 橝壍.mode === "live" && !橝壍.ok ? "crit" : "default" }),
        onError: (襌壍) => toast(襌壍.message || "Health check failed", { tone: "crit" }),
    });
    const 嘻壍 = () => 徐壍.mutate(undefined, {
        onSuccess: (甪壍) => toast(`Refreshed · ${甪壍.mode} data through ${formatLong(甪壍.dataThrough)}`),
        onError: (鐙壍) => toast(鐙壍.message || "Refresh failed", { tone: "crit" }),
    });
    const 愈壍 = () => {
        void 繿壍.invalidateQueries({ queryKey: qk.status() });
        鵮壍();
    };
    const 翷壍 = (<PageHeader description={紇壍} actions={<>
          <Button variant="outline" onClick={鵮壍} loading={銡壍.isPending}>
            Test connection
          </Button>
          <Button variant="ghost" onClick={嘻壍} loading={徐壍.isPending}>
            ↻ Refresh data
          </Button>
        </>}/>);
    if (玲壍.error && !玲壍.data) {
        return (<div className="flex flex-col gap-6">
        {翷壍}
        <ErrorState error={玲壍.error} onRetry={() => void 玲壍.refetch()}/>
      </div>);
    }
    if (!玲壍.data) {
        return (<div className="flex flex-col gap-6">
        {翷壍}
        <Skeleton height={180} className="rounded-card"/>
        <Skeleton height={360} className="rounded-card"/>
      </div>);
    }
    const 黦壍 = 玲壍.data;
    return (<div className="flex flex-col gap-6">
      {翷壍}
      <Cmp40 status={黦壍} tested={銡壍.data ?? null}/>
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))" }}>
        <浍壍 status={黦壍} onRecheck={愈壍} checking={銡壍.isPending}/>
        <滅壍 status={黦壍}/>
      </div>
      <div className="grid grid-cols-1 gap-5 wide:grid-cols-2">
        <禒壍 status={黦壍}/>
        <Cmp41 status={黦壍}/>
      </div>
      <Cmp42 status={黦壍}/>
      <EnvironmentSection env={黦壍.env}/>
      <DisplayPreferences accountCurrency={黦壍.account.currency} envCurrency={黦壍.env.some((毕壍) => 毕壍.key === "DASHBOARD_CURRENCY" && 毕壍.set)}/>
    </div>);
}
function Cmp40({ status: 垳壍, tested: 皢壍 }: {
    status: StatusResponse;
    tested: GoogleAdsHealth | null;
}) {
    const 閑壍 = useNow();
    const 技壍 = 垳壍.mode === "live";
    const 腯壍 = 皢壍?.health ?? 垳壍.googleAds.health;
    const 乞壍 = 棥壍(腯壍, 垳壍.googleAds.missingKeys.length);
    return (<Card accent={技壍} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-[260px] flex-1 flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <Dot tone={技壍 ? "accent" : "warn"} halo size={9}/>
            <span className="font-display text-2xl font-semibold tracking-[-0.02em]">{技壍 ? "Live" : "No live data"}</span>
            <Pill tone={技壍 ? "accent" : "warn"}>{技壍 ? "Google Ads API" : 鯶壍[垳壍.reason?.code ?? "no_env"]}</Pill>
          </div>
          <p className="m-0 max-w-[80ch] text-[14px] leading-relaxed text-muted">{垳壍.reasonText}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetaStat label="Account" value={<span className="block truncate text-[15px]">{垳壍.account.name}</span>}/>
        <MetaStat label="Customer id" value={<span className="font-mono text-[14px]">{formatAccountId(垳壍.account.id)}</span>}/>
        <MetaStat label="Data through" value={<span className="text-[15px]">{formatLong(垳壍.dataThrough)}</span>}/>
        <MetaStat label="API version" value={<span className="font-mono text-[14px]">{垳壍.googleAds.apiVersion}</span>}/>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-4 text-[13px]">
        <Dot tone={乞壍.tone} size={7}/>
        <span className="font-mono text-meta" style={{ color: 帘壍[乞壍.tone] }}>
          {乞壍.label}
        </span>
        {腯壍?.latencyMs !== undefined ? <span className="font-mono text-meta text-muted-3">{Math.round(腯壍.latencyMs)} ms</span> : null}
        {腯壍?.checkedAt && 閑壍 !== null ? <span className="text-xs text-muted-3">checked {timeAgo(腯壍.checkedAt, 閑壍)}</span> : null}
        <span className="min-w-[200px] flex-1 text-xs text-muted-3">
          {皢壍 && 皢壍.mode !== "live" ? "No live data: the health check makes no API call until every required key is set." : 技壍 ? "Token refresh + a customer query against the Google Ads API." : `.env file ${垳壍.googleAds.envFile ? "found" : "not found"} · ${垳壍.googleAds.missingKeys.length} required key${垳壍.googleAds.missingKeys.length === 1 ? "" : "s"} missing`}
        </span>
      </div>
    </Card>);
}
function 浍壍({ status: 谼壍, onRecheck: 夫壍, checking: 砚壍 }: {
    status: StatusResponse;
    onRecheck: () => void;
    checking: boolean;
}) {
    const 霉壍 = coreGoogleAdsRows(谼壍.env);
    const 揸壍 = 棥壍(谼壍.googleAds.health, 谼壍.googleAds.missingKeys.length);
    return (<div className="flex flex-col rounded-card border border-line bg-card">
      <div className="flex items-center gap-3 border-b border-line px-[22px] py-[18px]">
        <span className="flex-1 font-display text-base font-semibold">Credentials</span>
        <button type="button" onClick={夫壍} disabled={砚壍} className="text-xs text-accent hover:opacity-85 disabled:opacity-50">
          {砚壍 ? "Checking…" : "Re-check →"}
        </button>
      </div>
      {霉壍.map((苧壍) => {
            const 俖壍 = envRowStatus(苧壍);
            return (<div key={苧壍.key} className="flex items-center gap-3 border-b border-line-soft px-[22px] py-3.5" title={苧壍.description}>
            <span aria-hidden className="size-[7px] shrink-0 rounded-full" style={{ background: 帘壍[俖壍.tone] }}/>
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg">{苧壍.key}</span>
            <span className="font-mono text-meta" style={{ color: 帘壍[俖壍.tone] }}>
              {俖壍.label}
            </span>
          </div>);
        })}
      <div className="flex items-center gap-3 px-[22px] py-3.5">
        <span aria-hidden className="size-[7px] shrink-0 rounded-full" style={{ background: 帘壍[揸壍.tone] }}/>
        <span className="min-w-0 flex-1 truncate font-mono text-xs">/api/google-ads/health</span>
        <span className="font-mono text-meta" style={{ color: 帘壍[揸壍.tone] }}>
          {揸壍.label}
        </span>
      </div>
    </div>);
}
function 滅壍({ status: 趴壍 }: {
    status: StatusResponse;
}) {
    const 媣壍 = envExample(趴壍.env);
    return (<div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="flex-1 font-mono text-micro tracking-[0.14em] text-muted-3 uppercase">.env.example</span>
        <Button variant="ghost" size="xs" onClick={() => void navigator.clipboard.writeText(媣壍).then(() => toast(".env.example copied"), () => toast("Copy failed", { tone: "crit" }))}>
          Copy
        </Button>
      </div>
      <CodeBlock className="leading-[1.8]">{媣壍}</CodeBlock>
      <span className="text-xs leading-relaxed text-muted-3">
        Copy to <span className="font-mono text-fg">.env</span> next to <span className="font-mono text-fg">package.json</span> and fill in the OAuth client and refresh token from the Google Cloud project with Google Ads API access, then restart the server.
      </span>
    </div>);
}
function 禒壍({ status: 颁壍 }: {
    status: StatusResponse;
}) {
    const 数壍 = goLiveChecklist(颁壍);
    const 葟壍 = 数壍.filter((兎壍) => 兎壍.state === "done").length;
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Go-live checklist" sub={`${葟壍} of ${数壍.length} verified`}/>
      <ol className="m-0 flex list-none flex-col p-0">
        {数壍.map((瀽壍) => (<li key={瀽壍.id} className="flex items-start gap-3 border-b border-line-soft py-3 last:border-b-0">
            <span aria-hidden className={cn("mt-px grid size-5 shrink-0 place-items-center rounded-full border text-[11px] leading-none", 瀽壍.state === "done" ? "border-accent bg-accent text-on-accent" : 瀽壍.state === "manual" ? "border-dashed border-line-strong text-faint" : "border-line-strong text-faint")}>
              {瀽壍.state === "done" ? "✓" : ""}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[13px] font-semibold">{瀽壍.label}</span>
              <span className="text-xs leading-normal text-muted-3">{瀽壍.detail}</span>
            </div>
            <span className={cn("shrink-0 font-mono text-micro tracking-label uppercase", 瀽壍.state === "done" ? "text-accent" : "text-faint")}>{瀽壍.state === "done" ? "Verified" : 瀽壍.state === "manual" ? "Check" : "To do"}</span>
          </li>))}
      </ol>
      <a href="https://developers.google.com/google-ads/api/docs/get-started/introduction" target="_blank" rel="noreferrer noopener" className="self-start text-xs">
        Google Ads API: getting started ↗
      </a>
    </Card>);
}
function Cmp41({ status: 尛壍 }: {
    status: StatusResponse;
}) {
    const 笊壍 = useAccounts();
    const 駹壍 = useSwitchAccount();
    const 曨壍 = 笊壍.data?.accounts ?? 尛壍.accounts;
    const 藗壍 = 笊壍.data?.active ?? 尛壍.account.id;
    const 勆壍 = 笊壍.data?.manager ?? 尛壍.manager;
    const 熵壍 = 尛壍.env.find((邤壍) => 邤壍.key === "GOOGLE_ADS_LOGIN_CUSTOMER_ID");
    const 嶓壍 = (粂壍: string, 魱壍: string) => 駹壍.mutate(粂壍, { onSuccess: () => toast(`Switched to ${魱壍}`), onError: (桠壍) => toast(桠壍.message || "Switch failed", { tone: "crit" }) });
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Accounts" sub={勆壍 ? `Manager · ${勆壍.name} · ${formatAccountId(勆壍.id)}` : "Single client account"} action={<span className="meta">{曨壍.length} accessible</span>}/>
      <ul className="m-0 flex list-none flex-col p-0">
        {曨壍.map((蝏壍) => {
            const 吾壍 = 蝏壍.id === 藗壍;
            return (<li key={蝏壍.id} className="flex items-center gap-3 border-b border-line-soft py-3 last:border-b-0">
              <Dot tone={吾壍 ? "accent" : "faint"} size={7}/>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[13px] font-semibold">{蝏壍.name}</span>
                <span className="truncate font-mono text-micro text-muted-3">
                  {formatAccountId(蝏壍.id)} · {蝏壍.currency} · {蝏壍.timezone}
                </span>
              </div>
              <Pill tone={蝏壍.mode === "live" ? "accent" : "muted"} className="px-1.5 py-px text-[9px]">
                {蝏壍.mode === "live" ? "Live" : "Demo"}
              </Pill>
              {吾壍 ? (<span className="w-[68px] text-right font-mono text-micro tracking-label text-accent uppercase">✓ Active</span>) : (<Button variant="ghost" size="xs" className="w-[68px] justify-center" loading={駹壍.isPending && 駹壍.variables === 蝏壍.id} disabled={駹壍.isPending} onClick={() => 嶓壍(蝏壍.id, 蝏壍.name)}>
                  Switch
                </Button>)}
            </li>);
        })}
      </ul>
      <span className="text-xs leading-normal text-muted-3">
        {熵壍?.set ? "Every client under the manager in GOOGLE_ADS_LOGIN_CUSTOMER_ID is listed; switching reloads every view." : "Set GOOGLE_ADS_LOGIN_CUSTOMER_ID (your MCC id) to list and switch between client accounts."}
      </span>
    </Card>);
}
function 猭壍({ k: 鈜壍, children: 弋壍 }: {
    k: string;
    children: React.ReactNode;
}) {
    return (<div className="flex items-baseline justify-between gap-3 border-b border-line-soft py-2 text-[13px] last:border-b-0">
      <span className="shrink-0 text-muted-3">{鈜壍}</span>
      <span className="min-w-0 text-right">{弋壍}</span>
    </div>);
}
function 緺壍({ on: 鳩壍, yes: 様壍 = "On", no: 裇壍 = "Off" }: {
    on: boolean;
    yes?: string;
    no?: string;
}) {
    return <span className={cn("font-mono text-meta", 鳩壍 ? "text-accent" : "text-faint")}>{鳩壍 ? `✓ ${様壍}` : 裇壍}</span>;
}
function Cmp42({ status: 璥壍 }: {
    status: StatusResponse;
}) {
    const 鎔壍 = useNow();
    return (<div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(250px, 100%), 1fr))" }}>
      <Card className="flex flex-col gap-2 p-5">
        <CardHeader title="Store" sub={璥壍.store.driver === "file" ? "JSON files on disk" : "In memory"}/>
        <div className="flex flex-col">
          <猭壍 k="Driver">
            <span className="font-mono text-meta">{璥壍.store.driver}</span>
          </猭壍>
          <猭壍 k="Writable">
            <緺壍 on={璥壍.store.writable} yes="Yes" no="No"/>
          </猭壍>
        </div>
        {璥壍.store.fallbackReason ? <span className="text-xs leading-normal text-warn">▲ {璥壍.store.fallbackReason}</span> : <span className="text-xs text-muted-3">{璥壍.store.driver === "memory" ? "Data resets on restart." : "Dashboards and settings persist across restarts."}</span>}
      </Card>

      <Card className="flex flex-col gap-2 p-5">
        <CardHeader title="Scheduler" sub="Alert evaluation"/>
        <div className="flex flex-col">
          <猭壍 k="State">
            <緺壍 on={璥壍.scheduler.enabled} yes="Running" no="Off"/>
          </猭壍>
          <猭壍 k="Interval">{formatInterval(璥壍.scheduler.intervalMinutes * 60)}</猭壍>
          <猭壍 k="Last run">{璥壍.scheduler.lastRunAt ? (鎔壍 !== null ? timeAgo(璥壍.scheduler.lastRunAt, 鎔壍) : "…") : <span className="text-faint">never</span>}</猭壍>
        </div>
        <span className="text-xs leading-normal text-muted-3">{璥壍.scheduler.enabled ? "Runs inside this Node server." : "Set ALERTS_SCHEDULER_ENABLED=true, or call /api/cron/alerts from an external cron."}</span>
      </Card>

      <Card className="flex flex-col gap-2 p-5">
        <CardHeader title="Security" sub="Read-only by design"/>
        <div className="flex flex-col">
          <猭壍 k="Basic auth">
            <緺壍 on={璥壍.security.basicAuth}/>
          </猭壍>
          <猭壍 k="Secret encryption">
            <緺壍 on={璥壍.security.encryption}/>
          </猭壍>
          <猭壍 k="Google Ads writes">
            <span className="font-mono text-meta text-accent">✓ Never</span>
          </猭壍>
        </div>
        <span className="text-xs leading-normal text-muted-3">{璥壍.security.encryption ? "Secrets saved from the UI are encrypted with APP_ENCRYPTION_KEY." : "Without APP_ENCRYPTION_KEY, secrets can only come from .env (npm run gen:key)."}</span>
      </Card>
    </div>);
}
