"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { ErrorState, SkeletonLines } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/inputs";
import { Modal } from "@/components/ui/overlays";
import { Dot } from "@/components/ui/status";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import { useConnectPlugin, useDisconnectPlugin, usePluginDetail, useTestPlugin } from "@/lib/api/plugins-ui";
import type { PluginConfigField, PluginDetail, PluginManifest, PluginView } from "@/lib/domain/contracts/plugins";
import { errorMessage } from "./plugin-card";
import { CATEGORY_LABEL, isAlertPlugin } from "./plugin-meta";

// The prototype's connect modal, opened by ?connect=<id>. Secret fields are write-only: the API only ever returns a
// masked hint, a blank secret keeps the saved value, and without APP_ENCRYPTION_KEY secrets must live in .env.

interface ConnectModalProps {
  view: PluginView | null;
  encryption: boolean;
  onClose: () => void;
}

export function ConnectModal({ view, encryption, onClose }: ConnectModalProps) {
  const id = view?.manifest.id ?? null;
  const detail = usePluginDetail(id);
  const m = view?.manifest;
  return (
    <Modal
      open={!!view}
      onOpenChange={(o) => !o && onClose()}
      eyebrow={m ? `${view?.connected ? "Configure" : "Connect"} · ${CATEGORY_LABEL[m.category]}` : "Connect"}
      title={m?.name ?? "Plugin"}
      description={m?.description}
    >
      {view && detail.data ? (
        <ConnectForm key={view.manifest.id} view={view} detail={detail.data} encryption={encryption} onDone={onClose} />
      ) : detail.error ? (
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      ) : (
        <SkeletonLines lines={4} />
      )}
    </Modal>
  );
}

/** The .env variable that backs a config field (explicit, same label, or the n-th secret). */
function envKeyFor(field: PluginConfigField, m: PluginManifest): string | undefined {
  if (field.envKey) return field.envKey;
  const env = m.env ?? [];
  const same = env.find((e) => e.label.toLowerCase() === field.label.toLowerCase());
  if (same) return same.key;
  if (field.type !== "secret") return undefined;
  const i = (m.configFields ?? []).filter((f) => f.type === "secret").indexOf(field);
  return env.filter((e) => e.secret)[i]?.key;
}

function placeholderFor(f: PluginConfigField): string {
  if (f.placeholder) return f.placeholder;
  if (f.type === "url" || /url/i.test(f.label)) return "https://";
  if (f.type === "secret") return "••••••••";
  return "";
}

function ConnectForm({ view, detail, encryption, onDone }: { view: PluginView; detail: PluginDetail; encryption: boolean; onDone: () => void }) {
  const router = useRouter();
  const m = view.manifest;
  const fields = m.configFields ?? [];
  const alert = isAlertPlugin(view);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.filter((f) => f.type !== "secret").map((f) => [f.key, detail.config[f.key] ?? ""])));
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [cleared, setCleared] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<unknown>(null);
  const connect = useConnectPlugin();
  const disconnect = useDisconnectPlugin();
  const test = useTestPlugin();

  const payload = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const f of fields) {
      if (f.type === "secret") {
        const v = (secrets[f.key] ?? "").trim();
        if (v) out[f.key] = v;
        else if (cleared[f.key]) out[f.key] = "";
      } else {
        const v = (values[f.key] ?? "").trim();
        if (v !== (detail.config[f.key] ?? "")) out[f.key] = v;
      }
    }
    return out;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    connect.mutate(
      { id: m.id, values: payload() },
      {
        onSuccess: () => {
          toast(`${m.name} ${view.connected ? "saved" : "connected"}`, alert ? { action: { label: "Route alerts", onClick: () => router.push("/anomalies/notifications") } } : {});
          onDone();
        },
        onError: setError,
      },
    );
  };

  const secretsDisabled = error instanceof ApiError && error.code === "SECRETS_DISABLED";

  return (
    <form onSubmit={submit} className="flex flex-col gap-[18px]">
      {fields.map((f) => {
        const saved = detail.secrets[f.key];
        const envKey = envKeyFor(f, m);
        if (f.type === "secret") {
          const locked = !encryption;
          return (
            <Field
              key={f.key}
              label={f.label}
              aside={
                saved?.hasValue ? (
                  <span className="font-mono text-micro text-muted-3">
                    {cleared[f.key] ? "will be removed" : `saved · ${saved.masked ?? "••••"}${saved.source === "env" ? " · .env" : ""}`}
                  </span>
                ) : null
              }
              hint={
                locked
                  ? `Secrets can't be saved here until APP_ENCRYPTION_KEY is set (npm run gen:key)${envKey ? ` — or put ${envKey} in .env` : ""}.`
                  : saved?.hasValue
                    ? "Write-only. Leave blank to keep the saved value."
                    : "Write-only — encrypted on the server, never shown again."
              }
            >
              {(id) => (
                <div className="flex items-center gap-2">
                  <Input
                    id={id}
                    variant="field"
                    type="password"
                    autoComplete="new-password"
                    spellCheck={false}
                    disabled={locked}
                    value={secrets[f.key] ?? ""}
                    onChange={(e) => setSecrets((s) => ({ ...s, [f.key]: e.target.value }))}
                    placeholder={saved?.hasValue ? "Leave blank to keep" : placeholderFor(f)}
                    className="min-w-0 flex-1 disabled:opacity-60"
                  />
                  {saved?.hasValue && saved.source === "stored" && !alert ? (
                    <Button variant="link" className="text-xs" onClick={() => setCleared((c) => ({ ...c, [f.key]: !c[f.key] }))}>
                      {cleared[f.key] ? "Keep" : "Remove"}
                    </Button>
                  ) : null}
                </div>
              )}
            </Field>
          );
        }
        if (f.type === "boolean") {
          return (
            <label key={f.key} className="flex items-center gap-2.5 text-[13px]">
              <Checkbox checked={values[f.key] === "true"} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v ? "true" : "false" }))} ariaLabel={f.label} />
              {f.label}
            </label>
          );
        }
        return (
          <Field key={f.key} label={f.label} hint={envKey ? `Or set ${envKey} in .env.` : undefined}>
            {(id) =>
              f.type === "select" && f.options?.length ? (
                <Select id={id} value={values[f.key] ?? ""} onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}>
                  <option value="">—</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={id}
                  variant="field"
                  type={f.type === "number" ? "number" : f.type === "url" ? "url" : "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                  placeholder={placeholderFor(f)}
                  required={f.required && !alert}
                />
              )
            }
          </Field>
        );
      })}

      {view.envDetected.length ? (
        <div className="flex flex-col gap-1.5">
          <span className="label-mono">Detected in .env</span>
          {view.envDetected.map((e) => (
            <span key={e.key} className="flex items-center gap-2 font-mono text-meta">
              <Dot tone={e.set ? "accent" : "faint"} size={6} />
              <span className="min-w-0 flex-1 truncate">{e.key}</span>
              <span className={e.set ? "text-accent" : "text-faint"}>{e.set ? "✓ set" : "not set"}</span>
            </span>
          ))}
        </div>
      ) : null}

      <span className="text-xs leading-normal text-faint">
        {m.live
          ? alert
            ? "Critical anomalies and pacing warnings are sent here once a route targets this channel."
            : "Values are checked when you run Test."
          : "Demo connector — live connector not in v1. Leave empty to connect with demo data."}
      </span>

      {error ? (
        secretsDisabled ? (
          <div role="alert" className="flex items-start gap-3 rounded-mini border border-warn/30 bg-warn-t/40 p-4 text-[13px] leading-normal text-muted">
            <Dot tone="warn" className="mt-1.5" />
            <span>{(error as ApiError).message}</span>
          </div>
        ) : (
          <ErrorState error={error} />
        )
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2.5">
        {view.connected ? (
          <>
            {alert ? (
              <Button
                variant="ghost"
                loading={test.isPending}
                onClick={() => test.mutate(m.id, { onSuccess: (r) => toast(r.message, { tone: r.ok ? "default" : "crit", ms: 4000 }), onError: (e) => toast(errorMessage(e), { tone: "crit" }) })}
              >
                Send test
              </Button>
            ) : null}
            <Button
              variant="danger"
              loading={disconnect.isPending}
              onClick={() =>
                disconnect.mutate(m.id, {
                  onSuccess: () => {
                    toast(`${m.name} disconnected`);
                    onDone();
                  },
                  onError: setError,
                })
              }
            >
              Disconnect
            </Button>
          </>
        ) : null}
        <span className="flex-1" />
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="brand" loading={connect.isPending}>
          {view.connected ? "Save" : "Connect"}
        </Button>
      </div>
    </form>
  );
}
