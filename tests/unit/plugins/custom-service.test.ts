import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSingletonsForTests } from "@/lib/server/cache";
import { resolveSecret } from "@/lib/server/crypto/secrets";
import { createCustomPlugin, deleteCustomPlugin, exportCustomPlugin, importCustomPlugin, listCustomPlugins, updateCustomPlugin } from "@/lib/server/plugins/custom";
import { findPlugin, pluginContext, pluginViews } from "@/lib/server/plugins/registry";
import { invalidateRestCache } from "@/lib/server/plugins/rest-engine";
import { getStore } from "@/lib/server/store";

const KEY = "a".repeat(64);
const account = { id: "4821193307", name: "Acme", currency: "USD", timezone: "America/New_York", isManager: false, mode: "demo" as const };
const range = { start: "2026-09-22", end: "2026-09-28" };

const manifest = (over: Record<string, unknown> = {}) => ({
  id: "custom-mock",
  name: "Mock",
  version: "2.1.0",
  kind: "rest",
  category: "ad_platform",
  description: "x",
  icon: { abbr: "MK" },
  capabilities: ["metrics.read"],
  live: true,
  rest: {
    baseUrl: "mock://platform",
    auth: { type: "api_key_header", header: "x-api-key" },
    report: { method: "GET", path: "/reports?date_from={start}&date_to={end}&page_size=50", rowsPath: "data.rows", dateFormat: "YYYY-MM-DD", pagination: { type: "cursor", param: "cursor", cursorPath: "paging.next" } },
    mapping: { date: "day", spend: "metrics.spend", conversions: "actions[action_type=purchase].value", campaign: "campaign.name" },
  },
  ...over,
});

async function fetchRows(id: string) {
  const p = await findPlugin(id);
  if (!p?.fetchMetrics) throw new Error("no plugin");
  const conn = (await getStore().pluginConnections.get(id)) ?? undefined;
  return p.fetchMetrics(range, await pluginContext(p, conn, account));
}

beforeEach(() => {
  resetSingletonsForTests("store:");
  invalidateRestCache();
});
afterEach(() => vi.unstubAllEnvs());

describe("custom REST plugins without APP_ENCRYPTION_KEY", () => {
  it("refuses to store a plaintext credential and suggests a PLUGIN_* env var", async () => {
    await expect(createCustomPlugin({ manifest: manifest(), secrets: { apiKey: "mock-key" } })).rejects.toMatchObject({ code: "SECRETS_DISABLED", details: { envKey: "PLUGIN_MOCK_KEY" } });
    expect(await listCustomPlugins()).toEqual([]);
  });

  it("registers with an env reference, auto-connects and keeps the semantic version", async () => {
    vi.stubEnv("PLUGIN_MOCK_KEY", "mock-key");
    const res = await createCustomPlugin({ manifest: manifest({ rest: { ...manifest().rest, auth: { type: "api_key_header", header: "x-api-key", secret: { env: "PLUGIN_MOCK_KEY" } } } }) });
    expect(res.created).toBe(true);
    expect(res.plugin.manifest.version).toBe("2.1.0");
    expect(res.plugin.secrets.auth).toEqual({ hasValue: true, masked: "••••-key", source: "env" });
    const view = (await pluginViews()).find((v) => v.manifest.id === "custom-mock");
    expect(view).toMatchObject({ connected: true, mode: "live", status: "connected", custom: true });
    expect(await fetchRows("custom-mock")).toHaveLength(14);
    await expect(createCustomPlugin({ manifest: manifest() })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses ciphertext supplied by a client", async () => {
    await expect(createCustomPlugin({ manifest: manifest({ rest: { ...manifest().rest, auth: { type: "api_key_header", header: "x-api-key", secret: { enc: "v1:x:y:z:w" } } } }) })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("custom REST plugins with APP_ENCRYPTION_KEY", () => {
  beforeEach(() => vi.stubEnv("APP_ENCRYPTION_KEY", KEY));

  it("encrypts the credential bound to the plugin id and never returns it", async () => {
    const res = await createCustomPlugin({ manifest: manifest(), secrets: { apiKey: "mock-key" } });
    const stored = (await getStore().plugins.get("custom-mock")) as unknown as { rest: { auth: { secret: { enc: string } } } };
    expect(stored.rest.auth.secret.enc).toMatch(/^v1:/);
    expect(JSON.stringify(res)).not.toContain("mock-key");
    expect(JSON.stringify(res)).not.toContain(stored.rest.auth.secret.enc);
    expect(res.plugin.secrets.auth).toEqual({ hasValue: true, masked: "••••-key", source: "stored" });
    expect(await fetchRows("custom-mock")).toHaveLength(14);
    // AAD binds the ciphertext to this plugin: another id can't use it
    expect(() => resolveSecret({ enc: stored.rest.auth.secret.enc }, "plugins:custom-other:auth")).toThrow();
    expect(JSON.stringify(await pluginViews())).not.toContain(stored.rest.auth.secret.enc);
  });

  it("keeps the saved credential on edits, clears it when the host changes", async () => {
    const created = await createCustomPlugin({ manifest: manifest(), secrets: { apiKey: "mock-key" } });
    const edited = await updateCustomPlugin("custom-mock", { manifest: { ...created.plugin.manifest, name: "Mock v2" }, version: created.plugin.recordVersion });
    expect(edited.plugin.manifest.name).toBe("Mock v2");
    expect(edited.plugin.secrets.auth?.hasValue).toBe(true);
    invalidateRestCache();
    expect(await fetchRows("custom-mock")).toHaveLength(14);
    await expect(updateCustomPlugin("custom-mock", { manifest: edited.plugin.manifest, version: 1 })).rejects.toMatchObject({ code: "CONFLICT" });
    const moved = await updateCustomPlugin("custom-mock", { manifest: { ...edited.plugin.manifest, rest: { ...edited.plugin.manifest.rest, baseUrl: "https://api.example.com" } } });
    expect(moved.warnings).toContain("The base URL's host changed, so the saved credential was cleared — enter it again.");
    expect(moved.plugin.secrets.auth).toBeUndefined();
    await expect(updateCustomPlugin("custom-mock", { manifest: { ...moved.plugin.manifest, id: "custom-renamed" } })).resolves.toMatchObject({ plugin: { manifest: { id: "custom-mock" } } });
  });

  it("exports without credentials and imports as a copy or a replacement", async () => {
    await createCustomPlugin({ manifest: manifest(), secrets: { apiKey: "mock-key" } });
    const file = await exportCustomPlugin("custom-mock");
    expect(file.kind).toBe("savd.plugin");
    expect(JSON.stringify(file)).not.toMatch(/"enc"/);
    const copy = await importCustomPlugin({ manifest: file });
    expect(copy.plugin.manifest.id).toBe("custom-mock-2");
    expect(copy.plugin.manifest.name).toBe("Mock (copy)");
    const replaced = await importCustomPlugin({ manifest: { ...file, manifest: { ...file.manifest, name: "Replaced" } }, replace: true });
    expect(replaced).toMatchObject({ created: false, plugin: { manifest: { id: "custom-mock", name: "Replaced" } } });
    expect((await listCustomPlugins()).map((p) => p.manifest.id)).toEqual(["custom-mock", "custom-mock-2"]);
  });

  it("deletes the manifest and its connection", async () => {
    await createCustomPlugin({ manifest: manifest(), secrets: { apiKey: "mock-key" } });
    await deleteCustomPlugin("custom-mock");
    expect(await findPlugin("custom-mock")).toBeNull();
    expect(await getStore().pluginConnections.get("custom-mock")).toBeNull();
    await expect(deleteCustomPlugin("custom-mock")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
