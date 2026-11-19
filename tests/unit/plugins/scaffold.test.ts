import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// scripts/create-plugin.mjs against a throwaway copy of the files it reads and edits.

const repo = path.resolve(__dirname, "../../..");
const script = path.join(repo, "scripts", "create-plugin.mjs");
let root = "";

const run = (...args: string[]) => spawnSync(process.execPath, [script, ...args, "--root", root], { encoding: "utf8" });
const index = () => readFileSync(path.join(root, "src/plugins/custom/index.ts"), "utf8");

beforeAll(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "savd-scaffold-"));
  cpSync(path.join(repo, "src/plugins/custom/index.ts"), path.join(root, "src/plugins/custom/index.ts"));
  for (const f of ["catalog.ts", "alerts.ts"]) cpSync(path.join(repo, "src/plugins/builtin", f), path.join(root, "src/plugins/builtin", f));
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("plugin scaffold", () => {
  it("creates the plugin, its test and registers it between the markers", () => {
    const res = run("acme-ads", "--name", "Acme Ads", "--category", "commerce");
    expect(res.status).toBe(0);
    const plugin = readFileSync(path.join(root, "src/plugins/custom/acme-ads/index.ts"), "utf8");
    expect(plugin).toContain('kind: "code"');
    expect(plugin).toContain("live: false");
    expect(plugin).toContain('category: "commerce"');
    expect(plugin).toContain("demoPlatformRowsFromTotals");
    expect(plugin).toContain("ctx.fetch(");
    expect(plugin).toContain("PLUGIN_ACME_ADS_API_KEY");
    expect(existsSync(path.join(root, "tests/unit/plugins/custom-acme-ads.test.ts"))).toBe(true);
    const idx = index();
    expect(idx).toMatch(/import \{ acmeAdsPlugin \} from "\.\/acme-ads";\n\/\/ plugin-imports:end/);
    expect(idx).toMatch(/ {2}acmeAdsPlugin,\n {2}\/\/ plugin-list:end/);
  });

  it("is idempotent: a second run changes nothing and fails", () => {
    const before = index();
    const res = run("acme-ads");
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/already exists/);
    expect(index()).toBe(before);
  });

  it("refuses reserved, REST-prefixed and malformed ids and unknown categories", () => {
    const before = index();
    for (const args of [["meta"], ["slack"], ["custom-x"], ["Bad_Id"], ["a"], ["ok-id", "--category", "nope"]]) {
      const res = run(...(args as [string, ...string[]]));
      expect(res.status, args.join(" ")).toBe(1);
    }
    expect(index()).toBe(before);
    expect(existsSync(path.join(root, "src/plugins/custom/ok-id"))).toBe(false);
  });

  it("scaffolds alert plugins with a sendAlert skeleton", () => {
    expect(run("pager-bridge", "--category", "alerts").status).toBe(0);
    const plugin = readFileSync(path.join(root, "src/plugins/custom/pager-bridge/index.ts"), "utf8");
    expect(plugin).toContain('capabilities: ["alerts.send"]');
    expect(plugin).toContain("async sendAlert(msg, ctx)");
    expect(index()).toContain("pagerBridgePlugin,");
  });
});
