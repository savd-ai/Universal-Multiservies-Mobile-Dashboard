import { describe, expect, it } from "vitest";
import {
  authSpec,
  blankForm,
  fieldRefOf,
  formFromBuiltin,
  formIssues,
  formSecrets,
  formToManifest,
  issueStep,
  KLAVIYO_MOCK_KEY,
  klaviyoMockForm,
  manifestToForm,
  parseManifestText,
  pluginIdFor,
  suggestEnvKey,
  type BuilderForm,
} from "@/features/plugins/builder-model";
import { fromPrototypeManifest, type PluginManifest } from "@/lib/domain/contracts/plugins";
import { getPath } from "@/lib/domain/plugins/dot-path";
import { normalizeManifestInput, toValidationResult, validateCustomManifest } from "@/lib/domain/plugins/manifest";
import { mapRows } from "@/lib/domain/plugins/mapping";
import { mockPlatformHandle } from "@/lib/server/plugins/mock-platform";

const reservedIds = new Set(["meta", "ga4", "shopify", "slack", "webhook"]);
const validate = (m: unknown, hasTransientSecret = false) => toValidationResult(validateCustomManifest(m, { allowHttp: false, reservedIds, hasTransientSecret }));

const withForm = (patch: (f: BuilderForm) => void): BuilderForm => {
  const f = structuredClone(klaviyoMockForm());
  patch(f);
  return f;
};

describe("builder presets", () => {
  it("Klaviyo-style (mock) produces a manifest the server accepts without errors or warnings", () => {
    const m = formToManifest(klaviyoMockForm());
    expect(m.id).toBe("custom-klaviyo");
    expect(m.rest?.baseUrl).toBe("mock://platform");
    expect(m.rest?.auth).toEqual({ type: "api_key_header", header: "x-api-key" });
    expect(m.rest?.report.pagination).toEqual({ type: "cursor", param: "cursor", cursorPath: "paging.next" });
    expect(m.rest?.mapping.conversions).toBe("metrics.placed_order");
    const r = validate(m, true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("the Klaviyo preset maps the mock platform's response into daily rows", () => {
    const m = formToManifest(klaviyoMockForm());
    const spec = m.rest as NonNullable<PluginManifest["rest"]>;
    const res = mockPlatformHandle("/reports?date_from=2026-09-22&date_to=2026-09-28&page_size=50", new Headers({ "x-api-key": KLAVIYO_MOCK_KEY }));
    expect(res.status).toBe(200);
    const items = getPath(res.body, spec.report.rowsPath) as unknown[];
    const mapped = mapRows(items, spec, { accountId: "a1", platform: m.id, accountCurrency: "USD", range: { start: "2026-09-22", end: "2026-09-28" }, fx: (v) => v });
    expect(mapped.warnings).toEqual([]);
    expect(mapped.rows).toHaveLength(14);
    expect(new Set(mapped.rows.map((r) => r.platform_campaign))).toEqual(new Set(["Spring launch", "Retargeting"]));
    expect(mapped.rows.every((r) => r.cost > 0 && r.clicks > 0 && r.impressions > 0)).toBe(true);
    expect(mapped.rows.some((r) => r.conv_value > 0)).toBe(true);
  });

  it("the blank preset flags what is missing before any round trip", () => {
    const issues = formIssues(blankForm());
    expect(issues.filter((i) => i.level === "error").map((i) => i.path)).toEqual(["name", "rest.baseUrl"]);
    expect(formIssues(klaviyoMockForm())).toEqual([]);
    const noDate = withForm((f) => (f.mappings = f.mappings.filter((r) => r.target !== "date")));
    expect(formIssues(noDate).map((i) => i.path)).toContain("rest.mapping.date");
    const noSpend = withForm((f) => (f.mappings = f.mappings.filter((r) => r.target !== "spend")));
    expect(formIssues(noSpend)).toEqual([{ level: "warning", path: "rest.mapping.spend", message: expect.any(String) }]);
    const badEnv = withForm((f) => (f.auth = { ...f.auth, source: "env", env: "SLACK_WEBHOOK_URL" }));
    expect(formIssues(badEnv).map((i) => i.path)).toEqual(["rest.auth"]);
  });

  it("a demo-only built-in seeds a live connector with its identity and category defaults", () => {
    const f = formFromBuiltin({ name: "Shopify", category: "commerce", icon: { abbr: "SH" } });
    expect(f.category).toBe("commerce");
    expect(f.abbr).toBe("SH");
    expect(f.mappings.map((r) => r.target)).toEqual(["date", "storeRevenue", "orders"]);
    expect(pluginIdFor(f)).toBe("custom-shopify");
    expect(formFromBuiltin({ name: "Google Sheets", category: "export", icon: { abbr: "GS" } }).category).toBe("ad_platform");
  });
});

describe("form → manifest", () => {
  it("builds each auth type, with PLUGIN_* env references in the right slot", () => {
    const f = (type: BuilderForm["auth"]["type"], source: BuilderForm["auth"]["source"] = "value") => withForm((x) => (x.auth = { ...x.auth, type, source, env: "PLUGIN_ACME_KEY", username: " me " }));
    expect(authSpec(f("none"))).toEqual({ type: "none" });
    expect(authSpec(f("api_key_header", "env"))).toEqual({ type: "api_key_header", header: "x-api-key", secret: { env: "PLUGIN_ACME_KEY" } });
    expect(authSpec(f("api_key_query"))).toEqual({ type: "api_key_query", param: "api_key" });
    expect(authSpec(f("bearer", "env"))).toEqual({ type: "bearer", secret: { env: "PLUGIN_ACME_KEY" } });
    expect(authSpec(f("basic", "env"))).toEqual({ type: "basic", username: "me", password: { env: "PLUGIN_ACME_KEY" } });
    expect(authSpec(f("bearer", "saved"))).toEqual({ type: "bearer" });
  });

  it("sends the typed credential under the key the auth type consumes (write-only, never in the manifest)", () => {
    const f = (type: BuilderForm["auth"]["type"], source: BuilderForm["auth"]["source"] = "value") => withForm((x) => (x.auth = { ...x.auth, type, source }));
    expect(formSecrets(f("api_key_header"), "k")).toEqual({ apiKey: "k" });
    expect(formSecrets(f("api_key_query"), "k")).toEqual({ apiKey: "k" });
    expect(formSecrets(f("bearer"), "t")).toEqual({ token: "t" });
    expect(formSecrets(f("basic"), "p")).toEqual({ password: "p" });
    expect(formSecrets(f("none"), "x")).toBeUndefined();
    expect(formSecrets(f("bearer", "env"), "t")).toBeUndefined();
    expect(formSecrets(f("bearer", "saved"), "")).toBeUndefined();
    expect(formSecrets(f("bearer", "saved"), "", { clearSaved: true })).toEqual({ token: "" });
    expect(JSON.stringify(formToManifest(f("bearer")))).not.toContain(KLAVIYO_MOCK_KEY);
  });

  it("maps rows to field refs: plain path, path + transform, or expression", () => {
    expect(fieldRefOf({ target: "spend", path: " metrics.spend ", transform: "", expr: "" })).toBe("metrics.spend");
    expect(fieldRefOf({ target: "spend", path: "cost_micros", transform: "micros", expr: "" })).toEqual({ path: "cost_micros", transform: "micros" });
    expect(fieldRefOf({ target: "spend", path: "ignored", transform: "cents", expr: "metrics__spend * 1.1" })).toEqual({ expr: "metrics__spend * 1.1" });
    const m = formToManifest(withForm((f) => (f.mappings = [{ target: "date", path: "day", transform: "", expr: "" }, { target: "clicks", path: "", transform: "", expr: "" }])));
    expect(m.rest?.mapping).toEqual({ date: "day", spend: "" });
  });

  it("only emits pagination, chunking, a POST body and a test path when they apply", () => {
    const none = formToManifest(withForm((f) => (f.pagination = { ...f.pagination, type: "none" })));
    expect(none.rest?.report.pagination).toBeUndefined();
    const page = formToManifest(withForm((f) => (f.pagination = { type: "page", param: "page", cursorPath: "paging.next", pageSize: "100", pageSizeParam: "per_page", maxPages: "x" })));
    expect(page.rest?.report.pagination).toEqual({ type: "page", param: "page", pageSize: 100, pageSizeParam: "per_page" });
    const get = formToManifest(withForm((f) => (f.report = { ...f.report, body: '{"a":1}', chunkDays: "31", testPath: "" })));
    expect(get.rest?.report.body).toBeUndefined();
    expect(get.rest?.report.chunkDays).toBe(31);
    expect(get.rest?.test).toBeUndefined();
    const post = formToManifest(withForm((f) => (f.report = { ...f.report, method: "POST", body: '{"from":"{start}"}' })));
    expect(post.rest?.report.body).toBe('{"from":"{start}"}');
    expect(validate(post, true).errors).toEqual([]);
  });

  it("derives id and icon from the name and keeps a saved id", () => {
    expect(pluginIdFor({ id: "", name: "Acme Ads!" })).toBe("custom-acme-ads");
    expect(pluginIdFor({ id: "custom-acme", name: "Renamed" })).toBe("custom-acme");
    const m = formToManifest(withForm((f) => Object.assign(f, { name: "  Acme Ads ", abbr: "" })));
    expect(m.name).toBe("Acme Ads");
    expect(m.icon.abbr).toBe("AC");
    expect(suggestEnvKey("custom-klaviyo")).toBe("PLUGIN_KLAVIYO_KEY");
    expect(suggestEnvKey("custom-acme-ads")).toBe("PLUGIN_ACME_ADS_KEY");
  });
});

describe("manifest → form", () => {
  it("round-trips a builder manifest", () => {
    const presets = [klaviyoMockForm(), withForm((f) => Object.assign(f, { category: "commerce", currency: "eur", dedupeKey: "id", refresh: "daily" })), withForm((f) => (f.auth = { ...f.auth, type: "basic", username: "u", source: "env", env: "PLUGIN_X_KEY" }))];
    for (const form of presets) {
      const m = formToManifest(form);
      expect(formToManifest(manifestToForm(m))).toEqual(m);
    }
  });

  it("keeps parts the builder doesn't edit (headers, config fields, limits, version)", () => {
    const base = formToManifest(klaviyoMockForm());
    const m: PluginManifest = {
      ...base,
      version: "2.1.0",
      configFields: [{ key: "account", label: "Account", type: "text", required: true }],
      rest: { ...(base.rest as NonNullable<PluginManifest["rest"]>), headers: { Accept: "application/json" }, limits: { timeoutMs: 5000 } },
    };
    const back = formToManifest(manifestToForm(m));
    expect(back.version).toBe("2.1.0");
    expect(back.configFields).toEqual(m.configFields);
    expect(back.rest?.headers).toEqual({ Accept: "application/json" });
    expect(back.rest?.limits).toEqual({ timeoutMs: 5000 });
  });

  it("recognizes where the credential lives", () => {
    const base = formToManifest(klaviyoMockForm());
    const withAuth = (auth: NonNullable<PluginManifest["rest"]>["auth"]): PluginManifest => ({ ...base, rest: { ...(base.rest as NonNullable<PluginManifest["rest"]>), auth } });
    expect(manifestToForm(withAuth({ type: "bearer", secret: { env: "PLUGIN_A_KEY" } })).auth).toMatchObject({ type: "bearer", source: "env", env: "PLUGIN_A_KEY" });
    expect(manifestToForm(withAuth({ type: "bearer", secret: { enc: "v1:x" } })).auth.source).toBe("saved");
    expect(manifestToForm(withAuth({ type: "bearer" }), { savedSecret: true }).auth.source).toBe("saved");
    expect(manifestToForm(withAuth({ type: "api_key_query", param: "key" })).auth).toMatchObject({ type: "api_key_query", param: "key", source: "value" });
  });

  it("loads the prototype builder's manifest after server-side normalization", () => {
    const proto = { name: "Klaviyo", category: "Ad platform", source: { baseUrl: "https://a.klaviyo.com/api", auth: "API key", report: "/reports?date_from={start}&date_to={end}" }, mapping: { date: "date", spend: "metrics.spend", conversions: "metrics.placed_order", currency: "USD" } };
    const norm = normalizeManifestInput(proto);
    expect(norm.candidate).not.toBeNull();
    const form = manifestToForm(fromPrototypeManifest(proto));
    expect(form).toMatchObject({ name: "Klaviyo", category: "ad_platform", baseUrl: "https://a.klaviyo.com/api", currency: "USD" });
    expect(form.auth).toMatchObject({ type: "api_key_header", header: "Authorization" });
    expect(form.mappings.map((r) => [r.target, r.path])).toEqual([
      ["date", "date"],
      ["spend", "metrics.spend"],
      ["conversions", "metrics.placed_order"],
    ]);
    expect(validate(formToManifest(form), true).errors).toEqual([]);
  });
});

describe("helpers", () => {
  it("routes issue paths to builder steps", () => {
    expect(issueStep("name")).toBe("basics");
    expect(issueStep("")).toBe("basics");
    expect(issueStep("rest.baseUrl")).toBe("endpoint");
    expect(issueStep("rest.report.pagination.cursorPath")).toBe("endpoint");
    expect(issueStep("secrets.token")).toBe("endpoint");
    expect(issueStep("rest.mapping.spend")).toBe("mapping");
  });

  it("parses pasted manifests", () => {
    expect(parseManifestText("  ")).toEqual({ ok: false, error: expect.stringContaining("Paste") });
    expect(parseManifestText("{nope").ok).toBe(false);
    expect(parseManifestText('{"kind":"savd.plugin"}')).toEqual({ ok: true, value: { kind: "savd.plugin" } });
  });
});
