#!/usr/bin/env node
/**
 * build.mjs — the whole game in one HTML file.
 *
 * Injects into engine/template.html:
 *   - engine/quantum.js (the simulator) at the QUANTUM:INJECT marker
 *   - engine/strings.js (interface text, every language) at STRINGS:INJECT
 *   - i18n/<lang>/ overlays as <script type="application/json" data-level-tr / data-glossary-tr>
 *   - every levels/*.json as <script type="application/json" data-level="slug">
 *   - content/glossary.json as <script type="application/json" id="glossary">
 *
 * Output: dist/index.html plus dist/fonts/ (self-hosted). No runtime deps and
 * no third-party requests. That is what GitHub Pages serves.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { ROOT, QUANTUM_JS, STRINGS_JS, GLOSSARY, readLevels, readTranslations } from "./lib.mjs";

const TEMPLATE = path.join(ROOT, "engine", "template.html");
const DIST_DIR = path.join(ROOT, "dist");
const OUT = path.join(DIST_DIR, "index.html");
const FONTS_DIR = path.join(DIST_DIR, "fonts");
const LEVELS_MARKER = "<!-- LEVELS:INJECT -->";
const QUANTUM_MARKER = "/* QUANTUM:INJECT */";
const STRINGS_MARKER = "/* STRINGS:INJECT */";

// Self-hosted fonts, each under the SIL OFL (the license travels with them).
const FONTS = [
  ["@fontsource-variable/space-grotesk", ["space-grotesk-latin-wght-normal.woff2"]],
  ["@fontsource/atkinson-hyperlegible", ["400-normal", "400-italic", "700-normal"].map(w => `atkinson-hyperlegible-latin-${w}.woff2`)],
  ["@fontsource/jetbrains-mono", ["400", "500"].map(w => `jetbrains-mono-latin-${w}-normal.woff2`)],
];

async function copyFonts() {
  await fs.mkdir(FONTS_DIR, { recursive: true });
  for (const [pkg, files] of FONTS) {
    const dir = path.join(ROOT, "node_modules", pkg);
    for (const file of files) {
      await fs.copyFile(path.join(dir, "files", file), path.join(FONTS_DIR, file));
    }
    await fs.copyFile(path.join(dir, "LICENSE"), path.join(FONTS_DIR, `LICENSE-${path.basename(pkg)}.txt`));
  }
}

// The Content-Security-Policy allows inline scripts only by hash.
function scriptHashes(html) {
  const hashes = [];
  for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    // Browsers hash after normalizing newlines to LF (matters on Windows checkouts).
    const text = m[1].replace(/\r\n?/g, "\n");
    hashes.push(`'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`);
  }
  if (hashes.length === 0) throw new Error("No inline <script> found to hash for the CSP");
  return hashes.join(" ");
}

// </script> or <!-- inside a JSON block would end it early.
function escapeForScript(json) {
  return json.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
}

async function main() {
  const template = await fs.readFile(TEMPLATE, "utf-8");
  for (const marker of [LEVELS_MARKER, QUANTUM_MARKER, STRINGS_MARKER, "__CSP_SCRIPT_HASHES__"]) {
    if (!template.includes(marker)) throw new Error(`Template is missing ${marker}`);
  }

  const all = await readLevels();
  for (const { file, data } of all) {
    if (data.slug !== file.replace(/\.json$/, "")) throw new Error(`levels/${file}: slug must match filename`);
  }
  // Drafts never ship: everything injected here is public.
  const levels = all.filter(({ data }) => data.status !== "draft");
  const drafts = all.length - levels.length;
  console.log(`build: found ${all.length} level(s)${drafts ? `, skipping ${drafts} draft(s)` : ""}`);

  const glossary = JSON.parse(await fs.readFile(GLOSSARY, "utf-8"));
  const blocks = [
    ...levels.map(({ data }) =>
      `<script type="application/json" data-level="${data.slug}">${escapeForScript(JSON.stringify(data))}</script>`),
    `<script type="application/json" id="glossary">${escapeForScript(JSON.stringify(glossary))}</script>`,
  ];
  const shipped = new Set(levels.map(({ data }) => data.slug));
  const translations = await readTranslations();
  for (const [lang, tr] of Object.entries(translations)) {
    for (const [slug, data] of Object.entries(tr.levels)) {
      if (!shipped.has(slug)) continue; // drafts and unknown slugs never ship
      blocks.push(`<script type="application/json" data-level-tr="${slug}" data-lang="${lang}">${escapeForScript(JSON.stringify(data))}</script>`);
    }
    if (tr.glossary) blocks.push(`<script type="application/json" data-glossary-tr="${lang}">${escapeForScript(JSON.stringify(tr.glossary))}</script>`);
  }
  const injected = blocks.join("\n");

  const quantum = (await fs.readFile(QUANTUM_JS, "utf-8")).replace(/<\/script/gi, "<\\/script");
  const strings = (await fs.readFile(STRINGS_JS, "utf-8")).replace(/<\/script/gi, "<\\/script");
  let output = template.replace(LEVELS_MARKER, () => injected).replace(QUANTUM_MARKER, () => quantum).replace(STRINGS_MARKER, () => strings);
  output = output.replace("__CSP_SCRIPT_HASHES__", scriptHashes(output));

  await fs.mkdir(DIST_DIR, { recursive: true });
  await fs.writeFile(OUT, output, "utf-8");
  await copyFonts();

  const bytes = (await fs.stat(OUT)).size;
  console.log(`build: wrote ${path.relative(ROOT, OUT)} (${(bytes / 1024).toFixed(1)} KB)`);
}

main().catch(err => {
  console.error("build failed:", err.message);
  process.exit(1);
});
