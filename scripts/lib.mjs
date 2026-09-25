// Shared helpers for the build scripts.
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
export const QUANTUM_JS = path.join(ROOT, "engine", "quantum.js");
export const LEVELS_DIR = path.join(ROOT, "levels");
export const GLOSSARY = path.join(ROOT, "content", "glossary.json");
export const STRINGS_JS = path.join(ROOT, "engine", "strings.js");
export const I18N_DIR = path.join(ROOT, "i18n");

/** Loads engine/quantum.js (a browser script) into an isolated context. */
export async function loadQuantum() {
  const code = await fs.readFile(QUANTUM_JS, "utf-8");
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox, { filename: "engine/quantum.js" });
  return sandbox.Quantum;
}

/** engine/strings.js → { LANGS, pt, es, en } */
export async function loadStrings() {
  const code = await fs.readFile(STRINGS_JS, "utf-8");
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox, { filename: "engine/strings.js" });
  return sandbox.STRINGS;
}

/**
 * Translation overlays: { [lang]: { levels: { slug: {...} }, glossary: {...} | null } }
 * from i18n/<lang>/levels/*.json and i18n/<lang>/glossary.json.
 */
export async function readTranslations() {
  const out = {};
  let langs = [];
  try { langs = (await fs.readdir(I18N_DIR, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name); } catch { return out; }
  for (const lang of langs) {
    const entry = out[lang] = { levels: {}, glossary: null };
    const dir = path.join(I18N_DIR, lang, "levels");
    let files = [];
    try { files = (await fs.readdir(dir)).filter(f => f.endsWith(".json")); } catch { /* no level overlays */ }
    for (const file of files) {
      const raw = await fs.readFile(path.join(dir, file), "utf-8");
      try { entry.levels[file.replace(/\.json$/, "")] = JSON.parse(raw); } catch (e) { throw new Error(`Invalid JSON in i18n/${lang}/levels/${file}: ${e.message}`); }
    }
    try {
      entry.glossary = JSON.parse(await fs.readFile(path.join(I18N_DIR, lang, "glossary.json"), "utf-8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw new Error(`Invalid JSON in i18n/${lang}/glossary.json: ${e.message}`);
    }
  }
  return out;
}

/** Every levels/*.json as { file, data }, sorted by `order`. Throws on bad JSON. */
export async function readLevels() {
  const files = (await fs.readdir(LEVELS_DIR)).filter(f => f.endsWith(".json"));
  const levels = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(LEVELS_DIR, file), "utf-8");
    try {
      levels.push({ file, data: JSON.parse(raw) });
    } catch (e) {
      throw new Error(`Invalid JSON in levels/${file}: ${e.message}`);
    }
  }
  return levels.sort((a, b) => (a.data.order ?? 999) - (b.data.order ?? 999));
}
