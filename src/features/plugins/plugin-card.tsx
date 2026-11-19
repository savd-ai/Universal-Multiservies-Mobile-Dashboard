"use client";

import Link from "next/link";
import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Menu } from "@/components/ui/overlays";
import { Pill } from "@/components/ui/status";
import { toast } from "@/components/ui/toast";
import { timeAgo } from "@/features/data-source/format";
import { useNow } from "@/features/data-source/use-now";
import { exportCustomPlugin, useConnectPlugin, useDisconnectPlugin, useSyncPlugin, useTestPlugin } from "@/lib/api/plugins-ui";
import type { PluginView } from "@/lib/domain/contracts/plugins";
import { CATEGORY_LABEL, canBuildLive, cardStatus, isAlertPlugin, needsConnectForm, readsMetrics } from "./plugin-meta";

// One gallery card (prototype: 40px mono mark, name + mono category, status dot, full-width Connect / Disconnect
// pill), plus Live/Demo badge, .env detection, last test, Configure · Test · Sync and the custom-plugin menu.

const TONE_VAR = { accent: "var(--accent)", crit: "var(--crit)", warn: "var(--warn)", muted: "var(--muted)", faint: "var(--faint)" } as const;

export const errorMessage = (e: unknown): string => (e instanceof Error && e.message ? e.message : "Something went wrong");

function hostOf(url: string | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.host ? `${u.protocol}//${u.host}` : url;
  } catch {
    return url;
  }
}

interface PluginCardProps {
  view: PluginView;
  onOpenConnect: (id: string) => void;
  onBuildLive: (view: PluginView) => void;
  onEdit: (id: string) => void;
  onDelete: (view: PluginView) => void;
}

export function PluginCard({ view, onOpenConnect, onBuildLive, onEdit, onDelete }: PluginCardProps) {
  const m = view.manifest;
  const status = cardStatus(view);
  const connect = useConnectPlugin();
  const disconnect = useDisconnectPlugin();
  const test = useTestPlugin();
  const sync = useSyncPlugin();
  const now = useNow();
  const on = view.connected;
  const alert = isAlertPlugin(view);
  const envSet = view.envDetected.filter((e) => e.set);
  const color = TONE_VAR[status.tone];

  const reconnect = () =>
    connect.mutate(
      { id: m.id, values: {} },
      { onSuccess: () => toast(`${m.name} connected`), onError: (e) => toast(errorMessage(e), { tone: "crit" }) },
    );
  const primary = () => {
    if (on) {
      disconnect.mutate(m.id, {
        onSuccess: () => toast(`${m.name} disconnected`, { action: { label: "Undo", onClick: reconnect } }),
        onError: (e) => toast(errorMessage(e), { tone: "crit" }),
      });
    } else if (needsConnectForm(view)) onOpenConnect(m.id);
    else reconnect();
  };
  const runTest = () => test.mutate(m.id, { onSuccess: (r) => toast(r.message, { tone: r.ok ? "default" : "crit", ms: 4000 }), onError: (e) => toast(errorMessage(e), { tone: "crit" }) });
  const runSync = () => sync.mutate(m.id, { onSuccess: (r) => toast(r.message, { tone: r.ok ? "default" : "crit", ms: 4000 }), onError: (e) => toast(errorMessage(e), { tone: "crit" }) });
  const busy = connect.isPending || disconnect.isPending;

  return (
    <article aria-label={m.name} className={cn("flex flex-col gap-3.5 rounded-card border bg-card p-5", on && status.tone !== "crit" ? "border-teal/30" : status.tone === "crit" ? "border-crit/40" : "border-line")}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-mini border border-tone/12 bg-tone/3 font-mono text-eyebrow text-fg">
          {m.icon.abbr}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="truncate font-display text-base font-semibold" title={m.name}>
            {m.name}
          </span>
          <span className="flex min-w-0 items-center gap-2 font-mono text-micro tracking-label text-faint uppercase">
            <span className="truncate">{view.custom ? `${CATEGORY_LABEL[m.category]} · Custom` : CATEGORY_LABEL[m.category]}</span>
            <Pill tone={m.live ? "accent" : "muted"} className="px-1.5 py-px text-[9px]">
              {m.live ? "Live" : "Demo"}
            </Pill>
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-micro tracking-[0.1em] whitespace-nowrap uppercase" style={{ color }} title={status.title}>
          <span aria-hidden className="size-1.5 rounded-full" style={{ background: color }} />
          {status.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5">
        <p className="m-0 text-[13px] leading-[1.6] text-muted">{m.description}</p>
        {view.custom && m.rest ? <span className="truncate font-mono text-meta text-muted-3">{hostOf(m.rest.baseUrl)}</span> : null}
        {!m.live && !view.custom ? (
          <span className="text-xs leading-normal text-muted-3">
            Demo connector — live connector not in v1.
            {canBuildLive(view) ? (
              <>
                {" "}
                <button type="button" className="text-accent hover:opacity-85" onClick={() => onBuildLive(view)}>
                  Build a live connector →
                </button>
              </>
            ) : null}
          </span>
        ) : null}
        {alert ? (
          <Link href="/anomalies/notifications" className="self-start text-xs">
            Route alerts on Notifications →
          </Link>
        ) : null}
        {envSet.length ? (
          <span className="font-mono text-micro leading-normal break-all text-muted-3" title="Detected in .env (presence only — values never leave the server)">
            ✓ {envSet.map((e) => e.key).join(" · ")}
          </span>
        ) : null}
        {status.tone === "crit" && view.reason ? <span className="line-clamp-2 text-xs leading-normal text-crit">{view.reason}</span> : null}
        {view.lastTest && now !== null ? (
          <span className={cn("text-xs leading-normal", view.lastTest.ok ? "text-muted-3" : "text-crit")} title={view.lastTest.message}>
            {view.lastTest.ok ? "✓" : "×"} Tested {timeAgo(view.lastTest.at, now)}
            {view.lastTest.ok ? "" : ` — ${view.lastTest.message}`}
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={primary}
        disabled={busy}
        className={cn(
          "rounded-pill border p-[9px] text-center text-[13px] font-semibold transition-colors disabled:opacity-50",
          on ? "border-line bg-transparent text-muted hover:border-tone/30 hover:text-fg" : "border-tone/14 bg-tone/4 text-fg hover:border-tone/30",
        )}
      >
        {busy ? "…" : on ? "Disconnect" : "Connect →"}
      </button>

      {on || view.custom || envSet.length ? (
        <div className="-mt-1 flex flex-wrap items-center gap-1.5">
          {!view.custom && on && needsConnectForm(view) ? (
            <Button variant="ghost" size="xs" onClick={() => onOpenConnect(m.id)}>
              Configure
            </Button>
          ) : null}
          {view.custom ? (
            <Button variant="ghost" size="xs" onClick={() => onEdit(m.id)}>
              Edit
            </Button>
          ) : null}
          {on || (alert && envSet.length) ? (
            <Button variant="ghost" size="xs" onClick={runTest} loading={test.isPending}>
              Test
            </Button>
          ) : null}
          {on && readsMetrics(view) ? (
            <Button variant="ghost" size="xs" onClick={runSync} loading={sync.isPending}>
              ↻ Sync
            </Button>
          ) : null}
          <span className="flex-1" />
          {view.custom ? (
            <Menu
              trigger={
                <IconButton label={`More actions for ${m.name}`} size="sm">
                  ⋯
                </IconButton>
              }
              items={[
                { label: "Edit in builder", onSelect: () => onEdit(m.id) },
                { label: "Export manifest JSON", onSelect: () => void exportCustomPlugin(m.id).catch((e: unknown) => toast(errorMessage(e), { tone: "crit" })) },
                { label: "Delete plugin…", onSelect: () => onDelete(view), danger: true, separatorBefore: true },
              ]}
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
