import "server-only";
import type { AlertChannel, AlertChannelPlugin } from "@/lib/domain/contracts/alerts";
import type { PluginConnection, PluginDetail, PluginManifest, PluginView, SecretDescription } from "@/lib/domain/contracts/plugins";
import { authSecretRef, publicManifest } from "@/lib/domain/plugins/manifest";
import type { AccountInfo, Mode } from "@/lib/domain/types";
import { RESERVED_PLUGIN_IDS, STATIC_PLUGINS } from "@/plugins";
import { alertPluginChannel, channelView, isAlertPluginId, listChannels, pluginChannelId } from "../alerts/channels";
import { describeSecret, encryptSecret, resolveSecret, secretsEnabled, SecretsDisabledError } from "../crypto/secrets";
import { env } from "../env/config";
import { AppError } from "../http/errors";
import { log } from "../log";
import { guardedFetch } from "../net/guarded-fetch";
import { getStore, type StoredPlugin } from "../store";
import type { PluginContext, PluginRuntime } from "./define";
import { createRestPlugin } from "./rest-engine";

// Plugin registry + connection state. Built-ins and code plugins are static; no-code REST plugins are stored
// manifests compiled on demand. A plugin sees only the env keys its manifest declares. Alert plugins send
// through alert channels (their Plugins-page channel `plugin-<id>` or the .env channel).

/** Stored REST manifests keep their semantic version here (the record's own `version` is the store revision). */
export type StoredPluginRecord = StoredPlugin & { manifestVersion?: string };

export function manifestFromRecord(m: StoredPluginRecord): PluginManifest {
  const { createdAt: _c, updatedAt: _u, version: _v, manifestVersion, ...rest } = m as unknown as Record<string, unknown>;
  return { ...(rest as unknown as PluginManifest), version: typeof manifestVersion === "string" ? manifestVersion : "1.0.0" };
}

export async function allPlugins(): Promise<PluginRuntime[]> {
  const stored = (await getStore().plugins.list()) as StoredPluginRecord[];
  const custom = stored.flatMap((m) => {
    if (RESERVED_PLUGIN_IDS.has(m.id)) return [];
    try {
      return [createRestPlugin(manifestFromRecord(m), Number(m.version) || 1)];
    } catch (err) {
      log.warn("Skipping an invalid stored plugin", { id: m.id, error: err instanceof Error ? err.message : String(err) });
      return [];
    }
  });
  return [...STATIC_PLUGINS, ...custom];
}

export async function findPlugin(id: string): Promise<PluginRuntime | null> {
  const builtin = STATIC_PLUGINS.find((p) => p.manifest.id === id);
  if (builtin) return builtin;
  return (await allPlugins()).find((p) => p.manifest.id === id) ?? null;
}

export async function connections(): Promise<Map<string, PluginConnection>> {
  const list = await getStore().pluginConnections.list();
  return new Map(list.map((c) => [c.pluginId, c]));
}

function envSubset(manifest: PluginManifest): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const e of manifest.env ?? []) out[e.key] = env.get(e.key);
  return out;
}

function hasLiveCredentials(p: PluginRuntime, conn: PluginConnection | undefined): boolean {
  if (!p.manifest.live) return false;
  if (p.manifest.kind === "rest") return true;
  const fields = p.manifest.configFields ?? [];
  const required = fields.filter((f) => f.required);
  const fromConn = required.every((f) => conn?.configPlain[f.key] || conn?.secrets[f.key]);
  const fromEnv = (p.manifest.env ?? []).filter((e) => e.required).every((e) => env.has(e.key));
  return fromConn || fromEnv;
}

export function pluginMode(p: PluginRuntime, conn: PluginConnection | undefined): Mode {
  return hasLiveCredentials(p, conn) && (p.fetchMetrics || p.sendAlert) ? "live" : "demo";
}

export async function pluginContext(p: PluginRuntime, conn: PluginConnection | undefined, account: AccountInfo): Promise<PluginContext> {
  const config: Record<string, string> = { ...(conn?.configPlain ?? {}) };
  for (const [k, ref] of Object.entries(conn?.secrets ?? {})) {
    try {
      const v = resolveSecret(ref, `plugin-connections:${p.manifest.id}:${k}`);
      if (v) config[k] = v;
    } catch {
      /* key changed — the connect modal asks to re-enter */
    }
  }
  return { config, env: envSubset(p.manifest), fetch: guardedFetch, account, mode: pluginMode(p, conn), now: new Date() };
}

/** The channel an alert plugin effectively sends through: its enabled Plugins-page channel, else the .env one. */
function alertChannelFor(pluginId: AlertChannelPlugin, channels: readonly AlertChannel[]): AlertChannel | undefined {
  const own = channels.find((c) => c.id === pluginChannelId(pluginId));
  const fromEnv = channels.find((c) => c.origin === "env" && c.pluginId === pluginId);
  return own?.enabled ? own : (fromEnv ?? own);
}

function viewOf(p: PluginRuntime, conn: PluginConnection | undefined, channels: readonly AlertChannel[]): PluginView {
  const envDetected = (p.manifest.env ?? []).map((e) => ({ key: e.key, set: env.has(e.key) }));
  let connected = !!conn?.enabled;
  let mode: PluginView["mode"] = connected ? pluginMode(p, conn) : "off";
  let reason: string | undefined;
  if (p.manifest.capabilities.includes("alerts.send") && isAlertPluginId(p.manifest.id)) {
    // Alert plugins are connected when an enabled channel exists (Plugins page) or the .env webhook is set.
    const ch = alertChannelFor(p.manifest.id, channels);
    connected = !!ch?.enabled;
    mode = connected ? "live" : "off";
    if (connected && ch?.origin === "env") reason = `Configured in .env — alerts go to the “${ch.name}” channel.`;
  } else if (!p.manifest.live) {
    reason = envDetected.some((e) => e.set) ? "Credentials detected — the live connector isn't part of v1, so demo data is shown." : "Demo connector in v1 — build a live one with the custom plugin builder.";
  } else if (conn?.status === "error" && conn.lastTest && !conn.lastTest.ok) {
    reason = conn.lastTest.message;
  }
  return {
    manifest: publicManifest(p.manifest),
    connected,
    mode,
    status: conn?.status === "error" && connected ? "error" : connected ? "connected" : "available",
    reason,
    envDetected,
    lastTest: conn?.lastTest,
    custom: p.manifest.kind !== "builtin",
    ...(conn?.lastSyncAt ? { lastSyncAt: conn.lastSyncAt } : {}),
  };
}

export async function pluginViews(): Promise<PluginView[]> {
  const [plugins, conns, channels] = await Promise.all([allPlugins(), connections(), listChannels()]);
  return plugins.map((p) => viewOf(p, conns.get(p.manifest.id), channels));
}

export async function pluginView(id: string): Promise<PluginView | null> {
  const p = await findPlugin(id);
  if (!p) return null;
  const [conn, channels] = await Promise.all([getStore().pluginConnections.get(id), listChannels()]);
  return viewOf(p, conn ?? undefined, channels);
}

/** GET /api/plugins/[id]: the view plus plain config values and masked descriptions of configured secrets. */
export async function pluginDetail(id: string): Promise<PluginDetail | null> {
  const p = await findPlugin(id);
  if (!p) return null;
  const conn = (await getStore().pluginConnections.get(id)) ?? undefined;
  const view = (await pluginView(id)) as PluginView;
  const secrets: Record<string, SecretDescription> = {};
  for (const [k, ref] of Object.entries(conn?.secrets ?? {})) secrets[k] = describeSecret(ref, `plugin-connections:${id}:${k}`);
  const config: Record<string, string> = {};
  const secretKeys = new Set((p.manifest.configFields ?? []).filter((f) => f.type === "secret").map((f) => f.key));
  for (const [k, v] of Object.entries(conn?.configPlain ?? {})) if (!secretKeys.has(k)) config[k] = v;
  if (p.manifest.rest) {
    const ref = authSecretRef(p.manifest.rest.auth);
    if (ref) secrets.auth = describeSecret(ref, `plugins:${id}:auth`);
  }
  if (isAlertPluginId(id)) {
    const ch = await alertPluginChannel(id);
    if (ch) {
      const v = channelView(ch);
      secrets.url = v.url;
      if (ch.options.mention) config.mention = ch.options.mention;
      config.channelId = ch.id;
    }
  }
  return { ...view, config, secrets };
}

/** Connect (or update) a plugin. Secret fields are encrypted; plain fields stored as-is. */
export async function connectPlugin(pluginId: string, values: Record<string, string>): Promise<PluginConnection> {
  const p = await findPlugin(pluginId);
  if (!p) throw new AppError("NOT_FOUND", `Plugin ${pluginId} not found`);
  const store = getStore().pluginConnections;
  const prev = await store.get(pluginId);
  const configPlain: Record<string, string> = { ...(prev?.configPlain ?? {}) };
  const secrets: Record<string, { enc: string }> = { ...(prev?.secrets ?? {}) };
  for (const f of p.manifest.configFields ?? []) {
    const v = values[f.key];
    if (v === undefined) continue;
    if (v === "") {
      delete configPlain[f.key];
      delete secrets[f.key];
      continue;
    }
    if (f.type === "secret") {
      if (!secretsEnabled()) throw new SecretsDisabledError();
      secrets[f.key] = { enc: encryptSecret(v, `plugin-connections:${pluginId}:${f.key}`) };
    } else configPlain[f.key] = v.slice(0, 500);
  }
  const record = { id: pluginId, pluginId, enabled: true, status: "connected" as const, mode: "demo" as const, configPlain, secrets, lastTest: prev?.lastTest, lastSyncAt: prev?.lastSyncAt };
  const saved = await store.upsert(record);
  const mode = pluginMode(p, saved);
  return mode === saved.mode ? saved : store.update(pluginId, { mode });
}

/** Alert plugins: the connection only records "connected"; the URL lives in the plugin's alert channel. */
export async function markConnected(pluginId: string, mode: Mode): Promise<PluginConnection> {
  const store = getStore().pluginConnections;
  const prev = await store.get(pluginId);
  return store.upsert({ id: pluginId, pluginId, enabled: true, status: "connected", mode, configPlain: prev?.configPlain ?? {}, secrets: prev?.secrets ?? {}, lastTest: prev?.lastTest, lastSyncAt: prev?.lastSyncAt });
}

export async function disconnectPlugin(pluginId: string): Promise<void> {
  const store = getStore().pluginConnections;
  const prev = await store.get(pluginId);
  if (prev) await store.update(pluginId, { enabled: false, status: "disconnected" });
}

export async function recordTest(pluginId: string, result: { ok: boolean; message: string }): Promise<void> {
  const store = getStore().pluginConnections;
  const prev = await store.get(pluginId);
  const lastTest = { at: new Date().toISOString(), ok: result.ok, message: result.message.slice(0, 300) };
  if (prev) await store.update(pluginId, { lastTest, status: result.ok ? "connected" : prev.enabled ? "error" : prev.status });
}

export async function recordSync(pluginId: string): Promise<string> {
  const at = new Date().toISOString();
  const store = getStore().pluginConnections;
  if (await store.get(pluginId)) await store.update(pluginId, { lastSyncAt: at });
  return at;
}
