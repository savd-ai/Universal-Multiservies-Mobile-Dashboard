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
const TONE_VAR: Record<Tone, string> = { accent: "var(--accent)", crit: "var(--crit)", warn: "var(--warn)", muted: "var(--muted)", faint: "var(--faint)" };
const DESCRIPTION = (<>
    The dashboard reads <span className="font-mono text-fg">.env</span> on the server. Live data requires every required key plus a successful Google Ads API check; until then every page shows generated demo accounts.
  </>);
type Health = StatusResponse["googleAds"]["health"];
const REASON_LABEL: Record<NonNullable<StatusResponse["reason"]>["code"], string> = {
    no_env: "No credentials",
    missing_keys: "Keys missing",
    auth_failed: "Auth failed",
    api_error: "API error",
    demo: "Demo data",
};
function healthState(health: Health, missing: number): {
    label: string;
    tone: Tone;
} {
    if (health?.ok)
        return { label: "Reachable", tone: "accent" };
    if (health)
        return { label: health.errorCode ? `Unreachable · ${health.errorCode}` : "Unreachable", tone: "crit" };
    if (missing)
        return { label: "Skipped", tone: "faint" };
    return { label: "Not checked", tone: "faint" };
}
export function ConnectionScreen() {
    const status = useStatus();
    const test = useTestGoogleAds();
    const refresh = useRefreshGoogleAds();
    const qc = useQueryClient();
    const runTest = () => test.mutate(undefined, {
        onSuccess: (r) => toast(r.mode === "live" ? (r.ok ? "Google Ads API reachable" : "Google Ads API check failed") : "No live data — no API call was made", { tone: r.mode === "live" && !r.ok ? "crit" : "default" }),
        onError: (e) => toast(e.message || "Health check failed", { tone: "crit" }),
    });
    const runRefresh = () => refresh.mutate(undefined, {
        onSuccess: (r) => toast(`Refreshed · ${r.mode} data through ${formatLong(r.dataThrough)}`),
        onError: (e) => toast(e.message || "Refresh failed", { tone: "crit" }),
    });
    const recheck = () => {
        void qc.invalidateQueries({ queryKey: qk.status() });
        runTest();
    };
    const header = (<PageHeader description={DESCRIPTION} actions={<>
          <Button variant="outline" onClick={runTest} loading={test.isPending}>
            Test connection
          </Button>
          <Button variant="ghost" onClick={runRefresh} loading={refresh.isPending}>
            ↻ Refresh data
          </Button>
        </>}/>);
    if (status.error && !status.data) {
        return (<div className="flex flex-col gap-6">
        {header}
        <ErrorState error={status.error} onRetry={() => void status.refetch()}/>
      </div>);
    }
    if (!status.data) {
        return (<div className="flex flex-col gap-6">
        {header}
        <Skeleton height={180} className="rounded-card"/>
        <Skeleton height={360} className="rounded-card"/>
      </div>);
    }
    const s = status.data;
    return (<div className="flex flex-col gap-6">
      {header}
      <ModeCard status={s} tested={test.data ?? null}/>
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))" }}>
        <CredentialsCard status={s} onRecheck={recheck} checking={test.isPending}/>
        <EnvExample status={s}/>
      </div>
      <div className="grid grid-cols-1 gap-5 wide:grid-cols-2">
        <GoLiveCard status={s}/>
        <AccountsCard status={s}/>
      </div>
      <SystemCards status={s}/>
      <EnvironmentSection env={s.env}/>
      <DisplayPreferences accountCurrency={s.account.currency} envCurrency={s.env.some((e) => e.key === "DASHBOARD_CURRENCY" && e.set)}/>
    </div>);
}
function ModeCard({ status: s, tested }: {
    status: StatusResponse;
    tested: GoogleAdsHealth | null;
}) {
    const now = useNow();
    const live = s.mode === "live";
    const health = tested?.health ?? s.googleAds.health;
    const h = healthState(health, s.googleAds.missingKeys.length);
    return (<Card accent={live} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-[260px] flex-1 flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <Dot tone={live ? "accent" : "warn"} halo size={9}/>
            <span className="font-display text-2xl font-semibold tracking-[-0.02em]">{live ? "Live" : "No live data"}</span>
            <Pill tone={live ? "accent" : "warn"}>{live ? "Google Ads API" : REASON_LABEL[s.reason?.code ?? "no_env"]}</Pill>
          </div>
          <p className="m-0 max-w-[80ch] text-[14px] leading-relaxed text-muted">{s.reasonText}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetaStat label="Account" value={<span className="block truncate text-[15px]">{s.account.name}</span>}/>
        <MetaStat label="Customer id" value={<span className="font-mono text-[14px]">{formatAccountId(s.account.id)}</span>}/>
        <MetaStat label="Data through" value={<span className="text-[15px]">{formatLong(s.dataThrough)}</span>}/>
        <MetaStat label="API version" value={<span className="font-mono text-[14px]">{s.googleAds.apiVersion}</span>}/>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-4 text-[13px]">
        <Dot tone={h.tone} size={7}/>
        <span className="font-mono text-meta" style={{ color: TONE_VAR[h.tone] }}>
          {h.label}
        </span>
        {health?.latencyMs !== undefined ? <span className="font-mono text-meta text-muted-3">{Math.round(health.latencyMs)} ms</span> : null}
        {health?.checkedAt && now !== null ? <span className="text-xs text-muted-3">checked {timeAgo(health.checkedAt, now)}</span> : null}
        <span className="min-w-[200px] flex-1 text-xs text-muted-3">
          {tested && tested.mode !== "live" ? "No live data: the health check makes no API call until every required key is set." : live ? "Token refresh + a customer query against the Google Ads API." : `.env file ${s.googleAds.envFile ? "found" : "not found"} · ${s.googleAds.missingKeys.length} required key${s.googleAds.missingKeys.length === 1 ? "" : "s"} missing`}
        </span>
      </div>
    </Card>);
}
function CredentialsCard({ status: s, onRecheck, checking }: {
    status: StatusResponse;
    onRecheck: () => void;
    checking: boolean;
}) {
    const rows = coreGoogleAdsRows(s.env);
    const h = healthState(s.googleAds.health, s.googleAds.missingKeys.length);
    return (<div className="flex flex-col rounded-card border border-line bg-card">
      <div className="flex items-center gap-3 border-b border-line px-[22px] py-[18px]">
        <span className="flex-1 font-display text-base font-semibold">Credentials</span>
        <button type="button" onClick={onRecheck} disabled={checking} className="text-xs text-accent hover:opacity-85 disabled:opacity-50">
          {checking ? "Checking…" : "Re-check →"}
        </button>
      </div>
      {rows.map((e) => {
            const st = envRowStatus(e);
            return (<div key={e.key} className="flex items-center gap-3 border-b border-line-soft px-[22px] py-3.5" title={e.description}>
            <span aria-hidden className="size-[7px] shrink-0 rounded-full" style={{ background: TONE_VAR[st.tone] }}/>
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg">{e.key}</span>
            <span className="font-mono text-meta" style={{ color: TONE_VAR[st.tone] }}>
              {st.label}
            </span>
          </div>);
        })}
      <div className="flex items-center gap-3 px-[22px] py-3.5">
        <span aria-hidden className="size-[7px] shrink-0 rounded-full" style={{ background: TONE_VAR[h.tone] }}/>
        <span className="min-w-0 flex-1 truncate font-mono text-xs">/api/google-ads/health</span>
        <span className="font-mono text-meta" style={{ color: TONE_VAR[h.tone] }}>
          {h.label}
        </span>
      </div>
    </div>);
}
function EnvExample({ status: s }: {
    status: StatusResponse;
}) {
    const text = envExample(s.env);
    return (<div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="flex-1 font-mono text-micro tracking-[0.14em] text-muted-3 uppercase">.env.example</span>
        <Button variant="ghost" size="xs" onClick={() => void navigator.clipboard.writeText(text).then(() => toast(".env.example copied"), () => toast("Copy failed", { tone: "crit" }))}>
          Copy
        </Button>
      </div>
      <CodeBlock className="leading-[1.8]">{text}</CodeBlock>
      <span className="text-xs leading-relaxed text-muted-3">
        Copy to <span className="font-mono text-fg">.env</span> next to <span className="font-mono text-fg">package.json</span> and fill in the OAuth client and refresh token from the Google Cloud project with Google Ads API access, then restart the server.
      </span>
    </div>);
}
function GoLiveCard({ status: s }: {
    status: StatusResponse;
}) {
    const items = goLiveChecklist(s);
    const done = items.filter((i) => i.state === "done").length;
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Go-live checklist" sub={`${done} of ${items.length} verified`}/>
      <ol className="m-0 flex list-none flex-col p-0">
        {items.map((i) => (<li key={i.id} className="flex items-start gap-3 border-b border-line-soft py-3 last:border-b-0">
            <span aria-hidden className={cn("mt-px grid size-5 shrink-0 place-items-center rounded-full border text-[11px] leading-none", i.state === "done" ? "border-accent bg-accent text-on-accent" : i.state === "manual" ? "border-dashed border-line-strong text-faint" : "border-line-strong text-faint")}>
              {i.state === "done" ? "✓" : ""}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[13px] font-semibold">{i.label}</span>
              <span className="text-xs leading-normal text-muted-3">{i.detail}</span>
            </div>
            <span className={cn("shrink-0 font-mono text-micro tracking-label uppercase", i.state === "done" ? "text-accent" : "text-faint")}>{i.state === "done" ? "Verified" : i.state === "manual" ? "Check" : "To do"}</span>
          </li>))}
      </ol>
      <a href="https://developers.google.com/google-ads/api/docs/get-started/introduction" target="_blank" rel="noreferrer noopener" className="self-start text-xs">
        Google Ads API: getting started ↗
      </a>
    </Card>);
}
function AccountsCard({ status: s }: {
    status: StatusResponse;
}) {
    const accounts = useAccounts();
    const switchAccount = useSwitchAccount();
    const list = accounts.data?.accounts ?? s.accounts;
    const active = accounts.data?.active ?? s.account.id;
    const manager = accounts.data?.manager ?? s.manager;
    const login = s.env.find((e) => e.key === "GOOGLE_ADS_LOGIN_CUSTOMER_ID");
    const switchTo = (id: string, name: string) => switchAccount.mutate(id, { onSuccess: () => toast(`Switched to ${name}`), onError: (e) => toast(e.message || "Switch failed", { tone: "crit" }) });
    return (<Card className="flex flex-col gap-4">
      <CardHeader title="Accounts" sub={manager ? `Manager · ${manager.name} · ${formatAccountId(manager.id)}` : "Single client account"} action={<span className="meta">{list.length} accessible</span>}/>
      <ul className="m-0 flex list-none flex-col p-0">
        {list.map((a) => {
            const on = a.id === active;
            return (<li key={a.id} className="flex items-center gap-3 border-b border-line-soft py-3 last:border-b-0">
              <Dot tone={on ? "accent" : "faint"} size={7}/>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[13px] font-semibold">{a.name}</span>
                <span className="truncate font-mono text-micro text-muted-3">
                  {formatAccountId(a.id)} · {a.currency} · {a.timezone}
                </span>
              </div>
              <Pill tone={a.mode === "live" ? "accent" : "muted"} className="px-1.5 py-px text-[9px]">
                {a.mode === "live" ? "Live" : "Demo"}
              </Pill>
              {on ? (<span className="w-[68px] text-right font-mono text-micro tracking-label text-accent uppercase">✓ Active</span>) : (<Button variant="ghost" size="xs" className="w-[68px] justify-center" loading={switchAccount.isPending && switchAccount.variables === a.id} disabled={switchAccount.isPending} onClick={() => switchTo(a.id, a.name)}>
                  Switch
                </Button>)}
            </li>);
        })}
      </ul>
      <span className="text-xs leading-normal text-muted-3">
        {login?.set ? "Every client under the manager in GOOGLE_ADS_LOGIN_CUSTOMER_ID is listed; switching reloads every view." : "Set GOOGLE_ADS_LOGIN_CUSTOMER_ID (your MCC id) to list and switch between client accounts."}
      </span>
    </Card>);
}
function KV({ k, children }: {
    k: string;
    children: React.ReactNode;
}) {
    return (<div className="flex items-baseline justify-between gap-3 border-b border-line-soft py-2 text-[13px] last:border-b-0">
      <span className="shrink-0 text-muted-3">{k}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>);
}
function OnOff({ on, yes = "On", no = "Off" }: {
    on: boolean;
    yes?: string;
    no?: string;
}) {
    return <span className={cn("font-mono text-meta", on ? "text-accent" : "text-faint")}>{on ? `✓ ${yes}` : no}</span>;
}
function SystemCards({ status: s }: {
    status: StatusResponse;
}) {
    const now = useNow();
    return (<div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(250px, 100%), 1fr))" }}>
      <Card className="flex flex-col gap-2 p-5">
        <CardHeader title="Store" sub={s.store.driver === "file" ? "JSON files on disk" : "In memory"}/>
        <div className="flex flex-col">
          <KV k="Driver">
            <span className="font-mono text-meta">{s.store.driver}</span>
          </KV>
          <KV k="Writable">
            <OnOff on={s.store.writable} yes="Yes" no="No"/>
          </KV>
        </div>
        {s.store.fallbackReason ? <span className="text-xs leading-normal text-warn">▲ {s.store.fallbackReason}</span> : <span className="text-xs text-muted-3">{s.store.driver === "memory" ? "Data resets on restart." : "Dashboards and settings persist across restarts."}</span>}
      </Card>

      <Card className="flex flex-col gap-2 p-5">
        <CardHeader title="Scheduler" sub="Alert evaluation"/>
        <div className="flex flex-col">
          <KV k="State">
            <OnOff on={s.scheduler.enabled} yes="Running" no="Off"/>
          </KV>
          <KV k="Interval">{formatInterval(s.scheduler.intervalMinutes * 60)}</KV>
          <KV k="Last run">{s.scheduler.lastRunAt ? (now !== null ? timeAgo(s.scheduler.lastRunAt, now) : "…") : <span className="text-faint">never</span>}</KV>
        </div>
        <span className="text-xs leading-normal text-muted-3">{s.scheduler.enabled ? "Runs inside this Node server." : "Set ALERTS_SCHEDULER_ENABLED=true, or call /api/cron/alerts from an external cron."}</span>
      </Card>

      <Card className="flex flex-col gap-2 p-5">
        <CardHeader title="Security" sub="Read-only by design"/>
        <div className="flex flex-col">
          <KV k="Basic auth">
            <OnOff on={s.security.basicAuth}/>
          </KV>
          <KV k="Secret encryption">
            <OnOff on={s.security.encryption}/>
          </KV>
          <KV k="Google Ads writes">
            <span className="font-mono text-meta text-accent">✓ Never</span>
          </KV>
        </div>
        <span className="text-xs leading-normal text-muted-3">{s.security.encryption ? "Secrets saved from the UI are encrypted with APP_ENCRYPTION_KEY." : "Without APP_ENCRYPTION_KEY, secrets can only come from .env (npm run gen:key)."}</span>
      </Card>
    </div>);
}
