#!/usr/bin/env node
// Copies the reference prototype to parity/index.html so it can be served next to the app for visual parity checks
// (`.claude/launch.json` → "prototype", port 4100). parity/ is gitignored.
//
// Never put a .env in parity/: the prototype fetch()es ".env" from the browser, which is exactly the leak the real
// app fixes. This script refuses to run if one exists.

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "Google Ads Dashboard - Standalone.html");
const outDir = join(root, "parity");

if (!existsSync(source)) {
  console.error(`Reference not found: ${source}`);
  process.exit(1);
}
if (existsSync(join(outDir, ".env"))) {
  console.error("parity/.env exists — delete it first. The prototype would expose it to the browser.");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
copyFileSync(source, join(outDir, "index.html"));
console.log("parity/index.html ready → serve it with the \"prototype\" launch config (http://localhost:4100).");
