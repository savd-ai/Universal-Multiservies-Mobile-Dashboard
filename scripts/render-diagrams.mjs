// npm run docs:diagrams — renders the Mermaid sources (UPPERCASE-NAME.mmd) at the repository root and in docs/images to
// PNG next to them (DATABASE-DIAGRAM.mmd → DATABASE-DIAGRAM.png) with the mermaid package in a headless browser (Playwright;
// PLAYWRIGHT_CHANNEL=chrome uses the installed Google Chrome). PNGs are drawn at 2× and tagged 192 dpi, so Word and
// pandoc size them at their natural width (and shrink them to the page). Pass names to render only those:
// `npm run docs:diagrams -- DATABASE-DIAGRAM`. scripts/docs-docx.mjs also uses renderMermaid() for ```mermaid blocks.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crc32 } from "node:zlib";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const SCALE = 2;

const CONFIG = {
  startOnLoad: false,
  theme: "base",
  securityLevel: "strict",
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  themeVariables: {
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    fontSize: "17px",
    background: "#FFFFFF",
    primaryColor: "#E6F4F1",
    primaryBorderColor: "#00A38A",
    primaryTextColor: "#1C1C1E",
    secondaryColor: "#F2F2F7",
    tertiaryColor: "#FFFFFF",
    lineColor: "#5F5F64",
    textColor: "#1C1C1E",
    titleColor: "#007864",
    attributeBackgroundColorOdd: "#FFFFFF",
    attributeBackgroundColorEven: "#F4FAF9",
    edgeLabelBackground: "#FFFFFF",
  },
  er: { useMaxWidth: false, entityPadding: 12, minEntityWidth: 120, fontSize: 17 },
  flowchart: { useMaxWidth: false, htmlLabels: true, curve: "basis", padding: 14 },
};

/** Tag a PNG with a pHYs chunk (pixels per metre) so document tools know its physical size. */
function withDpi(png, dpi) {
  const ppm = Math.round(dpi / 0.0254);
  const data = Buffer.alloc(9);
  data.writeUInt32BE(ppm, 0);
  data.writeUInt32BE(ppm, 4);
  data.writeUInt8(1, 8);
  const type = Buffer.from("pHYs");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  type.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([type, data])) >>> 0, 8 + data.length);
  // drop an existing pHYs chunk, then insert ours right after IHDR (8-byte signature + 25-byte IHDR chunk)
  const parts = [png.subarray(0, 33), chunk];
  for (let at = 33; at < png.length; ) {
    const len = png.readUInt32BE(at);
    const end = at + 12 + len;
    if (png.toString("ascii", at + 4, at + 8) !== "pHYs") parts.push(png.subarray(at, end));
    at = end;
  }
  return Buffer.concat(parts);
}

let browser = null;
let page = null;

async function ready() {
  if (page) return page;
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  page = await browser.newPage({ deviceScaleFactor: SCALE, viewport: { width: 1200, height: 800 } });
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}#out{display:inline-block;padding:24px;background:#fff}</style></head><body><div id="out"></div></body></html>');
  await page.addScriptTag({ path: require.resolve("mermaid/dist/mermaid.min.js") });
  await page.evaluate((config) => window.mermaid.initialize(config), CONFIG);
  return page;
}

/** Render Mermaid source to a PNG file. */
export async function renderMermaid(code, outPath) {
  const p = await ready();
  const size = await p.evaluate(async (src) => {
    const { svg } = await window.mermaid.render(`d${Math.random().toString(36).slice(2)}`, src);
    const out = document.getElementById("out");
    out.innerHTML = svg;
    const box = out.getBoundingClientRect();
    return { width: Math.ceil(box.width), height: Math.ceil(box.height) };
  }, code);
  await p.setViewportSize({ width: Math.max(400, size.width + 8), height: Math.max(300, size.height + 8) });
  const png = await p.locator("#out").screenshot({ type: "png" });
  writeFileSync(outPath, withDpi(png, 96 * SCALE));
  return size;
}

export async function closeRenderer() {
  await browser?.close();
  browser = null;
  page = null;
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const only = process.argv.slice(2).map((n) => path.basename(n).replace(/\.mmd$/, ""));
  const files = [root, path.join(root, "docs/images")]
    .flatMap((dir) => readdirSync(dir).filter((f) => /^[A-Z0-9-]+\.mmd$/.test(f)).map((f) => path.join(dir, f)))
    .filter((f) => !only.length || only.includes(path.basename(f, ".mmd")));
  if (!files.length) {
    console.error("No UPPERCASE-NAME.mmd files at the repository root or in docs/images.");
    process.exit(1);
  }
  try {
    for (const f of files) {
      const out = f.replace(/\.mmd$/, ".png");
      const size = await renderMermaid(readFileSync(f, "utf8"), out);
      console.log(`✓ ${path.relative(root, out)} (${size.width} × ${size.height} px at 1×, ${SCALE}× pixels)`);
    }
  } finally {
    await closeRenderer();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
