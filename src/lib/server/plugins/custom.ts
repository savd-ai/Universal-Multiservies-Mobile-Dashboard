import "server-only";
import type {
  CustomPluginBody,
  CustomPluginRecord,
  ManifestIssue,
  ManifestValidationResult,
  PluginManifest,
  PluginPreviewResult,
  PluginSecretsInput,
  RestAuth,
  SecretDescription,
} from "@/lib/domain/contracts/plugins";
import { addDays } from "@/lib/domain/dates";
import { authSecretKey, authSecretRef, EXPORT_KIND, publicManifest, toValidationResult, validateCustomManifest, withAuthSecret } from "@/lib/domain/plugins/manifest";
import { RESERVED_PLUGIN_IDS } from "@/plugins";
import type { RequestContext } from "../context";
import { describeSecret, encryptSecret, secretsEnabled } from "../crypto/secrets";
import { env } from "../env/config";
import { AppError, conflict, notFound } from "../http/errors";
import { allowPrivateNetwork, assertSafeUrl } from "../net/ssrf";
import { invalidateQueryCache } from "../query/service";
import { getStore } from "../store";
import { manifestFromRecord, pluginContext, type StoredPluginRecord } from "./registry";
import { createRestPlugin, invalidateRestCache } from "./rest-engine";

// No-code REST plugins built in the Plugins page: validate → encrypt the credential (AAD `plugins:<id>:auth`) →
// store the manifest → auto-connect. Credentials are bound to the base URL's origin: changing the host clears a
// saved one, and preview only reuses a saved one for the same origin. Client-supplied {enc} blobs are refused.

const MAX_CUSTOM_PLUGINS = 30;
const authAad = (id: string) => `plugins:${id}:auth`;
type SecretRefLike = { enc: string } | { env: string };

const allowHttp = () => env.bool("PLUGINS_ALLOW_HTTP") || allowPrivateNetwork();

function originOf(u: string | undefined): string | null {
  try {
    return u ? new URL(u).origin : null;
  } catch {
    return null;
  }
}

/** Suggested env var for users without APP_ENCRYPTION_KEY: custom-klaviyo → PLUGIN_KLAVIYO_KEY. */
export const suggestedEnvKey = (id: string) => `PLUGIN_${id.replace(/^custom-/, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 50)}_KEY`;

function secretsDisabled(id: string): AppError {
  const key = suggestedEnvKey(id);
  return new AppError("SECRETS_DISABLED", `APP_ENCRYPTION_KEY is not set, so this credential can't be saved from the UI. Put it in .env as ${key}=… and reference it in the auth settings as {"env":"${key}"} (or generate a key with npm run gen:key).`, { envKey: key });
}

/** Domain validation + server checks (SSRF on the base URL, env references, unused secrets). */
export function validateRequestManifest(input: unknown, opts: { secrets?: PluginSecretsInput; accountCurrency?: string } = {}): { manifest: PluginManifest | null; issues: ManifestIssue[] } {
  const hasTransientSecret = !!opts.secrets && Object.values(opts.secrets).some((v) => !!v);
  const v = validateCustomManifest(input, { allowHttp: allowHttp(), reservedIds: RESERVED_PLUGIN_IDS, hasTransientSecret, accountCurrency: opts.accountCurrency });
  const spec = v.manifest?.rest;
  if (!spec) return v;
  if (!spec.baseUrl.startsWith("mock://") && !v.issues.some((i) => i.level === "error" && i.path === "rest.baseUrl")) {
    try {
      assertSafeUrl(spec.baseUrl);
    } catch (err) {
      v.issues.push({ level: "error", path: "rest.baseUrl", message: err instanceof Error ? err.message : "Blocked URL" });
    }
  }
  const ref = authSecretRef(spec.auth);
  if (ref && "env" in ref && !env.has(ref.env)) v.issues.push({ level: "warning", path: "rest.auth", message: `${ref.env} is not set in the server environment yet — requests will fail until it is.` });
  const used = authSecretKey(spec.auth);
  for (const [k, val] of Object.entries(opts.secrets ?? {})) {
    if (val && k !== used) v.issues.push({ level: "warning", path: `secrets.${k}`, message: `Not used by auth type "${spec.auth.type}".` });
  }
  return v;
}

function assertValid(v: { manifest: PluginManifest | null; issues: ManifestIssue[] }): { manifest: PluginManifest; result: ManifestValidationResult } {
  const result = toValidationResult(v);
  if (!result.ok || !v.manifest) throw new AppError("VALIDATION_ERROR", result.errors[0] ? `The manifest has errors — ${result.errors[0]}` : "The manifest is invalid", result);
  return { manifest: v.manifest, result };
}

/** Decide the stored credential reference for a save. */
function applySecrets(m: PluginManifest, secrets: PluginSecretsInput | undefined, prev: { ref?: SecretRefLike; originChanged: boolean } | null, warnings: string[]): PluginManifest {
  const spec = m.rest as NonNullable<PluginManifest["rest"]>;
  const key = authSecretKey(spec.auth);
  if (!key) return m;
  const provided = secrets?.[key];
  const incoming = authSecretRef(spec.auth);
  let ref: SecretRefLike | undefined;
  if (provided) {
    if (!secretsEnabled()) throw secretsDisabled(m.id);
    ref = { enc: encryptSecret(provided, authAad(m.id)) };
  } else if (provided === "") ref = undefined;
  else if (incoming) ref = incoming;
  else if (prev?.ref && !prev.originChanged) ref = prev.ref;
  else if (prev?.ref && prev.originChanged) warnings.push("The base URL's host changed, so the saved credential was cleared — enter it again.");
  return { ...m, rest: { ...spec, auth: withAuthSecret(spec.auth, ref) as RestAuth } };
}

type NewStored = Parameters<ReturnType<typeof getStore>["plugins"]["create"]>[0];

function toStored(m: PluginManifest): NewStored {
  const { version, ...rest } = m;
  return { ...rest, manifestVersion: version } as unknown as NewStored;
}

export function toCustomRecord(rec: StoredPluginRecord): CustomPluginRecord {
  const m = manifestFromRecord(rec);
  const secrets: Record<string, SecretDescription> = {};
  const ref = m.rest ? authSecretRef(m.rest.auth) : undefined;
  if (ref) secrets.auth = describeSecret(ref, authAad(m.id));
  return { manifest: publicManifest(m), recordVersion: Number(rec.version) || 1, createdAt: rec.createdAt, updatedAt: rec.updatedAt, secrets };
}

async function stored(id: string): Promise<StoredPluginRecord | null> {
  return (await getStore().plugins.get(id)) as StoredPluginRecord | null;
}

function invalidate(id: string): void {
  invalidateRestCache(id);
  invalidateQueryCache();
}

export async function listCustomPlugins(): Promise<CustomPluginRecord[]> {
  const all = (await getStore().plugins.list()) as StoredPluginRecord[];
  return all.filter((p) => !RESERVED_PLUGIN_IDS.has(p.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(toCustomRecord);
}

export async function getCustomPlugin(id: string): Promise<CustomPluginRecord> {
  const rec = await stored(id);
  if (!rec) throw notFound("Custom plugin");
  return toCustomRecord(rec);
}

export interface SaveResult {
  plugin: CustomPluginRecord;
  warnings: string[];
  created: boolean;
}

export async function createCustomPlugin(body: CustomPluginBody, opts: { accountCurrency?: string } = {}): Promise<SaveResult> {
  const { manifest, result } = assertValid(validateRequestManifest(body.manifest, { secrets: body.secrets, accountCurrency: opts.accountCurrency }));
  const store = getStore();
  if (await store.plugins.get(manifest.id)) throw conflict(`A custom plugin with id "${manifest.id}" already exists — update it instead.`, { id: manifest.id });
  if ((await store.plugins.list()).length >= MAX_CUSTOM_PLUGINS) throw conflict(`At most ${MAX_CUSTOM_PLUGINS} custom plugins — delete one first.`);
  const warnings = [...result.warnings];
  const withSecret = applySecrets(manifest, body.secrets, null, warnings);
  const rec = (await store.plugins.create(toStored(withSecret))) as StoredPluginRecord;
  await store.pluginConnections.upsert({ id: manifest.id, pluginId: manifest.id, enabled: true, status: "connected", mode: "live", configPlain: {}, secrets: {} });
  invalidate(manifest.id);
  return { plugin: toCustomRecord(rec), warnings, created: true };
}

export async function updateCustomPlugin(id: string, body: CustomPluginBody, opts: { accountCurrency?: string } = {}): Promise<SaveResult> {
  const prev = await stored(id);
  if (!prev) throw notFound("Custom plugin");
  const input = body.manifest && typeof body.manifest === "object" && !Array.isArray(body.manifest) ? { ...(body.manifest as Record<string, unknown>), id } : body.manifest;
  const { manifest, result } = assertValid(validateRequestManifest(input, { secrets: body.secrets, accountCurrency: opts.accountCurrency }));
  if (manifest.id !== id) throw new AppError("VALIDATION_ERROR", "A plugin's id can't be changed — export it and import a copy instead.");
  const prevManifest = manifestFromRecord(prev);
  const warnings = [...result.warnings];
  const withSecret = applySecrets(
    manifest,
    body.secrets,
    { ref: prevManifest.rest ? authSecretRef(prevManifest.rest.auth) : undefined, originChanged: originOf(prevManifest.rest?.baseUrl) !== originOf(manifest.rest?.baseUrl) },
    warnings,
  );
  const next = toStored(withSecret) as unknown as StoredPluginRecord;
  const rec = (await getStore().plugins.update(id, (p) => ({ ...next, id, createdAt: p.createdAt, updatedAt: p.updatedAt, version: p.version }), { expectedVersion: body.version })) as StoredPluginRecord;
  invalidate(id);
  return { plugin: toCustomRecord(rec), warnings, created: false };
}

export async function deleteCustomPlugin(id: string): Promise<void> {
  const store = getStore();
  if (!(await store.plugins.delete(id))) throw notFound("Custom plugin");
  await store.pluginConnections.delete(id);
  invalidate(id);
}

/** Portable manifest file (credentials never included; env references are names and are kept). */
export async function exportCustomPlugin(id: string): Promise<{ kind: typeof EXPORT_KIND; schemaVersion: 1; exportedAt: string; manifest: PluginManifest }> {
  const rec = await stored(id);
  if (!rec) throw notFound("Custom plugin");
  return { kind: EXPORT_KIND, schemaVersion: 1, exportedAt: new Date().toISOString(), manifest: publicManifest(manifestFromRecord(rec)) };
}

/** Import an exported manifest: replaces the same id with `replace`, otherwise imports a copy under a free id. */
export async function importCustomPlugin(body: CustomPluginBody, opts: { accountCurrency?: string } = {}): Promise<SaveResult> {
  const { manifest } = assertValid(validateRequestManifest(body.manifest, { secrets: body.secrets, accountCurrency: opts.accountCurrency }));
  const existing = await stored(manifest.id);
  if (existing && body.replace) return updateCustomPlugin(manifest.id, { ...body, manifest, version: undefined }, opts);
  if (!existing) return createCustomPlugin({ ...body, manifest }, opts);
  let n = 2;
  let id = `${manifest.id.slice(0, 38)}-${n}`;
  while ((await stored(id)) || RESERVED_PLUGIN_IDS.has(id)) id = `${manifest.id.slice(0, 38)}-${++n}`;
  const res = await createCustomPlugin({ ...body, manifest: { ...manifest, id, name: `${manifest.name} (copy)`.slice(0, 60) } }, opts);
  return { ...res, warnings: [`"${manifest.id}" already exists — imported as "${id}".`, ...res.warnings] };
}

/** Run a manifest against its endpoint over the last 7 complete days with transient credentials (never stored). */
export async function previewCustomPlugin(body: CustomPluginBody, ctx: RequestContext): Promise<PluginPreviewResult> {
  const { manifest, result } = assertValid(validateRequestManifest(body.manifest, { secrets: body.secrets, accountCurrency: ctx.account.currency }));
  let m = manifest;
  const spec = m.rest as NonNullable<PluginManifest["rest"]>;
  const key = authSecretKey(spec.auth);
  const transient = key ? body.secrets?.[key] : undefined;
  const config: Record<string, string> = {};
  if (key && transient) {
    m = { ...m, rest: { ...spec, auth: withAuthSecret(spec.auth, undefined) as RestAuth } };
    config[key] = transient;
  } else if (key && !authSecretRef(spec.auth)) {
    // Editing a saved plugin: reuse its stored credential only while the base URL's origin is unchanged.
    const prev = await stored(m.id);
    const pm = prev ? manifestFromRecord(prev) : null;
    const ref = pm?.rest ? authSecretRef(pm.rest.auth) : undefined;
    if (ref && originOf(pm?.rest?.baseUrl) === originOf(spec.baseUrl)) m = { ...m, rest: { ...spec, auth: withAuthSecret(spec.auth, ref) as RestAuth } };
  }
  const plugin = createRestPlugin(m, 0);
  const end = addDays(ctx.today, -1);
  const base = await pluginContext(plugin, undefined, ctx.account);
  const preview = await (plugin.preview as NonNullable<typeof plugin.preview>)({ start: addDays(end, -6), end }, { ...base, config: { ...base.config, ...config } });
  return { ...preview, manifestWarnings: result.warnings };
}
