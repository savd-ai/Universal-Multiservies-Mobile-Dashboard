// Word versions of the user docs: docs/<name>.md → docs/docx/<name>.docx (Vietnamese) and docs/en/<name>.md →
// docs/en/docx/<name>.docx (English) with pandoc (≥ 3). Styles come from scripts/docs-reference.docx (A4, SAVD teal
// headings, footer; edit it in Word to restyle), links and captions from scripts/docs-docx.lua. The first "# Heading"
// becomes the document title. Pass names to rebuild only those: `npm run docs:docx -- OVERVIEW USER-GUIDE`.
//
// Graphs render as images: a ```mermaid block is drawn to a PNG first (scripts/render-diagrams.mjs, Playwright —
// PLAYWRIGHT_CHANNEL=chrome uses Google Chrome), and pandoc fits every image to the page width. The build fails when
// an image can't be found or isn't embedded in the .docx.

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const date = new Date();
const SETS = [
  { dir: "docs", lang: "vi-VN", updated: "Cập nhật", names: ["GIOI-THIEU-DU-AN", "HUONG-DAN-SU-DUNG", "THIET-KE-CO-SO-DU-LIEU"] },
  { dir: "docs/en", lang: "en-US", updated: "Updated", names: ["OVERVIEW", "USER-GUIDE", "DATABASE-DESIGN"] },
];
const only = process.argv.slice(2);
const MERMAID = /^```mermaid[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/gm;
const IMAGE = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

const work = mkdtempSync(path.join(tmpdir(), "savd-docx-"));
let renderer = null;

/** The markdown with every ```mermaid block replaced by a rendered PNG (absolute path). */
async function withRenderedDiagrams(markdown) {
  const blocks = [...markdown.matchAll(MERMAID)];
  if (!blocks.length) return { markdown, diagrams: 0 };
  renderer ??= await import("./render-diagrams.mjs");
  let out = markdown;
  for (const [block, code] of blocks) {
    const file = path.join(work, `${createHash("sha1").update(code).digest("hex").slice(0, 12)}.png`);
    if (!existsSync(file)) await renderer.renderMermaid(code, file);
    out = out.replace(block, `![](${file})`);
  }
  return { markdown: out, diagrams: blocks.length };
}

/** Media files inside a .docx (a zip), or null when `unzip` is not available. */
function embeddedMedia(docx) {
  try {
    return execFileSync("unzip", ["-Z1", docx], { encoding: "utf8" })
      .split("\n")
      .filter((f) => f.startsWith("word/media/")).length;
  } catch {
    return null;
  }
}

try {
  for (const set of SETS) {
    const today = new Intl.DateTimeFormat(set.lang, { day: "2-digit", month: set.lang === "vi-VN" ? "2-digit" : "long", year: "numeric" }).format(date);
    mkdirSync(`${set.dir}/docx`, { recursive: true });
    for (const name of set.names.filter((n) => !only.length || only.includes(n))) {
      const source = readFileSync(`${set.dir}/${name}.md`, "utf8");
      const { markdown, diagrams } = await withRenderedDiagrams(source);
      // distinct images the document references (pandoc embeds each file once)
      const images = new Set([...markdown.matchAll(IMAGE)].map((m) => m[1]));
      const out = `${set.dir}/docx/${name}.docx`;
      const args = [
        "--from=gfm",
        "--to=docx",
        "--shift-heading-level-by=-1",
        `--resource-path=${set.dir}`,
        "--reference-doc=scripts/docs-reference.docx",
        "--lua-filter=scripts/docs-docx.lua",
        "--syntax-highlighting=none",
        `--metadata=lang:${set.lang}`,
        `--metadata=date:${set.updated} ${today}`,
        `--output=${out}`,
      ];
      const run = spawnSync("pandoc", args, { input: markdown, encoding: "utf8" });
      if (run.error && /** @type {NodeJS.ErrnoException} */ (run.error).code === "ENOENT") {
        console.error("pandoc not found — install it from https://pandoc.org/installing.html (macOS: brew install pandoc)");
        process.exit(1);
      }
      const warnings = run.stderr ?? "";
      if (warnings) process.stderr.write(warnings);
      if (run.status !== 0) throw new Error(`pandoc failed for ${out}`);
      if (/Could not fetch resource|Could not find image/i.test(warnings)) throw new Error(`${out}: an image is missing`);
      const media = embeddedMedia(out);
      if (media !== null && media < images.size) throw new Error(`${out}: ${images.size} images referenced but ${media} embedded`);
      console.log(`✓ ${out}${images.size ? ` · ${images.size} image${images.size === 1 ? "" : "s"}${diagrams ? ` (${diagrams} from Mermaid)` : ""}${media !== null ? `, ${media} embedded` : ""}` : ""}`);
    }
  }
} finally {
  await renderer?.closeRenderer();
  rmSync(work, { recursive: true, force: true });
}
