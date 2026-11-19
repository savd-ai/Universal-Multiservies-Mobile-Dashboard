#!/usr/bin/env node
// Unpacks the reference prototype "Google Ads Dashboard - Standalone.html" into readable files so people and agents
// can study it: reference/decoded/{template.html, logic.js, assets/*, index.json}. The original HTML is never
// modified. reference/decoded/ is gitignored.
//
// The bundle format: <script type="__bundler/template"> holds the page as a JSON string; <script
// type="__bundler/manifest"> maps asset ids → { mime, compressed, data } (base64, gzip when compressed) — React,
// the dc runtime, the SAVD design-system bundle and 23 woff2 fonts. Fonts are skipped unless --fonts is passed.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "Google Ads Dashboard - Standalone.html");
const out = join(root, "reference", "decoded");
const withFonts = process.argv.includes("--fonts");

const html = readFileSync(source, "utf8");
const block = (type) => {
  const m = new RegExp(`<script type="${type}">([\\s\\S]*?)</script>`).exec(html);
  if (!m) throw new Error(`Missing <script type="${type}"> in the reference file`);
  return m[1];
};

mkdirSync(join(out, "assets"), { recursive: true });

const template = JSON.parse(block("__bundler/template"));
writeFileSync(join(out, "template.html"), template);

const logic = /<script type="text\/x-dc"[\s\S]*?<\/script>/.exec(template);
if (logic) writeFileSync(join(out, "logic.js"), logic[0]);

const manifest = JSON.parse(block("__bundler/manifest"));
const EXT = { "text/javascript": "js", "application/javascript": "js", "text/css": "css", "font/woff2": "woff2", "application/json": "json" };
const index = [];
for (const [id, entry] of Object.entries(manifest)) {
  const ext = EXT[entry.mime] ?? "bin";
  const isFont = ext === "woff2";
  const bytes = Buffer.from(entry.data, "base64");
  const data = entry.compressed ? gunzipSync(bytes) : bytes;
  index.push({ id, mime: entry.mime, bytes: data.length, file: isFont && !withFonts ? null : `assets/${id}.${ext}` });
  if (!isFont || withFonts) writeFileSync(join(out, "assets", `${id}.${ext}`), data);
}
writeFileSync(join(out, "index.json"), `${JSON.stringify(index, null, 2)}\n`);

console.log(`template.html (${template.length.toLocaleString()} chars), logic.js, ${index.filter((a) => a.file).length} assets → reference/decoded/`);
