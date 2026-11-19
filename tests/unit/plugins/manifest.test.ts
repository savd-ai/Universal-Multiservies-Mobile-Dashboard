import { describe, expect, it } from "vitest";
import { fromPrototypeManifest } from "@/lib/domain/contracts/plugins";
import { customPluginId, EXPORT_KIND, normalizeManifestInput, publicManifest, toValidationResult, validateCustomManifest } from "@/lib/domain/plugins/manifest";

const reservedIds = new Set(["meta", "slack", "custom-taken"]);
const opts = { allowHttp: false, reservedIds };

const mock = () => ({
  id: "custom-mock",
  name: "Mock",
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
    mapping: { date: "day", spend: "metrics.spend", clicks: "metrics.clicks", impressions: "metrics.impressions", conversions: "actions[action_type=purchase].value", campaign: "campaign.name" },
  },
});

const check = (input: unknown, o: Partial<Parameters<typeof validateCustomManifest>[1]> = {}) => toValidationResult(validateCustomManifest(input, { ...opts, ...o }));
type Loose = Record<string, unknown> & { rest: Record<string, unknown> & { report: Record<string, unknown>; auth: Record<string, unknown>; mapping: Record<string, unknown> } };
const withRest = (patch: (m: Loose) => void) => {
  const m = mock() as unknown as Loose;
  patch(m);
  return m;
};

describe("custom REST manifest validation", () => {
  it("accepts the documented mock manifest (warning only about the missing credential)", () => {
    const r = check(mock());
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.manifest?.id).toBe("custom-mock");
    expect(r.warnings).toEqual(["rest.auth: No credential is set — requests will be sent without one."]);
    expect(check(mock(), { hasTransientSecret: true }).warnings).toEqual([]);
  });

  it("prefixes ids, forces kind/live/capabilities and fills defaults", () => {
    const r = check({ name: "Klaviyo Ads", kind: "code", live: false, capabilities: ["alerts.send"], rest: mock().rest });
    expect(r.ok).toBe(true);
    expect(r.manifest).toMatchObject({ id: "custom-klaviyo-ads", kind: "rest", live: true, capabilities: ["metrics.read"], icon: { abbr: "KL" }, description: "Custom REST plugin · platform" });
    expect(r.warnings.join(" ")).toMatch(/kind set to "rest"/);
    expect(customPluginId("Custom-Foo!!", "x")).toBe("custom-foo");
    expect(customPluginId(undefined, "A".repeat(80)).length).toBeLessThanOrEqual(41);
  });

  it("only allows PLUGIN_* env references and refuses client-supplied ciphertext", () => {
    const env = check(withRest((m) => (m.rest.auth.secret = { env: "GOOGLE_ADS_REFRESH_TOKEN" })));
    expect(env.ok).toBe(false);
    expect(env.errors).toContain("rest.auth.secret.env: Only PLUGIN_* environment variables can be referenced by custom plugins (least privilege)");
    expect(check(withRest((m) => (m.rest.auth.secret = { env: "PLUGIN_MOCK_KEY" }))).ok).toBe(true);
    const enc = check(withRest((m) => (m.rest.auth.secret = { enc: "v1:abcd:x:y:z" })));
    expect(enc.ok).toBe(false);
    expect(enc.errors[0]).toMatch(/Encrypted credentials can't be supplied/);
    expect(check({ ...mock(), env: [{ key: "OPENAI_API_KEY", label: "k", secret: true, required: true }] }).errors.join(" ")).toMatch(/only declare PLUGIN_\*/);
  });

  it("enforces base URL, path, template, header and pagination rules — all at once", () => {
    const r = check(
      withRest((m) => {
        m.rest.baseUrl = "http://api.example.com";
        m.rest.headers = { Authorization: "Bearer x", Host: "evil", "X-Ok": "1", "X-Crlf": "a\r\nb" };
        m.rest.report.path = "//evil.example/x?from={start}&q={nope}";
        m.rest.report.pagination = { type: "cursor" };
        m.rest.report.rowsPath = "data[";
        m.rest.mapping.spend = { expr: "cost *" };
      }),
    );
    expect(r.ok).toBe(false);
    const text = r.errors.join("\n");
    expect(text).toMatch(/rest.baseUrl: Only https:\/\//);
    expect(text).toMatch(/rest.report.path: The path must be relative/);
    expect(text).toMatch(/Unknown template variable \{nope\}/);
    expect(text).toMatch(/rest.headers.Authorization: Put credentials in the auth settings/);
    expect(text).toMatch(/rest.headers.Host: The Host header is set by the server/);
    expect(text).toMatch(/rest.headers.X-Crlf: Header values can't contain line breaks/);
    expect(text).not.toMatch(/X-Ok/);
    expect(text).toMatch(/pagination.param/);
    expect(text).toMatch(/cursorPath/);
    expect(text).toMatch(/rest.report.rowsPath: Unclosed/);
    expect(text).toMatch(/rest.mapping.spend: .*at character/);
    expect(check(withRest((m) => (m.rest.baseUrl = "http://api.example.com")), { allowHttp: true }).warnings.join(" ")).toMatch(/Plain http/);
  });

  it("rejects credentials in URLs, other mock hosts, reserved ids and alert categories", () => {
    expect(check(withRest((m) => (m.rest.baseUrl = "https://u:p@api.example.com"))).errors.join(" ")).toMatch(/Credentials in URLs/);
    expect(check(withRest((m) => (m.rest.baseUrl = "https://api.example.com/v1?key=abc"))).errors.join(" ")).toMatch(/can't carry a query string/);
    expect(check(withRest((m) => (m.rest.report.path = "/r?from={start}&api_key=sk_live_123"))).errors.join(" ")).toMatch(/"api_key" looks like a credential/);
    expect(check({ ...withRest((m) => (m.rest.report.path = "/r?from={start}&api_key={config.key}")), configFields: [{ key: "key", label: "Key", type: "secret" }] }).ok).toBe(true);
    expect(check(withRest((m) => ((m.rest.report.method = "POST"), (m.rest.report.body = '{"token":"abc123","from":"{start}"}')))).warnings.join(" ")).toMatch(/literal credential/);
    expect(check(withRest((m) => (m.rest.baseUrl = "mock://elsewhere"))).errors.join(" ")).toMatch(/mock:\/\/platform/);
    expect(check({ ...mock(), id: "custom-taken" }).errors.join(" ")).toMatch(/reserved/);
    expect(check({ ...mock(), category: "alerts" }).errors.join(" ")).toMatch(/Webhook alert channel/);
    expect(check(withRest((m) => (m.rest.report.path = "/r?acct={config.account}"))).errors.join(" ")).toMatch(/Unknown template variable \{config.account\}/);
    expect(check({ ...withRest((m) => (m.rest.report.path = "/r?acct={config.account}")), configFields: [{ key: "account", label: "Account", type: "text" }] }).ok).toBe(true);
  });
});

describe("prototype builder formats", () => {
  it("converts the builder's flat form state", () => {
    const r = check({ name: "Klaviyo", url: "https://a.klaviyo.com/api", auth: "API key", spend: "metrics.spend", conv: "metrics.placed_order", cat: "Ad platform" });
    expect(r.ok).toBe(true);
    expect(r.manifest).toMatchObject({
      id: "custom-klaviyo",
      kind: "rest",
      category: "ad_platform",
      rest: { baseUrl: "https://a.klaviyo.com/api", auth: { type: "api_key_header", header: "Authorization" }, report: { path: "/reports?date_from={start}&date_to={end}", rowsPath: "data.rows" }, mapping: { date: "date", spend: "metrics.spend", conversions: "metrics.placed_order" } },
    });
    expect(r.warnings.join(" ")).toMatch(/prototype builder format/);
  });

  it("converts the builder's manifest preview and maps auth labels", () => {
    const preview = { id: "tiktok-custom", name: "TikTok (custom)", version: "1.0.0", category: "Analytics", source: { baseUrl: "https://api.example.com", auth: "Bearer token", report: "/r?from={start}&to={end}" }, mapping: { date: "date", spend: "cost", conversions: "conv", currency: "USD" }, capabilities: ["metrics.read"], refresh: "daily" };
    const m = fromPrototypeManifest(preview);
    expect(m).toMatchObject({ id: "custom-tiktok-custom", category: "analytics", refresh: "daily", rest: { auth: { type: "bearer" }, mapping: { currency: "USD" } } });
    expect(fromPrototypeManifest({ name: "x", source: { auth: "None" } }).rest?.auth).toEqual({ type: "none" });
    expect(fromPrototypeManifest({ name: "x", source: { auth: "Basic auth" } }).rest?.auth).toEqual({ type: "basic", username: "" });
    expect(check({ name: "Pager", cat: "Alerts", url: "https://x.example.com" }).errors.join(" ")).toMatch(/Webhook alert channel/);
  });

  it("unwraps exported files and reports shape errors", () => {
    expect(normalizeManifestInput({ kind: EXPORT_KIND, schemaVersion: 1, manifest: mock() }).candidate?.id).toBe("custom-mock");
    expect(check("nope").errors).toEqual(["The manifest must be a JSON object"]);
    expect(check({ name: "", url: "https://x" }).errors).toEqual(["name: Service name is required"]);
  });
});

describe("publicManifest", () => {
  it("strips encrypted credentials but keeps env references", () => {
    const parsed = check(withRest((m) => (m.rest.auth.secret = { env: "PLUGIN_MOCK_KEY" }))).manifest;
    if (!parsed?.rest || parsed.rest.auth.type !== "api_key_header") throw new Error("expected api_key_header auth");
    expect(publicManifest(parsed).rest?.auth).toEqual({ type: "api_key_header", header: "x-api-key", secret: { env: "PLUGIN_MOCK_KEY" } });
    const encrypted = { ...parsed, rest: { ...parsed.rest, auth: { ...parsed.rest.auth, secret: { enc: "v1:k:iv:tag:ct" } } } };
    expect(publicManifest(encrypted).rest?.auth).toEqual({ type: "api_key_header", header: "x-api-key" });
  });
});
